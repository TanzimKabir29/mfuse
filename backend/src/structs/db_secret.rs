use chrono::{DateTime, Utc};
use uuid::Uuid;

pub struct Secret {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub ciphertext: Vec<u8>,
    pub nonce: Vec<u8>,
    pub expires_at: DateTime<Utc>,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub passphrase_salt: Option<Vec<u8>>,
}
