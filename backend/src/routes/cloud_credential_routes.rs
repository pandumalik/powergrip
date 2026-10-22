use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use serde_json::{json, Value};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::error::AppError;
use crate::models::{
    BatchCreateCloudCredentialDto, CloudCredential, CreateCloudCredentialDto, DriftEvent,
    ReScanSummaryResult, UpdateCloudCredentialDto,
};
use crate::services::GcpDiscoveryEngine;

pub fn router() -> Router<PgPool> {
    Router::new()
        .route(
            "/cloud-credentials",
            get(list_credentials).post(create_credential),
        )
        .route("/cloud-credentials/batch", post(batch_create_credentials))
        .route("/cloud-credentials/scan-all", post(scan_all_credentials))
        .route(
            "/cloud-credentials/:id",
            get(get_credential)
                .put(update_credential)
                .delete(delete_credential),
        )
        .route("/cloud-credentials/:id/scan", post(scan_credential))
}

fn mask_key_blob(blob: &Value) -> Value {
    let mut masked = blob.clone();
    if let Some(obj) = masked.as_object_mut() {
        if obj.contains_key("private_key") {
            obj.insert(
                "private_key".to_string(),
                json!("-----BEGIN PRIVATE KEY-----\n[SECURE_CREDENTIAL_BLOB_STORED_IN_VAULT]\n-----END PRIVATE KEY-----"),
            );
        }
        if obj.contains_key("secret_access_key") {
            obj.insert(
                "secret_access_key".to_string(),
                json!("********************************"),
            );
        }
        if obj.contains_key("client_secret") {
            obj.insert(
                "client_secret".to_string(),
                json!("********************************"),
            );
        }
    }
    masked
}

fn extract_metadata(key_blob: &Value, explicit_provider: Option<&str>) -> (String, Value) {
    let mut provider = explicit_provider.unwrap_or("GCP").to_string();
    let mut project_id = "cloud-project".to_string();
    let mut account_email = "service-account".to_string();
    let mut key_type = "service_account".to_string();

    if let Some(obj) = key_blob.as_object() {
        if obj.get("type").and_then(|v| v.as_str()) == Some("service_account")
            || obj.contains_key("private_key_id")
        {
            provider = "GCP".to_string();
            project_id = obj
                .get("project_id")
                .and_then(|v| v.as_str())
                .unwrap_or("gcp-project")
                .to_string();
            account_email = obj
                .get("client_email")
                .and_then(|v| v.as_str())
                .unwrap_or("sa@iam.gserviceaccount.com")
                .to_string();
            key_type = "gcp_service_account".to_string();
        } else if obj.contains_key("aws_access_key_id") || obj.contains_key("access_key_id") {
            provider = "AWS".to_string();
            project_id = obj
                .get("account_id")
                .and_then(|v| v.as_str())
                .unwrap_or("aws-account")
                .to_string();
            account_email = obj
                .get("access_key_id")
                .and_then(|v| v.as_str())
                .unwrap_or("AWS_IAM_CREDENTIAL")
                .to_string();
            key_type = "aws_iam_key".to_string();
        }
    }

    let meta = json!({
        "projectId": project_id,
        "accountEmail": account_email,
        "keyType": key_type,
        "importedAt": Utc::now().to_rfc3339()
    });

    (provider, meta)
}

async fn list_credentials(State(pool): State<PgPool>) -> Result<impl IntoResponse, AppError> {
    let query = r#"
        SELECT 
            cc.id, cc.name, cc.provider::text as provider, cc.key_blob, cc.client_id,
            cc.metadata, cc.auto_scan_interval, (cc.is_active = 1) as is_active,
            cc.last_scanned_at, cc.scan_status, cc.last_scan_error, cc.last_scan_summary,
            cc.created_at, cc.updated_at,
            COALESCE((
                SELECT to_json(c) FROM (
                    SELECT id, code, name FROM clients WHERE id = cc.client_id
                ) c
            )::json, 'null'::json) AS client
        FROM cloud_credentials cc
        ORDER BY cc.created_at DESC
    "#;

    let mut rows = sqlx::query_as::<_, CloudCredential>(query)
        .fetch_all(&pool)
        .await?;

    for item in &mut rows {
        item.key_blob = mask_key_blob(&item.key_blob);
    }

    Ok(Json(rows))
}

