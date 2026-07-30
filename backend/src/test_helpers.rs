#![cfg(test)]

use sqlx::PgPool;
use uuid::Uuid;

pub async fn insert_test_user(pool: &PgPool) -> Uuid {
    let id = Uuid::new_v4();

    sqlx::query!(
        "INSERT INTO users (id, google_subject, email, display_name) VALUES ($1, $2, $3, $4)",
        id,
        id.to_string(),
        format!("{id}@example.com"),
        "Test User",
    )
    .execute(pool)
    .await
    .expect("failed to insert test user");

    id
}
