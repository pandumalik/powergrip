use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AccessGrant {
    pub id: Uuid,
    pub employee_id: Uuid,
    pub inventory_id: Uuid,
    pub project_id: Option<Uuid>,
    pub access_level: String,
    pub grant_type: String,
    pub status: String,
    pub justification: String,
    pub requested_start_time: DateTime<Utc>,
    pub requested_end_time: Option<DateTime<Utc>>,
    pub valid_from: Option<DateTime<Utc>>,
    pub valid_until: Option<DateTime<Utc>>,
    pub reviewed_by: Option<Uuid>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub review_notes: Option<String>,
    pub revoked_by: Option<Uuid>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub revocation_reason: Option<String>,
    #[sqlx(json)]
    pub metadata: Option<Value>,
    #[serde(default)]
    #[sqlx(json)]
    #[sqlx(default)]
    pub employee: Option<Value>,
    #[serde(default)]
    #[sqlx(json)]
    #[sqlx(default)]
    pub inventory: Option<Value>,
    #[serde(default)]
    #[sqlx(json)]
    #[sqlx(default)]
    pub project: Option<Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AccessAuditLog {
    pub id: Uuid,
    pub grant_id: Option<Uuid>,
    pub employee_id: Uuid,
    pub inventory_id: Uuid,
    pub action: String,
    pub ip_address: Option<String>,
    pub session_id: Option<String>,
    #[sqlx(json)]
    pub metadata: Option<Value>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestAccessDto {
    pub employee_id: Option<String>,
    pub inventory_id: String,
    pub project_id: Option<String>,
    pub access_level: Option<String>,
    pub grant_type: Option<String>,
    pub duration_hours: Option<i64>,
    pub justification: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAccessGrantDto {
    pub access_level: Option<String>,
    pub grant_type: Option<String>,
    pub status: Option<String>,
    pub justification: Option<String>,
    pub valid_from: Option<DateTime<Utc>>,
    pub valid_until: Option<DateTime<Utc>>,
    pub review_notes: Option<String>,
    pub revocation_reason: Option<String>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewNotesDto {
    pub notes: Option<String>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RevokeReasonDto {
    pub reason: Option<String>,
}
