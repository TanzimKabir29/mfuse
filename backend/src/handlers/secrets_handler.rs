use axum::{
    Json,
    extract::{Path, State},
};
use base64::prelude::*;
use chrono::Utc;
use sqlx::{query, query_as};
use uuid::Uuid;

use crate::{
    error::AppError,
    structs::{
        api_secret::{CreateSecretRequest, CreateSecretResponse, GetSecretResponse},
        app_state::AppState,
        current_user::CurrentUser,
        db_secret::Secret,
    },
};

#[tracing::instrument(skip(state, request, current_user))]
pub async fn create_secret(
    State(state): State<AppState>,
    current_user: CurrentUser,
    Json(request): Json<CreateSecretRequest>,
) -> Result<Json<CreateSecretResponse>, AppError> {
    let id = Uuid::now_v7();
    let ciphertext = BASE64_STANDARD
        .decode(&request.ciphertext)
        .map_err(|_| AppError::BadRequest("invalid ciphertext encoding".to_string()))?;
    let nonce = BASE64_STANDARD
        .decode(&request.nonce)
        .map_err(|_| AppError::BadRequest("invalid nonce encoding".to_string()))?;
    let expires_at = Utc::now() + request.expiry.duration();
    let description = request.description;
    let passphrase_salt = request
        .passphrase_salt
        .map(|salt| BASE64_STANDARD.decode(&salt))
        .transpose()
        .map_err(|_| AppError::BadRequest("invalid passphrase_salt encoding".to_string()))?;

    query!(
        "INSERT INTO secrets(id, owner_id, ciphertext, nonce, expires_at, description, passphrase_salt) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        id,
        current_user.id,
        ciphertext,
        nonce,
        expires_at,
        description,
        passphrase_salt,
    ).execute(&state.pool)
    .await?;

    tracing::info!(id = %id, owner_id = %current_user.id, "Secret created");

    Ok(Json(CreateSecretResponse { id }))
}

#[tracing::instrument(skip(state))]
pub async fn get_secret(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<GetSecretResponse>, AppError> {
    let record = query_as!(
        Secret,
        "DELETE FROM secrets
             WHERE id = $1 AND expires_at > now()
             RETURNING id, owner_id, ciphertext, nonce, expires_at, description, created_at, passphrase_salt",
        id
    )
    .fetch_optional(&state.pool)
    .await?;

    match record {
        Some(secret) => {
            tracing::info!(id = %secret.id, "Secret consumed");
            Ok(Json(GetSecretResponse {
                ciphertext: BASE64_STANDARD.encode(secret.ciphertext),
                nonce: BASE64_STANDARD.encode(secret.nonce),
                passphrase_salt: secret
                    .passphrase_salt
                    .map(|salt| BASE64_STANDARD.encode(salt)),
            }))
        }
        None => Err(AppError::NotFound),
    }
}

#[cfg(test)]
mod tests {
    use chrono::{Duration as ChronoDuration, Utc};
    use uuid::Uuid;

    use super::*;
    use crate::structs::api_secret::SecretExpiry;
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

    #[sqlx::test]
    async fn create_then_consume_secret(pool: sqlx::PgPool) {
        let owner_id = insert_test_user(&pool).await;
        let current_user = CurrentUser {
            id: owner_id,
            email: "owner@example.com".to_string(),
            display_name: "Owner".to_string(),
        };
        let state = test_state(pool);

        let created = create_secret(
            State(state.clone()),
            current_user,
            Json(CreateSecretRequest {
                ciphertext: BASE64_STANDARD.encode(b"hunter2"),
                nonce: BASE64_STANDARD.encode(b"fake-nonce-1"),
                description: None,
                expiry: SecretExpiry::OneHour,
                passphrase_salt: None,
            }),
        )
        .await
        .expect("create_secret should succeed");

        let id = created.0.id;

        let stored_owner: Uuid =
            sqlx::query_scalar!("SELECT owner_id FROM secrets WHERE id = $1", id)
                .fetch_one(&state.pool)
                .await
                .unwrap();
        assert_eq!(stored_owner, owner_id);

        let first_get = get_secret(State(state.clone()), Path(id))
            .await
            .expect("first get should succeed");
        assert_eq!(
            BASE64_STANDARD.decode(&first_get.0.ciphertext).unwrap(),
            b"hunter2"
        );
        assert!(first_get.0.passphrase_salt.is_none());

        let second_get = get_secret(State(state), Path(id)).await;
        assert!(matches!(second_get, Err(AppError::NotFound)));
    }

    #[sqlx::test]
    async fn passphrase_salt_round_trips(pool: sqlx::PgPool) {
        let owner_id = insert_test_user(&pool).await;
        let current_user = CurrentUser {
            id: owner_id,
            email: "owner@example.com".to_string(),
            display_name: "Owner".to_string(),
        };
        let state = test_state(pool);
        let salt = BASE64_STANDARD.encode(b"some-random-salt");

        let created = create_secret(
            State(state.clone()),
            current_user,
            Json(CreateSecretRequest {
                ciphertext: BASE64_STANDARD.encode(b"hunter2"),
                nonce: BASE64_STANDARD.encode(b"fake-nonce-1"),
                description: None,
                expiry: SecretExpiry::OneHour,
                passphrase_salt: Some(salt.clone()),
            }),
        )
        .await
        .expect("create_secret should succeed");

        let fetched = get_secret(State(state), Path(created.0.id))
            .await
            .expect("get should succeed");

        assert_eq!(fetched.0.passphrase_salt, Some(salt));
    }

    #[sqlx::test]
    async fn expired_secret_is_rejected(pool: sqlx::PgPool) -> sqlx::Result<()> {
        let owner_id = insert_test_user(&pool).await;
        let id = Uuid::new_v4();

        sqlx::query!(
            "INSERT INTO secrets (id, owner_id, ciphertext, nonce, expires_at)
             VALUES ($1, $2, $3, $4, $5)",
            id,
            owner_id,
            b"secret".to_vec(),
            b"nonce".to_vec(),
            Utc::now() - ChronoDuration::minutes(1),
        )
        .execute(&pool)
        .await?;

        let state = test_state(pool);
        let result = get_secret(State(state), Path(id)).await;

        assert!(matches!(result, Err(AppError::NotFound)));

        Ok(())
    }
}
