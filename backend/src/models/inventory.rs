use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Inventory {
    pub id: Uuid,
    pub client_id: Option<Uuid>,
    pub project_id: Option<Uuid>,
    pub asset_tag: String,
    pub name: String,
    pub asset_scope: String,
    pub asset_type: String,
    pub environment: String,
    pub status: String,
    pub provider: String,
    pub region: String,
    pub primary_ip: Option<String>,
    #[sqlx(json)]
    pub specs: Value,
    #[sqlx(json)]
    pub connection_info: Value,
    #[sqlx(json)]
    pub tags: Option<Value>,
    #[serde(default)]
    #[sqlx(json)]
    #[sqlx(default)]
    pub client: Option<Value>,
    #[serde(default)]
    #[sqlx(json)]
    #[sqlx(default)]
    pub project: Option<Value>,
    #[serde(default)]
    #[sqlx(json)]
    #[sqlx(default)]
    pub access_grants: Option<Vec<Value>>,
    #[serde(default)]
    #[sqlx(json)]
    #[sqlx(default)]
    pub history: Option<Vec<Value>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CloudCredential {
    pub id: Uuid,
    pub name: String,
    pub provider: String,
    #[sqlx(json)]
    pub key_blob: Value,
    pub client_id: Option<Uuid>,
    #[sqlx(json)]
    pub metadata: Option<Value>,
    pub auto_scan_interval: String,
    pub is_active: bool,
    pub last_scanned_at: Option<DateTime<Utc>>,
    pub scan_status: String,
    pub last_scan_error: Option<String>,
    #[sqlx(json)]
    pub last_scan_summary: Option<Value>,
    #[serde(default)]
    #[sqlx(json)]
    #[sqlx(default)]
    pub client: Option<Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct InventoryHistory {
    pub id: Uuid,
    pub inventory_id: Uuid,
    pub service_account_id: Option<Uuid>,
    pub change_type: String,
    pub change_summary: String,
    #[sqlx(json)]
    pub previous_state: Option<Value>,
    #[sqlx(json)]
    pub new_state: Option<Value>,
    pub source: String,
    pub created_at: DateTime<Utc>,
    #[serde(default)]
    #[sqlx(json)]
    #[sqlx(default)]
    pub inventory: Option<Value>,
    #[serde(default)]
    #[sqlx(json)]
    #[sqlx(default)]
    pub service_account: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInventoryDto {
    pub client_id: Option<Uuid>,
    pub project_id: Option<Uuid>,
    pub asset_tag: Option<String>,
    pub name: String,
    pub asset_scope: Option<String>,
    pub asset_type: Option<String>,
    pub environment: Option<String>,
    pub status: Option<String>,
    pub provider: Option<String>,
    pub region: Option<String>,
    pub primary_ip: Option<String>,
    pub specs: Option<Value>,
    pub connection_info: Option<Value>,
    pub tags: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInventoryDto {
    pub client_id: Option<Uuid>,
    pub project_id: Option<Uuid>,
    pub asset_tag: Option<String>,
    pub name: Option<String>,
    pub asset_scope: Option<String>,
    pub asset_type: Option<String>,
    pub environment: Option<String>,
    pub status: Option<String>,
    pub provider: Option<String>,
    pub region: Option<String>,
    pub primary_ip: Option<String>,
    pub specs: Option<Value>,
    pub connection_info: Option<Value>,
    pub tags: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCloudCredentialDto {
    pub name: Option<String>,
    pub provider: Option<String>,
    pub key_blob: Value,
    pub client_id: Option<Uuid>,
    pub auto_scan_interval: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchCreateCloudCredentialDto {
    pub items: Vec<CreateCloudCredentialDto>,
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCloudCredentialDto {
    pub name: Option<String>,
    pub provider: Option<String>,
    pub key_blob: Option<Value>,
    pub client_id: Option<Uuid>,
    pub auto_scan_interval: Option<String>,
    pub is_active: Option<bool>,
    pub scan_status: Option<String>,
    pub last_scan_error: Option<String>,
    pub last_scan_summary: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoverCloudRequest {
    pub provider: Option<String>,
    pub credentials: Option<Value>,
    pub credential_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredResource {
    pub candidate_id: String,
    pub name: String,
    pub asset_tag: String,
    pub asset_type: String,
    pub provider: String,
    pub region: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub zone: Option<String>,
    pub primary_ip: String,
    pub specs: Value,
    pub cloud_metadata: Value,
    #[serde(default)]
    pub is_duplicate: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duplicate_reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub existing_asset_tag: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub existing_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoverCloudResponse {
    pub provider: String,
    pub project_id: Option<String>,
    pub account_email: Option<String>,
    pub discovered_count: usize,
    pub duplicate_count: usize,
    pub resources: Vec<DiscoveredResource>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkImportItem {
    pub name: String,
    pub asset_tag: Option<String>,
    pub asset_scope: Option<String>,
    pub asset_type: Option<String>,
    pub provider: Option<String>,
    pub region: Option<String>,
    pub primary_ip: Option<String>,
    pub client_id: Option<Uuid>,
    pub specs: Option<Value>,
    pub cloud_metadata: Option<Value>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkImportRequest {
    pub items: Vec<BulkImportItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DriftEvent {
    pub inventory_id: String,
    pub asset_tag: String,
    pub asset_name: String,
    pub change_type: String,
    pub change_summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReScanSummaryResult {
    pub credential_id: Uuid,
    pub credential_name: String,
    pub provider: String,
    pub project_id: Option<String>,
    pub scanned_at: String,
    pub total_discovered: usize,
    pub new_assets_count: usize,
    pub updated_assets_count: usize,
    pub unchanged_assets_count: usize,
    pub decommissioned_assets_count: usize,
    pub drift_events: Vec<DriftEvent>,
}
