use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Client {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub status: String,
    pub industry: Option<String>,
    pub billing_email: String,
    pub contact_phone: Option<String>,
    pub country: String,
    pub city: Option<String>,
    pub address: Option<String>,
    pub timezone: String,
    #[sqlx(json)]
    pub metadata: Option<Value>,
    #[serde(default)]
    #[sqlx(json)]
    #[sqlx(default)]
    pub contracts: Option<Vec<Contract>>,
    #[serde(default)]
    #[sqlx(json)]
    #[sqlx(default)]
    pub projects: Option<Vec<Value>>,
    #[serde(default)]
    #[sqlx(json)]
    #[sqlx(default)]
    pub inventories: Option<Vec<Value>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Contract {
    pub id: Uuid,
    pub client_id: Uuid,
    pub contract_number: String,
    pub title: String,
    pub contract_type: String,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub sla_level: String,
    pub status: String,
    #[sqlx(json)]
    pub value: Value,
    pub currency: String,
    pub document_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateClientDto {
    pub code: Option<String>,
    pub name: String,
    pub status: Option<String>,
    pub industry: Option<String>,
    pub billing_email: Option<String>,
    pub contact_phone: Option<String>,
    pub country: Option<String>,
    pub city: Option<String>,
    pub address: Option<String>,
    pub timezone: Option<String>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateClientDto {
    pub code: Option<String>,
    pub name: Option<String>,
    pub status: Option<String>,
    pub industry: Option<String>,
    pub billing_email: Option<String>,
    pub contact_phone: Option<String>,
    pub country: Option<String>,
    pub city: Option<String>,
    pub address: Option<String>,
    pub timezone: Option<String>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateContractDto {
    pub contract_number: Option<String>,
    pub title: String,
    pub contract_type: Option<String>,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub sla_level: Option<String>,
    pub status: Option<String>,
    pub value: Option<f64>,
    pub currency: Option<String>,
    pub document_url: Option<String>,
}
