use axum::{
    extract::{Path, State},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde_json::json;
use sqlx::PgPool;

use crate::error::AppError;
use crate::models::{AppendMiscDto, MiscEntry, SetMiscDto};

pub fn router() -> Router<PgPool> {
    Router::new()
        .route("/misc", get(list_misc))
        .route("/misc/:key", get(get_misc_key).post(set_misc_key))
        .route("/misc/:key/append", post(append_misc_key))
}

async fn list_misc(State(pool): State<PgPool>) -> Result<impl IntoResponse, AppError> {
    let query = "SELECT id, key, value, description, created_at, updated_at FROM misc ORDER BY key ASC";
    let rows = sqlx::query_as::<_, MiscEntry>(query)
        .fetch_all(&pool)
        .await?;

    Ok(Json(rows))
}

async fn get_misc_key(
    State(pool): State<PgPool>,
    Path(key): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let upper_key = key.to_uppercase();

    let query = "SELECT id, key, value, description, created_at, updated_at FROM misc WHERE key = $1";
    let entry = sqlx::query_as::<_, MiscEntry>(query)
        .bind(&upper_key)
        .fetch_optional(&pool)
        .await?;

    if let Some(e) = entry {
        return Ok(Json(e));
    }

    if upper_key == "INDUSTRIES" {
        let default_industries = json!([
            "Financial Services",
            "E-Commerce & Retail",
            "Healthcare & Pharma",
            "Telecommunications",
            "Logistics & Supply Chain",
            "Government & Public Sector",
            "Energy & Mining",
            "Media & Entertainment",
            "Software & SaaS"
        ]);

        return Ok(Json(MiscEntry {
            id: uuid::Uuid::nil(),
            key: "INDUSTRIES".to_string(),
            value: default_industries,
            description: Some("Default standard industry taxonomy".to_string()),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        }));
    }

    Err(AppError::NotFound(format!("Misc entry with key {} not found", key)))
}

async fn set_misc_key(
    State(pool): State<PgPool>,
    Path(key): Path<String>,
    Json(dto): Json<SetMiscDto>,
) -> Result<impl IntoResponse, AppError> {
    let upper_key = key.to_uppercase();

    let query = r#"
        INSERT INTO misc (key, value, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (key) DO UPDATE SET
            value = EXCLUDED.value,
            description = COALESCE(EXCLUDED.description, misc.description),
            updated_at = CURRENT_TIMESTAMP
        RETURNING id, key, value, description, created_at, updated_at
    "#;

    let updated = sqlx::query_as::<_, MiscEntry>(query)
        .bind(&upper_key)
        .bind(&dto.value)
        .bind(&dto.description)
        .fetch_one(&pool)
        .await?;

    Ok(Json(updated))
}

async fn append_misc_key(
    State(pool): State<PgPool>,
    Path(key): Path<String>,
    Json(dto): Json<AppendMiscDto>,
) -> Result<Json<MiscEntry>, AppError> {
    let upper_key = key.to_uppercase();

    // Check existing
    let existing_entry = sqlx::query_as::<_, MiscEntry>(
        "SELECT id, key, value, description, created_at, updated_at FROM misc WHERE key = $1",
    )
    .bind(&upper_key)
    .fetch_optional(&pool)
    .await?;

    let mut current_list = match existing_entry {
        Some(e) => e.value.as_array().cloned().unwrap_or_default(),
        None => {
            if upper_key == "INDUSTRIES" {
                vec![
                    json!("Financial Services"),
                    json!("E-Commerce & Retail"),
                    json!("Healthcare & Pharma"),
                    json!("Telecommunications"),
                    json!("Logistics & Supply Chain"),
                    json!("Government & Public Sector"),
                    json!("Energy & Mining"),
                    json!("Media & Entertainment"),
                    json!("Software & SaaS"),
                ]
            } else {
                Vec::new()
            }
        }
    };

    if !current_list.contains(&dto.item) {
        current_list.push(dto.item);
    }

    let updated_value = serde_json::Value::Array(current_list);

    let query = r#"
        INSERT INTO misc (key, value, description)
        VALUES ($1, $2, 'Dynamic taxonomy list')
        ON CONFLICT (key) DO UPDATE SET
            value = EXCLUDED.value,
            updated_at = CURRENT_TIMESTAMP
        RETURNING id, key, value, description, created_at, updated_at
    "#;

    let updated = sqlx::query_as::<_, MiscEntry>(query)
        .bind(&upper_key)
        .bind(updated_value)
        .fetch_one(&pool)
        .await?;

    Ok(Json(updated))
}
