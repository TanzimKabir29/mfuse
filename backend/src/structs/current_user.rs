use axum::{extract::FromRequestParts, http::request::Parts};

use axum_extra::extract::CookieJar;
use serde::Serialize;
use uuid::Uuid;

use crate::{error::AppError, structs::app_state::AppState};

#[derive(Serialize, Debug)]
pub struct CurrentUser {
    pub id: Uuid,
    pub email: String,
    pub display_name: String,
}

impl FromRequestParts<AppState> for CurrentUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let cookie_jar = CookieJar::from_request_parts(parts, state)
            .await
            .expect("cookie jar extraction is infallible");

        let session_id = cookie_jar
            .get("session_id")
            .and_then(|cookie| Uuid::parse_str(cookie.value()).ok())
            .ok_or(AppError::Unauthorized)?;

        sqlx::query_as!(
            CurrentUser,
            "SELECT users.id, users.email, users.display_name
                     FROM sessions
                     JOIN users ON users.id = sessions.user_id
                     WHERE sessions.id = $1 AND sessions.expires_at > now()",
            session_id
        )
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::Unauthorized)
    }
}

#[cfg(test)]
mod tests {
    use axum::http::Request;
    use chrono::{Duration as ChronoDuration, Utc};
    use uuid::Uuid;

    use super::*;
    use crate::structs::app_state::AppState;
    use crate::test_helpers::insert_test_user;

    fn test_state(pool: sqlx::PgPool) -> AppState {
        AppState {
            pool,
            google_client_id: String::new(),
            google_client_secret: String::new(),
            google_redirect_url: String::new(),
            frontend_origin: String::new(),
        }
    }

    fn parts_with_cookie(cookie: Option<String>) -> axum::http::request::Parts {
        let mut builder = Request::builder().uri("/me");
        if let Some(cookie) = cookie {
            builder = builder.header("cookie", cookie);
        }
        let (parts, _) = builder.body(()).unwrap().into_parts();
        parts
    }

    #[sqlx::test]
    async fn rejects_when_no_cookie(pool: sqlx::PgPool) {
        let state = test_state(pool);
        let mut parts = parts_with_cookie(None);

        let result = CurrentUser::from_request_parts(&mut parts, &state).await;

        assert!(matches!(result, Err(AppError::Unauthorized)));
    }

    #[sqlx::test]
    async fn rejects_expired_session(pool: sqlx::PgPool) -> sqlx::Result<()> {
        let user_id = insert_test_user(&pool).await;
        let session_id = Uuid::new_v4();

        sqlx::query!(
            "INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)",
            session_id,
            user_id,
            Utc::now() - ChronoDuration::minutes(1),
        )
        .execute(&pool)
        .await?;

        let state = test_state(pool);
        let mut parts = parts_with_cookie(Some(format!("session_id={session_id}")));

        let result = CurrentUser::from_request_parts(&mut parts, &state).await;

        assert!(matches!(result, Err(AppError::Unauthorized)));

        Ok(())
    }

    #[sqlx::test]
    async fn accepts_valid_session(pool: sqlx::PgPool) -> sqlx::Result<()> {
        let user_id = insert_test_user(&pool).await;
        let session_id = Uuid::new_v4();

        sqlx::query!(
            "INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)",
            session_id,
            user_id,
            Utc::now() + ChronoDuration::days(1),
        )
        .execute(&pool)
        .await?;

        let state = test_state(pool);
        let mut parts = parts_with_cookie(Some(format!("session_id={session_id}")));

        let current_user = CurrentUser::from_request_parts(&mut parts, &state)
            .await
            .expect("expected a valid current user");

        assert_eq!(current_user.id, user_id);

        Ok(())
    }
}
