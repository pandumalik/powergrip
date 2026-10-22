use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
#[serde(rename_all = "camelCase")]
pub struct AssignedMember {
    pub employee_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assigned_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: Uuid,
    pub client_id: Uuid,
    pub contract_id: Option<Uuid>,
    pub project_manager_id: Option<Uuid>,
    pub code: String,
    pub name: String,
    pub project_type: String,
    pub status: String,
    pub start_date: NaiveDate,
    pub end_date: Option<NaiveDate>,
    pub description: Option<String>,
    #[serde(default)]
    #[sqlx(json)]
    pub assigned_members: Value,
    #[sqlx(json)]
    pub tags: Option<Value>,
    pub version: i32,
    #[serde(default)]
    #[sqlx(json)]
    #[sqlx(default)]
    pub client: Option<Value>,
    #[serde(default)]
    #[sqlx(json)]
    #[sqlx(default)]
    pub contract: Option<Value>,
    #[serde(default)]
    #[sqlx(json)]
    #[sqlx(default)]
    pub project_manager: Option<Value>,
    #[serde(default)]
    #[sqlx(json)]
    #[sqlx(default)]
    pub inventories: Option<Vec<Value>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectDto {
    pub client_id: Option<Uuid>,
    pub contract_id: Option<Uuid>,
    pub project_manager_id: Option<Uuid>,
    pub code: Option<String>,
    pub name: String,
    pub project_type: Option<String>,
    pub status: Option<String>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub description: Option<String>,
    pub assigned_members: Option<Value>,
    pub tags: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProjectDto {
    pub client_id: Option<Uuid>,
    pub contract_id: Option<Uuid>,
    pub project_manager_id: Option<Uuid>,
    pub code: Option<String>,
    pub name: Option<String>,
    pub project_type: Option<String>,
    pub status: Option<String>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub description: Option<String>,
    pub assigned_members: Option<Value>,
    pub tags: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssignMemberDto {
    pub employee_id: String,
    pub role: String,
}
