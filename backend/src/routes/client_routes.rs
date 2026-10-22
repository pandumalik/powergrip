use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde_json::json;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::error::AppError;
use crate::models::{Client, CreateClientDto, CreateContractDto, UpdateClientDto};

pub fn router() -> Router<PgPool> {
    Router::new()
        .route("/clients", get(list_clients).post(create_client))
        .route(
            "/clients/:id",
            get(get_client).put(update_client).delete(delete_client),
        )
        .route(
            "/clients/:id/contracts",
            get(list_client_contracts).post(create_client_contract),
        )
}

pub async fn fetch_client_by_id(pool: &PgPool, id: Uuid) -> Result<Client, AppError> {
    let query = r#"
        SELECT 
            c.id, c.code, c.name, c.status::text as status, c.industry, c.billing_email, c.contact_phone,
            c.country, c.city, c.address, c.timezone, c.metadata, c.created_at, c.updated_at,
            COALESCE((
                SELECT json_agg(json_build_object(
                    'id', ct.id,
                    'clientId', ct.client_id,
                    'contractNumber', ct.contract_number,
                    'title', ct.title,
                    'contractType', ct.contract_type::text,
                    'startDate', ct.start_date,
                    'endDate', ct.end_date,
                    'slaLevel', ct.sla_level,
                    'status', ct.status::text,
                    'value', ct.value,
                    'currency', ct.currency,
                    'documentUrl', ct.document_url,
                    'createdAt', ct.created_at,
                    'updatedAt', ct.updated_at
                )) FROM contracts ct WHERE ct.client_id = c.id
            ), '[]'::json) AS contracts,
            COALESCE((
                SELECT json_agg(json_build_object(
                    'id', p.id,
                    'clientId', p.client_id,
                    'code', p.code,
                    'name', p.name,
                    'projectType', p.project_type::text,
                    'status', p.status::text,
                    'startDate', p.start_date,
                    'endDate', p.end_date,
                    'assignedMembers', p.assigned_members,
                    'tags', p.tags,
                    'createdAt', p.created_at,
                    'updatedAt', p.updated_at
                )) FROM projects p WHERE p.client_id = c.id
            ), '[]'::json) AS projects,
            COALESCE((
                SELECT json_agg(json_build_object(
                    'id', i.id,
                    'assetTag', i.asset_tag,
                    'name', i.name,
                    'assetScope', i.asset_scope::text,
                    'assetType', i.asset_type::text,
                    'environment', i.environment::text,
                    'status', i.status::text,
                    'provider', i.provider::text,
                    'region', i.region,
                    'primaryIp', host(i.primary_ip),
                    'specs', i.specs,
                    'createdAt', i.created_at,
                    'updatedAt', i.updated_at
                )) FROM inventories i WHERE i.client_id = c.id
            ), '[]'::json) AS inventories
        FROM clients c
        WHERE c.id = $1
    "#;

    sqlx::query_as::<_, Client>(query)
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Client with ID {} not found", id)))
}

async fn list_clients(State(pool): State<PgPool>) -> Result<Json<Vec<Client>>, AppError> {
    let query = r#"
        SELECT 
            c.id, c.code, c.name, c.status::text as status, c.industry, c.billing_email, c.contact_phone,
            c.country, c.city, c.address, c.timezone, c.metadata, c.created_at, c.updated_at,
            COALESCE((
                SELECT json_agg(json_build_object(
                    'id', ct.id,
                    'clientId', ct.client_id,
                    'contractNumber', ct.contract_number,
                    'title', ct.title,
                    'contractType', ct.contract_type::text,
                    'startDate', ct.start_date,
                    'endDate', ct.end_date,
                    'slaLevel', ct.sla_level,
                    'status', ct.status::text,
                    'value', ct.value,
                    'currency', ct.currency,
                    'documentUrl', ct.document_url,
                    'createdAt', ct.created_at,
                    'updatedAt', ct.updated_at
                )) FROM contracts ct WHERE ct.client_id = c.id
            ), '[]'::json) AS contracts,
            COALESCE((
                SELECT json_agg(json_build_object(
                    'id', p.id,
                    'clientId', p.client_id,
                    'code', p.code,
                    'name', p.name,
                    'projectType', p.project_type::text,
                    'status', p.status::text,
                    'startDate', p.start_date,
                    'endDate', p.end_date,
                    'assignedMembers', p.assigned_members,
                    'tags', p.tags,
                    'createdAt', p.created_at,
                    'updatedAt', p.updated_at
                )) FROM projects p WHERE p.client_id = c.id
            ), '[]'::json) AS projects
        FROM clients c
        ORDER BY c.created_at DESC
    "#;

    let rows = sqlx::query_as::<_, Client>(query)
        .fetch_all(&pool)
        .await?;

    Ok(Json(rows))
}