async fn get_credential(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let query = r#"
        SELECT 
            cc.id, cc.name, cc.provider::text as provider, cc.key_blob, cc.client_id,
            cc.metadata, cc.auto_scan_interval, (cc.is_active = 1) as is_active,
            cc.last_scanned_at, cc.scan_status, cc.last_scan_error, cc.last_scan_summary,
            cc.created_at, cc.updated_at,
            COALESCE((
                SELECT to_json(c) FROM (
                    SELECT id, code, name FROM clients WHERE id = cc.client_id
                ) c
            )::json, 'null'::json) AS client
        FROM cloud_credentials cc
        WHERE cc.id = $1
    "#;

    let mut item = sqlx::query_as::<_, CloudCredential>(query)
        .bind(id)
        .fetch_optional(&pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Cloud credential {} not found", id)))?;

    item.key_blob = mask_key_blob(&item.key_blob);
    Ok(Json(item))
}

async fn create_credential(
    State(pool): State<PgPool>,
    Json(dto): Json<CreateCloudCredentialDto>,
) -> Result<impl IntoResponse, AppError> {
    let (detected_provider, meta) =
        extract_metadata(&dto.key_blob, dto.provider.as_deref());
    let provider = dto.provider.unwrap_or(detected_provider);

    let name = dto.name.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| {
        let proj = meta
            .get("projectId")
            .and_then(|v| v.as_str())
            .unwrap_or("cloud");
        let sa = meta
            .get("accountEmail")
            .and_then(|v| v.as_str())
            .unwrap_or("key");
        format!("{}-{}.json", proj, sa.split('@').next().unwrap_or("sa"))
    });

    let auto_scan_interval = dto.auto_scan_interval.unwrap_or_else(|| "1h".to_string());
    let is_active_int: i32 = if dto.is_active.unwrap_or(true) { 1 } else { 0 };

    let query = r#"
        INSERT INTO cloud_credentials (
            name, provider, key_blob, client_id, metadata,
            auto_scan_interval, is_active, scan_status, last_scan_summary
        )
        VALUES (
            $1, $2::cloud_provider_enum, $3, $4, $5,
            $6, $7, 'IDLE', '{}'::jsonb
        )
        RETURNING id
    "#;

    let row = sqlx::query(query)
        .bind(name)
        .bind(provider)
        .bind(&dto.key_blob)
        .bind(dto.client_id)
        .bind(meta)
        .bind(auto_scan_interval)
        .bind(is_active_int)
        .fetch_one(&pool)
        .await?;

    let new_id: Uuid = row.get("id");
    let full = get_credential(State(pool), Path(new_id)).await?;
    Ok((StatusCode::CREATED, full))
}

async fn batch_create_credentials(
    State(pool): State<PgPool>,
    Json(payload): Json<BatchCreateCloudCredentialDto>,
) -> Result<impl IntoResponse, AppError> {
    if payload.items.is_empty() {
        return Err(AppError::BadRequest("No credentials provided for batch import".to_string()));
    }

    let mut created = Vec::new();

    for item in payload.items {
        let (detected_provider, meta) =
            extract_metadata(&item.key_blob, item.provider.as_deref());
        let provider = item.provider.unwrap_or(detected_provider);

        let name = item.name.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| {
            let proj = meta
                .get("projectId")
                .and_then(|v| v.as_str())
                .unwrap_or("cloud");
            format!("{}-key.json", proj)
        });

        let auto_scan_interval = item.auto_scan_interval.unwrap_or_else(|| "1h".to_string());
        let is_active_int: i32 = if item.is_active.unwrap_or(true) { 1 } else { 0 };

        let query = r#"
            INSERT INTO cloud_credentials (
                name, provider, key_blob, client_id, metadata,
                auto_scan_interval, is_active, scan_status, last_scan_summary
            )
            VALUES (
                $1, $2::cloud_provider_enum, $3, $4, $5,
                $6, $7, 'IDLE', '{}'::jsonb
            )
            RETURNING id
        "#;

        let row = sqlx::query(query)
            .bind(name)
            .bind(provider)
            .bind(&item.key_blob)
            .bind(item.client_id)
            .bind(meta)
            .bind(auto_scan_interval)
            .bind(is_active_int)
            .fetch_one(&pool)
            .await?;

        let new_id: Uuid = row.get("id");
        let query_full = r#"
            SELECT 
                cc.id, cc.name, cc.provider::text as provider, cc.key_blob, cc.client_id,
                cc.metadata, cc.auto_scan_interval, (cc.is_active = 1) as is_active,
                cc.last_scanned_at, cc.scan_status, cc.last_scan_error, cc.last_scan_summary,
                cc.created_at, cc.updated_at,
                (
                    SELECT to_json(c) FROM (
                        SELECT id, code, name FROM clients WHERE id = cc.client_id
                    ) c
                ) AS client
            FROM cloud_credentials cc
            WHERE cc.id = $1
        "#;

        if let Ok(mut itm) = sqlx::query_as::<_, CloudCredential>(query_full).bind(new_id).fetch_one(&pool).await {
            itm.key_blob = mask_key_blob(&itm.key_blob);
            created.push(itm);
        }
    }

    Ok(Json(json!({
        "importedCount": created.len(),
        "credentials": created
    })))
}

