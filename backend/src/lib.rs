use axum::{
    Router,
    extract::DefaultBodyLimit,
    http::{HeaderValue, Method, header},
    middleware::from_fn,
    routing::{get, post},
};
use std::{net::SocketAddr, time::Duration};
use tokio::net::TcpListener;
use tokio::time;
use tower_governor::{GovernorLayer, governor::GovernorConfigBuilder};
use tower_http::{cors::CorsLayer, trace::TraceLayer};

use crate::handlers::{auth_handler, health, secrets_handler};

mod cleanup;
mod config;
mod constants;
mod error;
mod handlers;
mod middleware;
mod structs;
#[cfg(test)]
mod test_helpers;

use config::setup_database_pool;
use structs::app_state::AppState;

const DEFAULT_SECRET_BODY_LIMIT: usize = 16 * 1024;

pub async fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .init();

    dotenvy::dotenv().ok();

    let server_port = std::env::var("SERVER_PORT").expect("SERVER_PORT must be set");

    let pool = setup_database_pool().await;
    tokio::spawn(cleanup::run(pool.clone()));
    let oauth_config = config::load_google_oauth_config().await;

    // Rate limiting
    let governor_conf = GovernorConfigBuilder::default()
        .per_second(5)
        .burst_size(10)
        .finish()
        .expect("invalid rate limiter config");

    let governor_limiter = governor_conf.limiter().clone();
    tokio::spawn(async move {
        let mut interval = time::interval(Duration::from_secs(60));
        loop {
            interval.tick().await;
            governor_limiter.retain_recent();
        }
    });

    // CORS settings
    let frontend_origin = std::env::var("FRONTEND_ORIGIN").expect("FRONTEND_ORIGIN must be set");

    let cors_layer = CorsLayer::new()
        .allow_origin(
            frontend_origin
                .parse::<HeaderValue>()
                .expect("invalid FRONTEND_ORIGIN"),
        )
        .allow_methods([Method::GET, Method::POST])
        .allow_headers([header::CONTENT_TYPE])
        .allow_credentials(true);

    let app_state = AppState {
        pool,
        google_client_id: oauth_config.client_id,
        google_client_secret: oauth_config.client_secret,
        google_redirect_url: oauth_config.redirect_url,
        frontend_origin,
    };

    let v1_routes = Router::new()
        .route("/secret", post(secrets_handler::create_secret))
        .route("/secret/{id}", get(secrets_handler::get_secret))
        .route("/auth/google/login", get(auth_handler::google_login))
        .route("/auth/google/callback", get(auth_handler::google_callback))
        .route("/me", get(auth_handler::me))
        .route("/auth/logout", post(auth_handler::logout));

    let app = Router::new()
        .route("/health", get(health::health))
        .nest("/v1", v1_routes)
        .layer(DefaultBodyLimit::max(DEFAULT_SECRET_BODY_LIMIT))
        .layer(GovernorLayer::new(governor_conf))
        .layer(cors_layer)
        .layer(from_fn(middleware::add_security_headers))
        .layer(TraceLayer::new_for_http())
        .with_state(app_state);

    let listener = TcpListener::bind(format!("0.0.0.0:{server_port}"))
        .await
        .expect("Error binding to configured port");

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .expect("Error starting app!!");
}
