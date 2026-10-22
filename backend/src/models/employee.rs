use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Employee {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub manager_id: Option<Uuid>,
    pub employee_number: String,
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub job_title: String,
    pub hierarchy_path: Option<String>,
    pub employment_status: String,
    pub join_date: NaiveDate,
    pub exit_date: Option<NaiveDate>,
    #[sqlx(json)]
    pub metadata: Option<Value>,
    #[serde(default)]
    #[sqlx(json)]
    #[sqlx(default)]
    pub department: Option<Value>,
    #[serde(default)]
    #[sqlx(json)]
    #[sqlx(default)]
    pub manager: Option<Value>,
    #[serde(default)]
    #[sqlx(json)]
    #[sqlx(default)]
    pub access_grants: Option<Vec<Value>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Department {
    pub id: Uuid,
    pub parent_id: Option<Uuid>,
    pub code: String,
    pub name: String,
    pub head_of_department_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEmployeeDto {
    pub user_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub manager_id: Option<Uuid>,
    pub employee_number: Option<String>,
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub job_title: String,
    pub employment_status: Option<String>,
    pub join_date: Option<NaiveDate>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEmployeeDto {
    pub user_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub manager_id: Option<Uuid>,
    pub employee_number: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub job_title: Option<String>,
    pub employment_status: Option<String>,
    pub join_date: Option<NaiveDate>,
    pub exit_date: Option<NaiveDate>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OffboardEmployeeDto {
    pub exit_date: Option<NaiveDate>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDepartmentDto {
    pub code: String,
    pub name: String,
    pub parent_id: Option<Uuid>,
    pub head_of_department_id: Option<Uuid>,
}
