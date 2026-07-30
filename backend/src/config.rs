use sqlx::{PgPool, postgres::PgPoolOptions};

use crate::structs::auth::GoogleOAuthConfig;

pub async fn setup_database_pool() -> PgPool {
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to Postgres");
    tracing::info!("Connected to database");

    sqlx::migrate!()
        .run(&pool)
        .await
        .expect("Failed to run migrations");
    tracing::info!("Migrations applied");

    pool
}

pub async fn load_google_oauth_config() -> GoogleOAuthConfig {
    GoogleOAuthConfig {
        client_id: std::env::var("GOOGLE_CLIENT_ID").expect("GOOGLE_CLIENT_ID must be set"),
        client_secret: std::env::var("GOOGLE_CLIENT_SECRET")
            .expect("GOOGLE_CLIENT_SECRET must be set"),
        redirect_url: std::env::var("GOOGLE_REDIRECT_URL")
            .expect("GOOGLE_REDIRECT_URL must be set"),
    }
}