async fn update_credential(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(dto): Json<UpdateCloudCredentialDto>,
) -> Result<impl IntoResponse, AppError> {
    let is_active_int = dto.is_active.map(|b| if b { 1 } else { 0 });

    let query = r#"
        UPDATE cloud_credentials SET
            name = COALESCE($2, name),
            provider = COALESCE($3::cloud_provider_enum, provider),
            client_id = COALESCE($4, client_id),
            auto_scan_interval = COALESCE($5, auto_scan_interval),
            is_active = COALESCE($6, is_active),
            scan_status = COALESCE($7, scan_status),
            last_scan_error = COALESCE($8, last_scan_error),
            last_scan_summary = COALESCE($9, last_scan_summary),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id
    "#;

    let row = sqlx::query(query)
        .bind(id)
        .bind(dto.name)
        .bind(dto.provider)
        .bind(dto.client_id)
        .bind(dto.auto_scan_interval)
        .bind(is_active_int)
        .bind(dto.scan_status)
        .bind(dto.last_scan_error)
        .bind(dto.last_scan_summary)
        .fetch_optional(&pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Cloud credential {} not found", id)))?;

    let updated_id: Uuid = row.get("id");
    let full = get_credential(State(pool), Path(updated_id)).await?;
    Ok(full)
}

async fn delete_credential(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let res = sqlx::query("DELETE FROM cloud_credentials WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await?;

    if res.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Cloud credential {} not found", id)));
    }

    Ok(Json(json!({ "success": true, "id": id })))
}

async fn scan_credential_internal(
    pool: &PgPool,
    id: Uuid,
) -> Result<ReScanSummaryResult, AppError> {
    let row = sqlx::query(
        "SELECT id, name, provider::text as provider, key_blob, metadata FROM cloud_credentials WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Cloud credential {} not found", id)))?;

    let name: String = row.get("name");
    let provider: String = row.get("provider");
    let key_blob: Value = row.get("key_blob");
    let metadata: Option<Value> = row.get("metadata");

    // Mark status as SCANNING
    let _ = sqlx::query("UPDATE cloud_credentials SET scan_status = 'SCANNING', updated_at = CURRENT_TIMESTAMP WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await;

    let (project_id, _, candidate_pool) = GcpDiscoveryEngine::discover_assets(&provider, &key_blob)
        .await
        .map_err(AppError::BadRequest)?;

    // Fetch existing inventories to detect drift
    let existing_rows = sqlx::query(
        "SELECT id, asset_tag, name, host(primary_ip) as primary_ip, specs FROM inventories",
    )
    .fetch_all(pool)
    .await?;

    let now = Utc::now();
    let mut new_assets_count = 0;
    let mut updated_assets_count = 0;
    let mut unchanged_assets_count = 0;
    let decommissioned_assets_count = 0;
    let mut drift_events = Vec::new();

    for candidate in &candidate_pool {
        let candidate_tag_clean = candidate.asset_tag.trim().to_lowercase();
        let candidate_name_clean = candidate.name.trim().to_lowercase();
        let candidate_ip_clean = candidate.primary_ip.trim();

        let matched = existing_rows.iter().find(|r| {
            let tag: String = r.get("asset_tag");
            let name: String = r.get("name");
            let ip: Option<String> = r.get("primary_ip");

            tag.trim().eq_ignore_ascii_case(&candidate_tag_clean)
                || name.trim().eq_ignore_ascii_case(&candidate_name_clean)
                || (candidate_ip_clean != "10.0.0.1" && ip.as_deref() == Some(candidate_ip_clean))
        });

        if let Some(r) = matched {
            let inv_id: Uuid = r.get("id");
            let inv_tag: String = r.get("asset_tag");
            let inv_name: String = r.get("name");
            let prev_ip: Option<String> = r.get("primary_ip");
            let prev_specs: Value = r.get("specs");

            let ip_changed = candidate_ip_clean != "10.0.0.1" && prev_ip.as_deref() != Some(candidate_ip_clean);

            let new_cores = candidate.specs.get("cpu_cores").and_then(|v| v.as_i64());
            let prev_cores = prev_specs.get("cpu_cores").and_then(|v| v.as_i64());
            let cores_changed = new_cores.is_some() && prev_cores.is_some() && new_cores != prev_cores;

            if ip_changed || cores_changed {
                let mut diff_summary = Vec::new();
                if let (Some(nc), Some(pc)) = (new_cores, prev_cores) {
                    diff_summary.push(format!("Machine resized: {} cores -> {} cores", pc, nc));
                }
                if ip_changed {
                    diff_summary.push(format!("Primary IP changed: {:?} -> {}", prev_ip, candidate_ip_clean));
                }

                let summary = format!("[Auto Re-Scan] {}", diff_summary.join("; "));

                // Update inventory
                let _ = sqlx::query("UPDATE inventories SET specs = $2, primary_ip = $3::inet, updated_at = CURRENT_TIMESTAMP WHERE id = $1")
                    .bind(inv_id)
                    .bind(&candidate.specs)
                    .bind(&candidate.primary_ip)
                    .execute(pool)
                    .await;

                // Log drift to history
                let _ = sqlx::query(
                    r#"
                    INSERT INTO inventory_history (inventory_id, service_account_id, change_type, change_summary, previous_state, new_state, source)
                    VALUES ($1, $2, 'SPECS_CHANGED', $3, $4, $5, 'AUTOMATED_SCAN')
                    "#,
                )
                .bind(inv_id)
                .bind(id)
                .bind(&summary)
                .bind(&prev_specs)
                .bind(&candidate.specs)
                .execute(pool)
                .await;

                updated_assets_count += 1;
                drift_events.push(DriftEvent {
                    inventory_id: inv_id.to_string(),
                    asset_tag: inv_tag,
                    asset_name: inv_name,
                    change_type: "SPECS_CHANGED".to_string(),
                    change_summary: summary,
                });
            } else {
                unchanged_assets_count += 1;
            }
        } else {
            new_assets_count += 1;
            drift_events.push(DriftEvent {
                inventory_id: "unregistered".to_string(),
                asset_tag: candidate.asset_tag.clone(),
                asset_name: candidate.name.clone(),
                change_type: "DISCOVERED_NEW".to_string(),
                change_summary: format!(
                    "New cloud instance \"{}\" ({}) detected in project \"{}\"",
                    candidate.name, candidate.asset_type, project_id
                ),
            });
        }
    }

    let summary = json!({
        "totalDiscovered": candidate_pool.len(),
        "newAssetsCount": new_assets_count,
        "updatedAssetsCount": updated_assets_count,
        "unchangedAssetsCount": unchanged_assets_count,
        "decommissionedAssetsCount": decommissioned_assets_count,
        "lastScannedAt": now.to_rfc3339()
    });

    let _ = sqlx::query(
        "UPDATE cloud_credentials SET scan_status = 'SUCCESS', last_scanned_at = $2, last_scan_summary = $3, last_scan_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
    )
    .bind(id)
    .bind(now)
    .bind(summary)
    .execute(pool)
    .await;

    let proj_id = metadata
        .as_ref()
        .and_then(|m| m.get("projectId"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| Some(project_id));

    Ok(ReScanSummaryResult {
        credential_id: id,
        credential_name: name,
        provider,
        project_id: proj_id,
        scanned_at: now.to_rfc3339(),
        total_discovered: candidate_pool.len(),
        new_assets_count,
        updated_assets_count,
        unchanged_assets_count,
        decommissioned_assets_count,
        drift_events,
    })
}

async fn scan_credential(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let result = scan_credential_internal(&pool, id).await?;
    Ok(Json(result))
}

async fn scan_all_credentials(State(pool): State<PgPool>) -> Result<impl IntoResponse, AppError> {
    let active_rows = sqlx::query("SELECT id FROM cloud_credentials WHERE is_active = 1")
        .fetch_all(&pool)
        .await?;

    let mut results = Vec::new();
    for r in active_rows {
        let id: Uuid = r.get("id");
        if let Ok(res) = scan_credential_internal(&pool, id).await {
            results.push(res);
        }
    }

    Ok(Json(results))
}
