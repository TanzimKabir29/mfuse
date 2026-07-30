use sqlx::PgPool;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub google_client_id: String,
    pub google_client_secret: String,
    pub google_redirect_url: String,
    pub frontend_origin: String,
}
