use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, patch, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::error::AppError;
use crate::models::{
    BulkImportRequest, CreateInventoryDto, DiscoverCloudRequest, DiscoverCloudResponse,
    DiscoveredResource, Inventory, InventoryHistory, UpdateInventoryDto,
};
use crate::services::GcpDiscoveryEngine;

#[derive(Debug, Deserialize)]
pub struct InventoryFilterQuery {
    pub scope: Option<String>,
    pub r#type: Option<String>,
    pub provider: Option<String>,
    #[serde(rename = "clientId")]
    pub client_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct HistoryQuery {
    pub limit: Option<i64>,
}

pub fn router() -> Router<PgPool> {
    Router::new()
        .route("/inventories", get(list_inventories).post(create_inventory))
        .route("/inventories/discover-cloud", post(discover_cloud))
        .route("/inventories/bulk-import", post(bulk_import))
        .route("/inventories/history/recent", get(get_recent_history))
        .route(
            "/inventories/:id",
            get(get_inventory)
                .put(update_inventory)
                .delete(delete_inventory),
        )
        .route("/inventories/:id/specs", patch(update_specs))
        .route("/inventories/:id/status", patch(update_status))
        .route("/inventories/:id/history", get(get_inventory_history))
}

async fn list_inventories(
    State(pool): State<PgPool>,
    Query(filters): Query<InventoryFilterQuery>,
) -> Result<impl IntoResponse, AppError> {
    let query = r#"
        SELECT 
            i.id, i.client_id, i.project_id, i.asset_tag, i.name,
            i.asset_scope::text as asset_scope, i.asset_type::text as asset_type,
            i.environment::text as environment, i.status::text as status,
            i.provider::text as provider, i.region, host(i.primary_ip) as primary_ip,
            i.specs, i.connection_info, i.tags, i.created_at, i.updated_at,
            COALESCE((
                SELECT to_json(c) FROM (
                    SELECT id, code, name, status::text as status, billing_email, country
                    FROM clients WHERE id = i.client_id
                ) c
            )::json, 'null'::json) AS client,
            COALESCE((
                SELECT to_json(p) FROM (
                    SELECT id, code, name, project_type::text as project_type, status::text as status
                    FROM projects WHERE id = i.project_id
                ) p
            )::json, 'null'::json) AS project,
            COALESCE((
                SELECT json_agg(json_build_object(
                    'id', ag.id,
                    'employeeId', ag.employee_id,
                    'accessLevel', ag.access_level::text,
                    'status', ag.status::text,
                    'validFrom', ag.valid_from,
                    'validUntil', ag.valid_until
                )) FROM access_grants ag WHERE ag.inventory_id = i.id
            ), '[]'::json) AS access_grants,
            COALESCE((
                SELECT json_agg(json_build_object(
                    'id', h.id,
                    'changeType', h.change_type,
                    'changeSummary', h.change_summary,
                    'previousState', h.previous_state,
                    'newState', h.new_state,
                    'source', h.source,
                    'createdAt', h.created_at
                ) ORDER BY h.created_at DESC) FROM (
                    SELECT * FROM inventory_history WHERE inventory_id = i.id ORDER BY created_at DESC LIMIT 10
                ) h
            ), '[]'::json) AS history
        FROM inventories i
        WHERE ($1::text IS NULL OR i.asset_scope::text = $1)
          AND ($2::text IS NULL OR i.asset_type::text = $2)
          AND ($3::text IS NULL OR i.provider::text = $3)
          AND ($4::uuid IS NULL OR i.client_id = $4)
        ORDER BY i.created_at DESC
    "#;

    let rows = sqlx::query_as::<_, Inventory>(query)
        .bind(filters.scope)
        .bind(filters.r#type)
        .bind(filters.provider)
        .bind(filters.client_id)
        .fetch_all(&pool)
        .await?;

    Ok(Json(rows))
}

pub async fn fetch_inventory_by_id(
    pool: &PgPool,
    id: Uuid,
) -> Result<Inventory, AppError> {
    let query = r#"
        SELECT 
            i.id, i.client_id, i.project_id, i.asset_tag, i.name,
            i.asset_scope::text as asset_scope, i.asset_type::text as asset_type,
            i.environment::text as environment, i.status::text as status,
            i.provider::text as provider, i.region, host(i.primary_ip) as primary_ip,
            i.specs, i.connection_info, i.tags, i.created_at, i.updated_at,
            COALESCE((
                SELECT to_json(c) FROM (
                    SELECT id, code, name, status::text as status, billing_email, country
                    FROM clients WHERE id = i.client_id
                ) c
            )::json, 'null'::json) AS client,
            COALESCE((
                SELECT to_json(p) FROM (
                    SELECT id, code, name, project_type::text as project_type, status::text as status
                    FROM projects WHERE id = i.project_id
                ) p
            )::json, 'null'::json) AS project,
            COALESCE((
                SELECT json_agg(json_build_object(
                    'id', ag.id,
                    'employeeId', ag.employee_id,
                    'accessLevel', ag.access_level::text,
                    'status', ag.status::text,
                    'validFrom', ag.valid_from,
                    'validUntil', ag.valid_until
                )) FROM access_grants ag WHERE ag.inventory_id = i.id
            ), '[]'::json) AS access_grants,
            COALESCE((
                SELECT json_agg(json_build_object(
                    'id', h.id,
                    'changeType', h.change_type,
                    'changeSummary', h.change_summary,
                    'previousState', h.previous_state,
                    'newState', h.new_state,
                    'source', h.source,
                    'createdAt', h.created_at
                ) ORDER BY h.created_at DESC) FROM (
                    SELECT * FROM inventory_history WHERE inventory_id = i.id ORDER BY created_at DESC LIMIT 25
                ) h
            ), '[]'::json) AS history
        FROM inventories i
        WHERE i.id = $1
    "#;

    sqlx::query_as::<_, Inventory>(query)
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Inventory item {} not found", id)))
}

async fn get_inventory(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Inventory>, AppError> {
    let item = fetch_inventory_by_id(&pool, id).await?;
    Ok(Json(item))
}

async fn create_inventory(
    State(pool): State<PgPool>,
    Json(dto): Json<CreateInventoryDto>,
) -> Result<impl IntoResponse, AppError> {
    let asset_tag = dto
        .asset_tag
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| format!("INV-{}", &Uuid::new_v4().to_string()[..8].to_uppercase()));

    let asset_scope = dto.asset_scope.unwrap_or_else(|| "CLIENT".to_string());
    let asset_type = dto.asset_type.unwrap_or_else(|| "VIRTUAL_MACHINE".to_string());
    let environment = dto.environment.unwrap_or_else(|| "PROD".to_string());
    let status = dto.status.unwrap_or_else(|| "ACTIVE".to_string());
    let provider = dto.provider.unwrap_or_else(|| "AWS".to_string());
    let region = dto.region.unwrap_or_else(|| "ap-southeast-1".to_string());
    let specs = dto.specs.unwrap_or_else(|| json!({ "cpu_cores": 4, "ram_gb": 16, "disk_gb": 100 }));
    let connection_info = dto.connection_info.unwrap_or_else(|| json!({ "ssh_port": 22 }));
    let tags = dto.tags.unwrap_or_else(|| json!({}));

    // If INTERNAL, client_id is null; else fallback to first client if not provided
    let client_id = if asset_scope == "INTERNAL" {
        None
    } else if let Some(cid) = dto.client_id {
        Some(cid)
    } else {
        let row = sqlx::query("SELECT id FROM clients ORDER BY created_at ASC LIMIT 1")
            .fetch_optional(&pool)
            .await?;
        row.map(|r| r.get::<Uuid, _>("id"))
    };

    let query = r#"
        INSERT INTO inventories (
            client_id, project_id, asset_tag, name,
            asset_scope, asset_type, environment, status,
            provider, region, primary_ip, specs, connection_info, tags
        )
        VALUES (
            $1, $2, $3, $4,
            $5::asset_scope_enum, $6::asset_type_enum, $7::environment_enum, $8::asset_status_enum,
            $9::cloud_provider_enum, $10, $11::inet, $12, $13, $14
        )
        RETURNING id
    "#;

    let row = sqlx::query(query)
        .bind(client_id)
        .bind(dto.project_id)
        .bind(&asset_tag)
        .bind(&dto.name)
        .bind(&asset_scope)
        .bind(&asset_type)
        .bind(&environment)
        .bind(&status)
        .bind(&provider)
        .bind(&region)
        .bind(dto.primary_ip.as_deref().unwrap_or("10.0.0.1"))
        .bind(&specs)
        .bind(&connection_info)
        .bind(&tags)
        .fetch_one(&pool)
        .await?;

    let new_id: Uuid = row.get("id");

    // Write creation record to inventory_history
    let _ = sqlx::query(
        r#"
        INSERT INTO inventory_history (inventory_id, change_type, change_summary, new_state, source)
        VALUES ($1, 'CREATED', $2, $3, 'MANUAL')
        "#,
    )
    .bind(new_id)
    .bind(format!("Asset registered: {} ({}) [{} {}]", dto.name, asset_tag, provider, asset_type))
    .bind(json!({
        "name": dto.name,
        "assetTag": asset_tag,
        "assetType": asset_type,
        "provider": provider,
        "region": region,
        "specs": specs,
        "status": status,
    }))
    .execute(&pool)
    .await;

    let full = fetch_inventory_by_id(&pool, new_id).await?;
    Ok((StatusCode::CREATED, Json(full)))
}

async fn update_inventory(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(dto): Json<UpdateInventoryDto>,
) -> Result<impl IntoResponse, AppError> {
    let query = r#"
        UPDATE inventories SET
            client_id = COALESCE($2, client_id),
            project_id = COALESCE($3, project_id),
            asset_tag = COALESCE($4, asset_tag),
            name = COALESCE($5, name),
            asset_scope = COALESCE($6::asset_scope_enum, asset_scope),
            asset_type = COALESCE($7::asset_type_enum, asset_type),
            environment = COALESCE($8::environment_enum, environment),
            status = COALESCE($9::asset_status_enum, status),
            provider = COALESCE($10::cloud_provider_enum, provider),
            region = COALESCE($11, region),
            primary_ip = COALESCE($12::inet, primary_ip),
            specs = COALESCE($13, specs),
            connection_info = COALESCE($14, connection_info),
            tags = COALESCE($15, tags),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id
    "#;

    let updated = sqlx::query(query)
        .bind(id)
        .bind(dto.client_id)
        .bind(dto.project_id)
        .bind(dto.asset_tag)
        .bind(dto.name)
        .bind(dto.asset_scope)
        .bind(dto.asset_type)
        .bind(dto.environment)
        .bind(dto.status)
        .bind(dto.provider)
        .bind(dto.region)
        .bind(dto.primary_ip)
        .bind(dto.specs)
        .bind(dto.connection_info)
        .bind(dto.tags)
        .fetch_optional(&pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Inventory item {} not found", id)))?;

    let updated_id: Uuid = updated.get("id");
    let full = fetch_inventory_by_id(&pool, updated_id).await?;
    Ok(Json(full))
}

#[derive(Debug, Deserialize)]
struct UpdateSpecsDto {
    specs: Value,
}

async fn update_specs(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(dto): Json<UpdateSpecsDto>,
) -> Result<impl IntoResponse, AppError> {
    let row = sqlx::query("SELECT specs FROM inventories WHERE id = $1")
        .bind(id)
        .fetch_optional(&pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Inventory item {} not found", id)))?;

    let mut current_specs: Value = row.get("specs");
    if let (Some(cur_obj), Some(new_obj)) = (current_specs.as_object_mut(), dto.specs.as_object()) {
        for (k, v) in new_obj {
            cur_obj.insert(k.clone(), v.clone());
        }
    } else {
        current_specs = dto.specs.clone();
    }

    sqlx::query("UPDATE inventories SET specs = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1")
        .bind(id)
        .bind(&current_specs)
        .execute(&pool)
        .await?;

    let _ = sqlx::query(
        r#"
        INSERT INTO inventory_history (inventory_id, change_type, change_summary, new_state, source)
        VALUES ($1, 'SPECS_CHANGED', 'Resource specifications updated', $2, 'MANUAL_EDIT')
        "#,
    )
    .bind(id)
    .bind(&current_specs)
    .execute(&pool)
    .await;

    let full = fetch_inventory_by_id(&pool, id).await?;
    Ok(Json(full))
}

#[derive(Debug, Deserialize)]
struct UpdateStatusDto {
    status: String,
}

async fn update_status(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(dto): Json<UpdateStatusDto>,
) -> Result<impl IntoResponse, AppError> {
    sqlx::query("UPDATE inventories SET status = $2::asset_status_enum, updated_at = CURRENT_TIMESTAMP WHERE id = $1")
        .bind(id)
        .bind(&dto.status)
        .execute(&pool)
        .await?;

    let _ = sqlx::query(
        r#"
        INSERT INTO inventory_history (inventory_id, change_type, change_summary, new_state, source)
        VALUES ($1, 'STATUS_CHANGED', $2, $3, 'MANUAL_EDIT')
        "#,
    )
    .bind(id)
    .bind(format!("Status changed to {}", dto.status))
    .bind(json!({ "status": dto.status }))
    .execute(&pool)
    .await;

    let full = fetch_inventory_by_id(&pool, id).await?;
    Ok(Json(full))
}

async fn delete_inventory(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let result = sqlx::query("DELETE FROM inventories WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await;

    match result {
        Ok(res) => {
            if res.rows_affected() == 0 {
                return Err(AppError::NotFound(format!("Inventory item {} not found", id)));
            }
            Ok(Json(json!({ "success": true, "id": id })))
        }
        Err(err) => {
            if let sqlx::Error::Database(ref db_err) = err {
                if db_err.code().as_deref() == Some("23503") {
                    return Err(AppError::Conflict(
                        "Cannot delete this inventory resource because it is actively referenced by privileged access grants or immutable compliance audit logs. Revoke active access grants or decommission the asset instead.".to_string(),
                    ));
                }
            }
            Err(AppError::Database(err))
        }
    }
}

async fn discover_cloud(
    State(pool): State<PgPool>,
    Json(payload): Json<DiscoverCloudRequest>,
) -> Result<impl IntoResponse, AppError> {
    let mut provider = payload.provider.unwrap_or_else(|| "GCP".to_string());
    let mut creds = payload.credentials.unwrap_or_else(|| json!({}));

    if let Some(cred_id) = payload.credential_id {
        let row = sqlx::query("SELECT provider::text as provider, key_blob FROM cloud_credentials WHERE id = $1")
            .bind(cred_id)
            .fetch_optional(&pool)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Cloud credential {} not found", cred_id)))?;

        provider = row.get("provider");
        creds = row.get("key_blob");
    }

    let (project_id, account_email, candidate_pool) = GcpDiscoveryEngine::discover_assets(&provider, &creds)
        .await
        .map_err(AppError::BadRequest)?;

    // Check duplicates against database
    let existing_rows = sqlx::query("SELECT id, asset_tag, name, host(primary_ip) as primary_ip FROM inventories")
        .fetch_all(&pool)
        .await?;

    let mut duplicate_count = 0;
    let mut processed_resources: Vec<DiscoveredResource> = Vec::new();

    for mut candidate in candidate_pool {
        let candidate_name_clean = candidate.name.trim().to_lowercase();
        let candidate_tag_clean = candidate.asset_tag.trim().to_lowercase();
        let candidate_ip_clean = candidate.primary_ip.trim();

        let mut matched_existing: Option<(Uuid, String, String, Option<String>)> = None;

        for r in &existing_rows {
            let id: Uuid = r.get("id");
            let tag: String = r.get("asset_tag");
            let name: String = r.get("name");
            let ip: Option<String> = r.get("primary_ip");

            let name_match = !candidate_name_clean.is_empty() && name.trim().eq_ignore_ascii_case(&candidate_name_clean);
            let tag_match = !candidate_tag_clean.is_empty() && tag.trim().eq_ignore_ascii_case(&candidate_tag_clean);
            let ip_match = candidate_ip_clean != "10.0.0.1" && ip.as_deref() == Some(candidate_ip_clean);

            if name_match || tag_match || ip_match {
                matched_existing = Some((id, tag, name, ip));
                break;
            }
        }

        if let Some((ex_id, ex_tag, ex_name, ex_ip)) = matched_existing {
            duplicate_count += 1;
            candidate.is_duplicate = true;
            let reason = if ex_ip.as_deref() == Some(candidate_ip_clean) {
                format!("Matches IP {} (\"{}\")", candidate_ip_clean, ex_name)
            } else {
                format!("Matches existing asset \"{}\"", ex_name)
            };
            candidate.duplicate_reason = Some(reason);
            candidate.existing_asset_tag = Some(ex_tag);
            candidate.existing_id = Some(ex_id.to_string());
        }

        processed_resources.push(candidate);
    }

    let resp = DiscoverCloudResponse {
        provider,
        project_id: Some(project_id),
        account_email: Some(account_email),
        discovered_count: processed_resources.len(),
        duplicate_count,
        resources: processed_resources,
    };

    Ok(Json(resp))
}

async fn bulk_import(
    State(pool): State<PgPool>,
    Json(payload): Json<BulkImportRequest>,
) -> Result<impl IntoResponse, AppError> {
    if payload.items.is_empty() {
        return Err(AppError::BadRequest("No items specified for bulk import".to_string()));
    }

    let mut imported = Vec::new();

    for item in payload.items {
        let tag = item.asset_tag.unwrap_or_else(|| {
            format!("AST-{}-{}", item.provider.as_deref().unwrap_or("CLOUD"), &Uuid::new_v4().to_string()[..6].to_uppercase())
        });
        let scope = item.asset_scope.unwrap_or_else(|| "CLIENT".to_string());
        let a_type = item.asset_type.unwrap_or_else(|| "VIRTUAL_MACHINE".to_string());
        let prov = item.provider.unwrap_or_else(|| "GCP".to_string());
        let reg = item.region.unwrap_or_else(|| "asia-southeast2".to_string());
        let ip = item.primary_ip.unwrap_or_else(|| "10.0.0.1".to_string());
        let specs = item.specs.unwrap_or_else(|| json!({ "cpu_cores": 4, "ram_gb": 16, "disk_gb": 100 }));
        let tags = json!(item.tags.unwrap_or_else(|| vec![prov.clone(), "Cloud-Imported".to_string()]));
        let conn_info = json!({
            "ssh_port": 22,
            "bastion_required": true,
            "cloud_metadata": item.cloud_metadata.unwrap_or_else(|| json!({}))
        });

        let client_id = if scope == "CLIENT" { item.client_id } else { None };

        let query = r#"
            INSERT INTO inventories (
                client_id, asset_tag, name, asset_scope, asset_type,
                environment, status, provider, region, primary_ip,
                specs, connection_info, tags
            )
            VALUES (
                $1, $2, $3, $4::asset_scope_enum, $5::asset_type_enum,
                'PROD'::environment_enum, 'ACTIVE'::asset_status_enum, $6::cloud_provider_enum, $7, $8::inet,
                $9, $10, $11
            )
            RETURNING id
        "#;

        let row = sqlx::query(query)
            .bind(client_id)
            .bind(&tag)
            .bind(&item.name)
            .bind(&scope)
            .bind(&a_type)
            .bind(&prov)
            .bind(&reg)
            .bind(&ip)
            .bind(&specs)
            .bind(&conn_info)
            .bind(&tags)
            .fetch_one(&pool)
            .await?;

        let new_id: Uuid = row.get("id");

        let _ = sqlx::query(
            r#"
            INSERT INTO inventory_history (inventory_id, change_type, change_summary, new_state, source)
            VALUES ($1, 'CREATED', $2, $3, 'CLOUD_IMPORT')
            "#,
        )
        .bind(new_id)
        .bind(format!("Cloud Asset imported: {} ({}) [{}]", item.name, tag, prov))
        .bind(json!({
            "name": item.name,
            "assetTag": tag,
            "provider": prov,
            "region": reg,
            "primaryIp": ip,
            "specs": specs,
        }))
        .execute(&pool)
        .await;

        let full = fetch_inventory_by_id(&pool, new_id).await?;
        imported.push(full);
    }

    Ok(Json(json!({
        "importedCount": imported.len(),
        "items": imported
    })))
}

async fn get_inventory_history(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let query = r#"
        SELECT 
            h.id, h.inventory_id, h.service_account_id, h.change_type, h.change_summary,
            h.previous_state, h.new_state, h.source, h.created_at,
            (
                SELECT to_json(cc) FROM (
                    SELECT id, name, provider::text as provider FROM cloud_credentials WHERE id = h.service_account_id
                ) cc
            ) as service_account
        FROM inventory_history h
        WHERE h.inventory_id = $1
        ORDER BY h.created_at DESC
    "#;

    let rows = sqlx::query_as::<_, InventoryHistory>(query)
        .bind(id)
        .fetch_all(&pool)
        .await?;

    Ok(Json(rows))
}

async fn get_recent_history(
    State(pool): State<PgPool>,
    Query(query_params): Query<HistoryQuery>,
) -> Result<impl IntoResponse, AppError> {
    let limit = query_params.limit.unwrap_or(50);

    let query = r#"
        SELECT 
            h.id, h.inventory_id, h.service_account_id, h.change_type, h.change_summary,
            h.previous_state, h.new_state, h.source, h.created_at,
            (
                SELECT to_json(i) FROM (
                    SELECT id, asset_tag, name, provider::text as provider, region, host(primary_ip) as primary_ip
                    FROM inventories WHERE id = h.inventory_id
                ) i
            ) as inventory,
            (
                SELECT to_json(cc) FROM (
                    SELECT id, name, provider::text as provider FROM cloud_credentials WHERE id = h.service_account_id
                ) cc
            ) as service_account
        FROM inventory_history h
        ORDER BY h.created_at DESC
        LIMIT $1
    "#;

    let rows = sqlx::query_as::<_, InventoryHistory>(query)
        .bind(limit)
        .fetch_all(&pool)
        .await?;

    Ok(Json(rows))
}
