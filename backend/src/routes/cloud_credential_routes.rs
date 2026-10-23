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
        .route("/cloud-credentials/gcp-local/status", get(get_gcp_local_status))
        .route("/cloud-credentials/gcp-local/projects", get(get_gcp_local_projects))
        .route("/cloud-credentials/gcp-local/sync", post(sync_gcp_local_resources))
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

#[derive(Debug, serde::Deserialize)]
pub struct GcpSyncRequest {
    pub project_ids: Option<Vec<String>>,
}

async fn execute_gcloud_json(args: &[&str]) -> Result<Value, String> {
    #[cfg(windows)]
    let mut cmd = tokio::process::Command::new("cmd");
    #[cfg(windows)]
    let mut full_args = vec!["/C", "gcloud"];
    #[cfg(windows)]
    full_args.extend_from_slice(args);
    #[cfg(windows)]
    let command = cmd.args(&full_args);

    #[cfg(not(windows))]
    let mut cmd = tokio::process::Command::new("gcloud");
    #[cfg(not(windows))]
    let command = cmd.args(args);

    let output = command
        .output()
        .await
        .map_err(|e| format!("Failed to execute gcloud: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("gcloud error: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    if stdout.trim().is_empty() {
        return Ok(json!([]));
    }

    serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse gcloud JSON output: {}. Output: {}", e, stdout))
}

async fn get_gcp_local_status() -> Result<impl IntoResponse, AppError> {
    match execute_gcloud_json(&["auth", "list", "--format=json"]).await {
        Ok(val) => {
            let mut active_account = None;
            if let Some(arr) = val.as_array() {
                for acc in arr {
                    let status = acc.get("status").and_then(|v| v.as_str()).unwrap_or("");
                    if status.eq_ignore_ascii_case("ACTIVE") {
                        active_account = acc.get("account").and_then(|v| v.as_str()).map(|s| s.to_string());
                        break;
                    }
                }
                if active_account.is_none() {
                    if let Some(first) = arr.first() {
                        active_account = first.get("account").and_then(|v| v.as_str()).map(|s| s.to_string());
                    }
                }
            }
            if let Some(account) = active_account {
                Ok(Json(json!({
                    "available": true,
                    "connected": true,
                    "account": account,
                    "isAdmin": account.eq_ignore_ascii_case("muhammad.galang@ist.id"),
                    "role": "ADMIN"
                })))
            } else {
                Ok(Json(json!({
                    "available": true,
                    "connected": false,
                    "account": null,
                    "message": "No active gcloud account logged in. Please run 'gcloud auth login'."
                })))
            }
        }
        Err(err) => Ok(Json(json!({
            "available": false,
            "connected": false,
            "account": null,
            "error": err
        }))),
    }
}

async fn get_gcp_local_projects() -> Result<impl IntoResponse, AppError> {
    let projects = execute_gcloud_json(&["projects", "list", "--format=json", "--quiet"])
        .await
        .map_err(|e| AppError::Internal(format!("Failed to list GCP projects: {}", e)))?;

    Ok(Json(projects))
}

async fn sync_gcp_local_resources(
    State(pool): State<PgPool>,
    Json(payload): Json<GcpSyncRequest>,
) -> Result<impl IntoResponse, AppError> {
    let target_projects: Vec<String> = if let Some(pids) = payload.project_ids {
        if !pids.is_empty() {
            pids
        } else {
            get_all_project_ids().await?
        }
    } else {
        get_all_project_ids().await?
    };

    let mut total_discovered = 0;
    let mut synced_details = Vec::new();

    let active_account = execute_gcloud_json(&["auth", "list", "--format=json"])
        .await
        .ok()
        .and_then(|v| {
            v.as_array().and_then(|arr| {
                arr.iter().find_map(|acc| {
                    if acc.get("status").and_then(|s| s.as_str()) == Some("ACTIVE") {
                        acc.get("account").and_then(|s| s.as_str()).map(|s| s.to_string())
                    } else {
                        None
                    }
                })
            })
        })
        .unwrap_or_else(|| "muhammad.galang@ist.id".to_string());

    for pid in &target_projects {
        let mut proj_items = 0;
        let clean_pid = pid.trim();
        if clean_pid.is_empty() {
            continue;
        }

        // A. Discover Compute Engine Instances
        if let Ok(vms) = execute_gcloud_json(&[
            "compute",
            "instances",
            "list",
            &format!("--project={}", clean_pid),
            "--format=json",
            "--quiet",
        ])
        .await
        {
            if let Some(vm_list) = vms.as_array() {
                for vm in vm_list {
                    let name = vm.get("name").and_then(|v| v.as_str()).unwrap_or("vm-instance");
                    let status_str = vm.get("status").and_then(|v| v.as_str()).unwrap_or("ACTIVE");
                    let status = if status_str.eq_ignore_ascii_case("RUNNING") {
                        "ACTIVE"
                    } else if status_str.eq_ignore_ascii_case("TERMINATED") || status_str.eq_ignore_ascii_case("STOPPED") {
                        "INACTIVE"
                    } else {
                        "MAINTENANCE"
                    };

                    let zone_url = vm.get("zone").and_then(|v| v.as_str()).unwrap_or("");
                    let zone = zone_url.split('/').last().unwrap_or("asia-southeast2-a");
                    let region = zone.rsplitn(2, '-').last().unwrap_or("asia-southeast2");

                    let primary_ip = vm.get("networkInterfaces")
                        .and_then(|v| v.as_array())
                        .and_then(|arr| arr.first())
                        .and_then(|ni| ni.get("networkIP"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("10.0.0.1");

                    let nat_ip = vm.get("networkInterfaces")
                        .and_then(|v| v.as_array())
                        .and_then(|arr| arr.first())
                        .and_then(|ni| ni.get("accessConfigs"))
                        .and_then(|v| v.as_array())
                        .and_then(|arr| arr.first())
                        .and_then(|ac| ac.get("natIP"))
                        .and_then(|v| v.as_str());

                    let machine_type_url = vm.get("machineType").and_then(|v| v.as_str()).unwrap_or("");
                    let machine_type = machine_type_url.split('/').last().unwrap_or("e2-medium");

                    let asset_tag = format!("AST-VM-GCP-{}-{}", clean_pid.to_uppercase(), name.to_uppercase());

                    let specs = json!({
                        "machine_type": machine_type,
                        "zone": zone,
                        "status": status_str,
                        "nat_ip": nat_ip,
                        "gcp_project": clean_pid
                    });

                    let conn_info = json!({
                        "projectId": clean_pid,
                        "zone": zone,
                        "selfLink": vm.get("selfLink"),
                        "discovered_by": active_account
                    });

                    let upsert_query = r#"
                        INSERT INTO inventories (
                            asset_tag, name, asset_scope, asset_type, environment, status,
                            provider, region, primary_ip, specs, connection_info, tags
                        )
                        VALUES ($1, $2, 'INTERNAL', 'VIRTUAL_MACHINE', 'PROD', $3::asset_status_enum,
                                'GCP', $4, $5::inet, $6, $7, $8)
                        ON CONFLICT (asset_tag) DO UPDATE SET
                            name = EXCLUDED.name,
                            status = EXCLUDED.status,
                            region = EXCLUDED.region,
                            primary_ip = EXCLUDED.primary_ip,
                            specs = EXCLUDED.specs,
                            connection_info = EXCLUDED.connection_info,
                            updated_at = CURRENT_TIMESTAMP
                    "#;

                    let tags = json!(["GCP", "COMPUTE_VM", clean_pid]);

                    let _ = sqlx::query(upsert_query)
                        .bind(&asset_tag)
                        .bind(name)
                        .bind(status)
                        .bind(region)
                        .bind(primary_ip)
                        .bind(&specs)
                        .bind(&conn_info)
                        .bind(&tags)
                        .execute(&pool)
                        .await;

                    proj_items += 1;
                    total_discovered += 1;
                }
            }
        }

        // B. Discover Cloud Storage Buckets
        if let Ok(buckets) = execute_gcloud_json(&[
            "storage",
            "buckets",
            "list",
            &format!("--project={}", clean_pid),
            "--format=json",
            "--quiet",
        ])
        .await
        {
            if let Some(b_list) = buckets.as_array() {
                for b in b_list {
                    let b_name = b.get("name").and_then(|v| v.as_str()).unwrap_or("storage-bucket");
                    let location = b.get("location").and_then(|v| v.as_str()).unwrap_or("ASIA-SOUTHEAST2");
                    let storage_class = b.get("storageClass").and_then(|v| v.as_str()).unwrap_or("STANDARD");

                    let asset_tag = format!("AST-STG-GCP-{}-{}", clean_pid.to_uppercase(), b_name.to_uppercase());

                    let specs = json!({
                        "storage_class": storage_class,
                        "location": location,
                        "gcp_project": clean_pid
                    });

                    let conn_info = json!({
                        "projectId": clean_pid,
                        "bucketUrl": format!("gs://{}", b_name),
                        "discovered_by": active_account
                    });

                    let upsert_query = r#"
                        INSERT INTO inventories (
                            asset_tag, name, asset_scope, asset_type, environment, status,
                            provider, region, primary_ip, specs, connection_info, tags
                        )
                        VALUES ($1, $2, 'INTERNAL', 'STORAGE_BUCKET', 'PROD', 'ACTIVE',
                                'GCP', $3, '10.0.0.1'::inet, $4, $5, $6)
                        ON CONFLICT (asset_tag) DO UPDATE SET
                            name = EXCLUDED.name,
                            region = EXCLUDED.region,
                            specs = EXCLUDED.specs,
                            connection_info = EXCLUDED.connection_info,
                            updated_at = CURRENT_TIMESTAMP
                    "#;

                    let tags = json!(["GCP", "STORAGE_BUCKET", clean_pid]);

                    let _ = sqlx::query(upsert_query)
                        .bind(&asset_tag)
                        .bind(b_name)
                        .bind(location)
                        .bind(&specs)
                        .bind(&conn_info)
                        .bind(&tags)
                        .execute(&pool)
                        .await;

                    proj_items += 1;
                    total_discovered += 1;
                }
            }
        }

        // C. Discover GKE Clusters
        if let Ok(clusters) = execute_gcloud_json(&[
            "container",
            "clusters",
            "list",
            &format!("--project={}", clean_pid),
            "--format=json",
            "--quiet",
        ])
        .await
        {
            if let Some(c_list) = clusters.as_array() {
                for c in c_list {
                    let c_name = c.get("name").and_then(|v| v.as_str()).unwrap_or("gke-cluster");
                    let location = c.get("location").and_then(|v| v.as_str()).unwrap_or("asia-southeast2");
                    let endpoint = c.get("endpoint").and_then(|v| v.as_str()).unwrap_or("10.0.0.1");
                    let version = c.get("currentMasterVersion").and_then(|v| v.as_str()).unwrap_or("latest");

                    let asset_tag = format!("AST-K8S-GCP-{}-{}", clean_pid.to_uppercase(), c_name.to_uppercase());

                    let specs = json!({
                        "k8s_version": version,
                        "location": location,
                        "endpoint": endpoint,
                        "gcp_project": clean_pid
                    });

                    let conn_info = json!({
                        "projectId": clean_pid,
                        "clusterName": c_name,
                        "discovered_by": active_account
                    });

                    let upsert_query = r#"
                        INSERT INTO inventories (
                            asset_tag, name, asset_scope, asset_type, environment, status,
                            provider, region, primary_ip, specs, connection_info, tags
                        )
                        VALUES ($1, $2, 'INTERNAL', 'KUBERNETES', 'PROD', 'ACTIVE',
                                'GCP', $3, $4::inet, $5, $6, $7)
                        ON CONFLICT (asset_tag) DO UPDATE SET
                            name = EXCLUDED.name,
                            region = EXCLUDED.region,
                            primary_ip = EXCLUDED.primary_ip,
                            specs = EXCLUDED.specs,
                            connection_info = EXCLUDED.connection_info,
                            updated_at = CURRENT_TIMESTAMP
                    "#;

                    let tags = json!(["GCP", "KUBERNETES", clean_pid]);

                    let _ = sqlx::query(upsert_query)
                        .bind(&asset_tag)
                        .bind(c_name)
                        .bind(location)
                        .bind(endpoint)
                        .bind(&specs)
                        .bind(&conn_info)
                        .bind(&tags)
                        .execute(&pool)
                        .await;

                    proj_items += 1;
                    total_discovered += 1;
                }
            }
        }

        synced_details.push(json!({
            "projectId": clean_pid,
            "discoveredCount": proj_items
        }));
    }

    // 3. Upsert a record in cloud_credentials representing the local session
    let cred_name = format!("Google Cloud IAM Session ({})", active_account);
    let cred_meta = json!({
        "account": active_account,
        "type": "authorized_user",
        "mode": "local_gcloud_iam_session",
        "scanned_projects_count": target_projects.len(),
        "total_assets_found": total_discovered
    });

    let _ = sqlx::query(
        r#"
        INSERT INTO cloud_credentials (
            id, name, provider, key_blob, client_id, metadata, auto_scan_interval, is_active, scan_status, last_scanned_at
        )
        VALUES (
            'e0a1b2c3-d4e5-6789-0123-456789abcdef',
            $1, 'GCP', '{"type": "authorized_user", "mode": "local_iam"}'::jsonb, NULL, $2, '1h', 1, 'HEALTHY', CURRENT_TIMESTAMP
        )
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            metadata = EXCLUDED.metadata,
            scan_status = 'HEALTHY',
            last_scanned_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        "#,
    )
    .bind(&cred_name)
    .bind(&cred_meta)
    .execute(&pool)
    .await;

    Ok(Json(json!({
        "status": "success",
        "account": active_account,
        "syncedProjectsCount": target_projects.len(),
        "totalAssetsIngested": total_discovered,
        "details": synced_details
    })))
}

async fn get_all_project_ids() -> Result<Vec<String>, AppError> {
    let projects = execute_gcloud_json(&["projects", "list", "--format=json", "--quiet"])
        .await
        .map_err(|e| AppError::Internal(format!("Failed to retrieve GCP projects: {}", e)))?;

    let mut pids = Vec::new();
    if let Some(arr) = projects.as_array() {
        for p in arr {
            if let Some(id) = p.get("projectId").and_then(|v| v.as_str()) {
                pids.push(id.to_string());
            }
        }
    }
    Ok(pids)
}
