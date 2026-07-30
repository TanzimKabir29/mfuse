use chrono::Duration;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SecretExpiry {
    TenMinutes,
    OneHour,
    TwentyFourHours,
}

impl SecretExpiry {
    pub fn duration(&self) -> Duration {
        match self {
            SecretExpiry::TenMinutes => Duration::minutes(10),
            SecretExpiry::OneHour => Duration::hours(1),
            SecretExpiry::TwentyFourHours => Duration::hours(24),
        }
    }
}

#[derive(Deserialize)]
pub struct CreateSecretRequest {
    pub ciphertext: String,
    pub nonce: String,
    pub description: Option<String>,
    pub expiry: SecretExpiry,
    pub passphrase_salt: Option<String>,
}

#[derive(Serialize)]
pub struct CreateSecretResponse {
    pub id: Uuid,
}

#[derive(Serialize)]
pub struct GetSecretResponse {
    pub ciphertext: String,
    pub nonce: String,
    pub passphrase_salt: Option<String>,
}
