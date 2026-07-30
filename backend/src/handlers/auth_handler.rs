use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Redirect},
};
use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use chrono::{Duration, Utc};
use oauth2::{
    AuthUrl, AuthorizationCode, ClientId, ClientSecret, CsrfToken, PkceCodeChallenge,
    PkceCodeVerifier, RedirectUrl, Scope, TokenResponse, TokenUrl, basic::BasicClient,
};

use subtle::ConstantTimeEq;
use uuid::Uuid;

use crate::{
    constants::google_oauth_endpoints::{GOOGLE_AUTH_URL, GOOGLE_TOKEN_URL, GOOGLE_USERINFO_URL},
    error::AppError,
    structs::{app_state::*, auth::*, current_user::*},
};

fn oauth_cookie(name: &'static str, value: String) -> Cookie<'static> {
    Cookie::build((name, value))
        .http_only(true)
        .secure(true)
        .same_site(SameSite::Lax)
        .path("/")
        .build()
}

pub async fn google_login(State(state): State<AppState>) -> impl IntoResponse {
    let client = BasicClient::new(ClientId::new(state.google_client_id.clone()))
        .set_client_secret(ClientSecret::new(state.google_client_secret.clone()))
        .set_auth_uri(AuthUrl::new(GOOGLE_AUTH_URL.to_string()).expect("invalid auth url"))
        .set_token_uri(TokenUrl::new(GOOGLE_TOKEN_URL.to_string()).expect("invalid token url"))
        .set_redirect_uri(
            RedirectUrl::new(state.google_redirect_url.clone()).expect("invalid redirect url"),
        );

    let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();

    let (auth_url, csrf_token) = client
        .authorize_url(CsrfToken::new_random)
        .add_scope(Scope::new("openid".to_string()))
        .add_scope(Scope::new("email".to_string()))
        .add_scope(Scope::new("profile".to_string()))
        .set_pkce_challenge(pkce_challenge)
        .url();

    let jar = CookieJar::new()
        .add(oauth_cookie("oauth_csrf", csrf_token.secret().clone()))
        .add(oauth_cookie(
            "oauth_pkce_verifier",
            pkce_verifier.secret().clone(),
        ));

    (jar, Redirect::to(auth_url.as_str()))
}

pub async fn google_callback(
    State(state): State<AppState>,
    Query(params): Query<CallbackParams>,
    jar: CookieJar,
) -> Result<impl IntoResponse, AppError> {
    let stored_csrf = jar
        .get("oauth_csrf")
        .map(|c| c.value().to_string())
        .ok_or_else(|| AppError::BadRequest("missing oauth_csrf cookie".to_string()))?;
    let pkce_verifier = jar
        .get("oauth_pkce_verifier")
        .map(|c| c.value().to_string())
        .ok_or_else(|| AppError::BadRequest("missing oauth_pkce_verifier cookie".to_string()))?;

    if !bool::from(stored_csrf.as_bytes().ct_eq(params.state.as_bytes())) {
        return Err(AppError::BadRequest("csrf token mismatch".to_string()));
    }

    let client = BasicClient::new(ClientId::new(state.google_client_id.clone()))
        .set_client_secret(ClientSecret::new(state.google_client_secret.clone()))
        .set_auth_uri(AuthUrl::new(GOOGLE_AUTH_URL.to_string()).expect("invalid auth url"))
        .set_token_uri(TokenUrl::new(GOOGLE_TOKEN_URL.to_string()).expect("invalid token url"))
        .set_redirect_uri(
            RedirectUrl::new(state.google_redirect_url.clone()).expect("invalid redirect url"),
        );

    let http_client = reqwest::ClientBuilder::new()
        .redirect(reqwest::redirect::Policy::none())
        .build()?;

    let token_result = client
        .exchange_code(AuthorizationCode::new(params.code))
        .set_pkce_verifier(PkceCodeVerifier::new(pkce_verifier))
        .request_async(&http_client)
        .await
        .map_err(|error| {
            tracing::error!(%error, "token exchange failed");
            AppError::Unauthorized
        })?;

    let access_token = token_result.access_token().secret();

    let profile: GoogleUserInfo = http_client
        .get(GOOGLE_USERINFO_URL)
        .bearer_auth(access_token)
        .send()
        .await?
        .json()
        .await?;

    let user_id = sqlx::query_scalar!(
        "INSERT INTO users (id, google_subject, email, display_name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (google_subject)
         DO UPDATE SET email = EXCLUDED.email, display_name = EXCLUDED.display_name
         RETURNING id",
        Uuid::new_v4(),
        profile.sub,
        profile.email,
        profile.name,
    )
    .fetch_one(&state.pool)
    .await?;

    let session_id = Uuid::new_v4();
    let session_expires_at = Utc::now() + Duration::days(7);

    sqlx::query!(
        "INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)",
        session_id,
        user_id,
        session_expires_at,
    )
    .execute(&state.pool)
    .await?;

    tracing::info!(user_id = %user_id, "user logged in");

    let jar = jar
        .remove(Cookie::from("oauth_csrf"))
        .remove(Cookie::from("oauth_pkce_verifier"))
        .add(
            Cookie::build(("session_id", session_id.to_string()))
                .http_only(true)
                .secure(true)
                .same_site(SameSite::None)
                .path("/")
                .max_age(time::Duration::days(7))
                .build(),
        );

    Ok((jar, Redirect::to(&state.frontend_origin)))
}

pub async fn me(current_user: CurrentUser) -> Json<CurrentUser> {
    Json(current_user)
}

pub async fn logout(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<impl IntoResponse, AppError> {
    if let Some(session_cookie) = jar.get("session_id") {
        if let Ok(session_id) = Uuid::parse_str(session_cookie.value()) {
            sqlx::query!("DELETE FROM sessions WHERE id = $1", session_id)
                .execute(&state.pool)
                .await?;
        }
    }

    let jar = jar.remove(Cookie::from("session_id"));

    Ok((jar, StatusCode::NO_CONTENT))
}
