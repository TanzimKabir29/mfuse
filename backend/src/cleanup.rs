use std::time::Duration;

use sqlx::PgPool;
use tokio::time;

const CLEANUP_INTERVAL: Duration = Duration::from_secs(60);

pub async fn run(pool: PgPool) {
    let mut interval = time::interval(CLEANUP_INTERVAL);

    loop {
        interval.tick().await;

        match delete_expired(&pool).await {
            Ok(result) if result > 0 => {
                tracing::info!(deleted = result, "cleaned up expired secrets");
            }
            Ok(_) => {}
            Err(error) => {
                tracing::error!(%error, "cleanup task failed to delete expired secrets");
            }
        }
    }
}

async fn delete_expired(pool: &PgPool) -> sqlx::Result<u64> {
    let query_result = sqlx::query!("DELETE FROM secrets WHERE expires_at <= now()")
        .execute(pool)
        .await?;

    Ok(query_result.rows_affected())
}

#[cfg(test)]
mod tests {
    use chrono::{Duration as ChronoDuration, Utc};
    use uuid::Uuid;

    use super::delete_expired;
    use crate::test_helpers::insert_test_user;

    #[sqlx::test]
    async fn deletes_only_expired_rows(pool: sqlx::PgPool) -> sqlx::Result<()> {
        let owner_id = insert_test_user(&pool).await;
        let expired_id = Uuid::new_v4();
        let active_id = Uuid::new_v4();

        sqlx::query!(
            "INSERT INTO secrets (id, owner_id, ciphertext, nonce, expires_at)
             VALUES ($1, $2, $3, $4, $5)",
            expired_id,
            owner_id,
            b"ciphertext".to_vec(),
            b"nonce".to_vec(),
            Utc::now() - ChronoDuration::minutes(1),
        )
        .execute(&pool)
        .await?;

        sqlx::query!(
            "INSERT INTO secrets (id, owner_id, ciphertext, nonce, expires_at)
             VALUES ($1, $2, $3, $4, $5)",
            active_id,
            owner_id,
            b"ciphertext".to_vec(),
            b"nonce".to_vec(),
            Utc::now() + ChronoDuration::minutes(10),
        )
        .execute(&pool)
        .await?;

        let deleted = delete_expired(&pool).await?;
        assert_eq!(deleted, 1);

        let remaining: Vec<Uuid> = sqlx::query_scalar!("SELECT id FROM secrets")
            .fetch_all(&pool)
            .await?;
        assert_eq!(remaining, vec![active_id]);

        Ok(())
    }
}
