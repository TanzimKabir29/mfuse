use axum::response::{IntoResponse, Response};
use reqwest::StatusCode;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("not found")]
    NotFound,

    #[error("unauthorized")]
    Unauthorized,

    #[error("bad request: {0}")]
    BadRequest(String),

    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("upstream request failed: {0}")]
    Upstream(#[from] reqwest::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = match &self {
            AppError::NotFound => StatusCode::NOT_FOUND,
            AppError::Unauthorized => StatusCode::UNAUTHORIZED,
            AppError::BadRequest(_) => StatusCode::BAD_REQUEST,
            AppError::Database(_) | AppError::Upstream(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };

        if status == StatusCode::INTERNAL_SERVER_ERROR {
            tracing::error!(%self, "request denied");
        } else {
            tracing::debug!(%self, "request rejected");
        }

        status.into_response()
    }
}