async fn get_client(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Client>, AppError> {
    let client = fetch_client_by_id(&pool, id).await?;
    Ok(Json(client))
}

async fn create_client(
    State(pool): State<PgPool>,
    Json(dto): Json<CreateClientDto>,
) -> Result<impl IntoResponse, AppError> {
    let code = dto
        .code
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| format!("CLI-{}", &Uuid::new_v4().to_string()[..8].to_uppercase()));

    let status = dto.status.unwrap_or_else(|| "ACTIVE".to_string());
    let country = dto.country.unwrap_or_else(|| "Indonesia".to_string());
    let timezone = dto.timezone.unwrap_or_else(|| "Asia/Jakarta".to_string());
    let billing_email = dto
        .billing_email
        .unwrap_or_else(|| "billing@client.com".to_string());
    let metadata = dto.metadata.unwrap_or_else(|| json!({}));

    let query = r#"
        INSERT INTO clients (code, name, status, industry, billing_email, contact_phone, country, city, address, timezone, metadata)
        VALUES ($1, $2, $3::client_status_enum, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
    "#;

    let row = sqlx::query(query)
        .bind(code)
        .bind(dto.name)
        .bind(status)
        .bind(dto.industry)
        .bind(billing_email)
        .bind(dto.contact_phone)
        .bind(country)
        .bind(dto.city)
        .bind(dto.address)
        .bind(timezone)
        .bind(metadata)
        .fetch_one(&pool)
        .await?;

    let new_id: Uuid = row.get("id");
    let full = fetch_client_by_id(&pool, new_id).await?;
    Ok((StatusCode::CREATED, Json(full)))
}

async fn update_client(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(dto): Json<UpdateClientDto>,
) -> Result<impl IntoResponse, AppError> {
    let update_query = r#"
        UPDATE clients SET
            code = COALESCE($2, code),
            name = COALESCE($3, name),
            status = COALESCE($4::client_status_enum, status),
            industry = COALESCE($5, industry),
            billing_email = COALESCE($6, billing_email),
            contact_phone = COALESCE($7, contact_phone),
            country = COALESCE($8, country),
            city = COALESCE($9, city),
            address = COALESCE($10, address),
            timezone = COALESCE($11, timezone),
            metadata = COALESCE($12, metadata),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id
    "#;

    let row = sqlx::query(update_query)
        .bind(id)
        .bind(dto.code)
        .bind(dto.name)
        .bind(dto.status)
        .bind(dto.industry)
        .bind(dto.billing_email)
        .bind(dto.contact_phone)
        .bind(dto.country)
        .bind(dto.city)
        .bind(dto.address)
        .bind(dto.timezone)
        .bind(dto.metadata)
        .fetch_optional(&pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Client with ID {} not found", id)))?;

    let updated_id: Uuid = row.get("id");
    let full = fetch_client_by_id(&pool, updated_id).await?;
    Ok(Json(full))
}

async fn delete_client(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let result = sqlx::query("DELETE FROM clients WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await;

    match result {
        Ok(res) => {
            if res.rows_affected() == 0 {
                return Err(AppError::NotFound(format!("Client with ID {} not found", id)));
            }
            Ok(Json(json!({ "success": true, "id": id })))
        }
        Err(err) => {
            if let sqlx::Error::Database(ref db_err) = err {
                if db_err.code().as_deref() == Some("23503") {
                    return Err(AppError::Conflict(
                        "Cannot delete client because it is linked to active contracts, projects, or infrastructure inventory assets. Remove or reassign them first.".to_string(),
                    ));
                }
            }
            Err(AppError::Database(err))
        }
    }
}

async fn list_client_contracts(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let query = r#"
        SELECT 
            id, client_id, contract_number, title, contract_type::text as contract_type,
            start_date, end_date, sla_level, status::text as status,
            to_json(value) as value, currency, document_url, created_at, updated_at
        FROM contracts
        WHERE client_id = $1
        ORDER BY created_at DESC
    "#;

    let rows = sqlx::query(query)
        .bind(id)
        .fetch_all(&pool)
        .await?;

    let contracts: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|row| {
            json!({
                "id": row.get::<Uuid, _>("id"),
                "clientId": row.get::<Uuid, _>("client_id"),
                "contractNumber": row.get::<String, _>("contract_number"),
                "title": row.get::<String, _>("title"),
                "contractType": row.get::<String, _>("contract_type"),
                "startDate": row.get::<chrono::NaiveDate, _>("start_date"),
                "endDate": row.get::<chrono::NaiveDate, _>("end_date"),
                "slaLevel": row.get::<String, _>("sla_level"),
                "status": row.get::<String, _>("status"),
                "value": row.get::<serde_json::Value, _>("value"),
                "currency": row.get::<String, _>("currency"),
                "documentUrl": row.get::<Option<String>, _>("document_url"),
                "createdAt": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
                "updatedAt": row.get::<chrono::DateTime<chrono::Utc>, _>("updated_at"),
            })
        })
        .collect();

    Ok(Json(contracts))
}

async fn create_client_contract(
    State(pool): State<PgPool>,
    Path(client_id): Path<Uuid>,
    Json(dto): Json<CreateContractDto>,
) -> Result<impl IntoResponse, AppError> {
    let contract_number = dto
        .contract_number
        .unwrap_or_else(|| format!("CTR-{}", &Uuid::new_v4().to_string()[..8].to_uppercase()));
    let contract_type = dto.contract_type.unwrap_or_else(|| "MANAGED_SERVICE".to_string());
    let sla_level = dto.sla_level.unwrap_or_else(|| "99.9% High Availability".to_string());
    let status = dto.status.unwrap_or_else(|| "ACTIVE".to_string());
    let currency = dto.currency.unwrap_or_else(|| "USD".to_string());
    let value = dto.value.unwrap_or(0.0);

    let query = r#"
        INSERT INTO contracts (client_id, contract_number, title, contract_type, start_date, end_date, sla_level, status, value, currency, document_url)
        VALUES ($1, $2, $3, $4::contract_type_enum, $5, $6, $7, $8::contract_status_enum, $9::numeric, $10, $11)
        RETURNING 
            id, client_id, contract_number, title, contract_type::text as contract_type,
            start_date, end_date, sla_level, status::text as status,
            to_json(value) as value, currency, document_url, created_at, updated_at
    "#;

    let row = sqlx::query(query)
        .bind(client_id)
        .bind(contract_number)
        .bind(dto.title)
        .bind(contract_type)
        .bind(dto.start_date)
        .bind(dto.end_date)
        .bind(sla_level)
        .bind(status)
        .bind(format!("{:.2}", value))
        .bind(currency)
        .bind(dto.document_url)
        .fetch_one(&pool)
        .await?;

    let contract = json!({
        "id": row.get::<Uuid, _>("id"),
        "clientId": row.get::<Uuid, _>("client_id"),
        "contractNumber": row.get::<String, _>("contract_number"),
        "title": row.get::<String, _>("title"),
        "contractType": row.get::<String, _>("contract_type"),
        "startDate": row.get::<chrono::NaiveDate, _>("start_date"),
        "endDate": row.get::<chrono::NaiveDate, _>("end_date"),
        "slaLevel": row.get::<String, _>("sla_level"),
        "status": row.get::<String, _>("status"),
        "value": row.get::<serde_json::Value, _>("value"),
        "currency": row.get::<String, _>("currency"),
        "documentUrl": row.get::<Option<String>, _>("document_url"),
        "createdAt": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
        "updatedAt": row.get::<chrono::DateTime<chrono::Utc>, _>("updated_at"),
    });

    Ok((StatusCode::CREATED, Json(contract)))
}
