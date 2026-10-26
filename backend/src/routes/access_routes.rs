use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, patch, post},
    Json, Router,
};
use chrono::{Duration, Utc};
use serde_json::json;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::error::AppError;
use crate::models::{
    AccessAuditLog, AccessGrant, RequestAccessDto, ReviewNotesDto, RevokeReasonDto,
    UpdateAccessGrantDto,
};

pub fn router() -> Router<PgPool> {
    Router::new()
        .route("/accesses", get(list_accesses))
        .route("/accesses/request", post(request_access))
        .route("/accesses/audit-logs", get(list_audit_logs))
        .route(
            "/accesses/:id",
            get(get_access_grant)
                .put(update_access_grant)
                .delete(delete_access_grant),
        )
        .route("/accesses/:id/approve", patch(approve_access))
        .route("/accesses/:id/reject", patch(reject_access))
        .route("/accesses/:id/revoke", patch(revoke_access))
        .route("/accesses/:id/cancel", patch(cancel_access))
}

async fn resolve_valid_employee_id(pool: &PgPool, passed: Option<&str>) -> Result<Uuid, AppError> {
    if let Some(s) = passed {
        if let Ok(u) = Uuid::parse_str(s) {
            let exists = sqlx::query("SELECT id FROM employees WHERE id = $1")
                .bind(u)
                .fetch_optional(pool)
                .await?;
            if exists.is_some() {
                return Ok(u);
            }
        }
    }

    let first = sqlx::query("SELECT id FROM employees ORDER BY created_at ASC LIMIT 1")
        .fetch_optional(pool)
        .await?;

    if let Some(r) = first {
        Ok(r.get("id"))
    } else {
        Err(AppError::NotFound("No employees exist in the database".to_string()))
    }
}

async fn resolve_valid_inventory_id(pool: &PgPool, passed: &str) -> Result<Uuid, AppError> {
    if let Ok(u) = Uuid::parse_str(passed) {
        let exists = sqlx::query("SELECT id FROM inventories WHERE id = $1")
            .bind(u)
            .fetch_optional(pool)
            .await?;
        if exists.is_some() {
            return Ok(u);
        }
    }

    let by_tag = sqlx::query("SELECT id FROM inventories WHERE asset_tag = $1")
        .bind(passed)
        .fetch_optional(pool)
        .await?;

    if let Some(r) = by_tag {
        return Ok(r.get("id"));
    }

    let first = sqlx::query("SELECT id FROM inventories ORDER BY created_at ASC LIMIT 1")
        .fetch_optional(pool)
        .await?;

    if let Some(r) = first {
        Ok(r.get("id"))
    } else {
        Err(AppError::BadRequest("No inventory assets exist in the database to grant access to".to_string()))
    }
}

pub async fn fetch_access_grant_by_id(pool: &PgPool, id: Uuid) -> Result<AccessGrant, AppError> {
    let query = r#"
        SELECT 
            ag.id, ag.employee_id, ag.inventory_id, ag.project_id,
            ag.access_level::text as access_level, ag.grant_type::text as grant_type,
            ag.status::text as status, ag.justification,
            ag.requested_start_time, ag.requested_end_time,
            ag.valid_from, ag.valid_until,
            ag.reviewed_by, ag.reviewed_at, ag.review_notes,
            ag.revoked_by, ag.revoked_at, ag.revocation_reason,
            ag.metadata, ag.created_at, ag.updated_at,
            (
                SELECT to_json(e) FROM (
                    SELECT id, employee_number as "employeeNumber", first_name as "firstName", last_name as "lastName", email, job_title as "jobTitle"
                    FROM employees WHERE id = ag.employee_id
                ) e
            ) AS employee,
            (
                SELECT to_json(i) FROM (
                    SELECT id, asset_tag as "assetTag", name, provider::text as provider, region, host(primary_ip) as "primaryIp"
                    FROM inventories WHERE id = ag.inventory_id
                ) i
            ) AS inventory,
            COALESCE((
                SELECT to_json(p) FROM (
                    SELECT id, code, name FROM projects WHERE id = ag.project_id
                ) p
            )::json, 'null'::json) AS project
        FROM access_grants ag
        WHERE ag.id = $1
    "#;

    sqlx::query_as::<_, AccessGrant>(query)
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Access grant {} not found", id)))
}

async fn list_accesses(State(pool): State<PgPool>) -> Result<impl IntoResponse, AppError> {
    let query = r#"
        SELECT 
            ag.id, ag.employee_id, ag.inventory_id, ag.project_id,
            ag.access_level::text as access_level, ag.grant_type::text as grant_type,
            ag.status::text as status, ag.justification,
            ag.requested_start_time, ag.requested_end_time,
            ag.valid_from, ag.valid_until,
            ag.reviewed_by, ag.reviewed_at, ag.review_notes,
            ag.revoked_by, ag.revoked_at, ag.revocation_reason,
            ag.metadata, ag.created_at, ag.updated_at,
            (
                SELECT to_json(e) FROM (
                    SELECT id, employee_number as "employeeNumber", first_name as "firstName", last_name as "lastName", email, job_title as "jobTitle"
                    FROM employees WHERE id = ag.employee_id
                ) e
            ) AS employee,
            (
                SELECT to_json(i) FROM (
                    SELECT id, asset_tag as "assetTag", name, provider::text as provider, region, host(primary_ip) as "primaryIp"
                    FROM inventories WHERE id = ag.inventory_id
                ) i
            ) AS inventory,
            COALESCE((
                SELECT to_json(p) FROM (
                    SELECT id, code, name FROM projects WHERE id = ag.project_id
                ) p
            )::json, 'null'::json) AS project
        FROM access_grants ag
        ORDER BY ag.created_at DESC
    "#;

    let rows = sqlx::query_as::<_, AccessGrant>(query)
        .fetch_all(&pool)
        .await?;

    Ok(Json(rows))
}

async fn get_access_grant(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let grant = fetch_access_grant_by_id(&pool, id).await?;
    Ok(Json(grant))
}

async fn request_access(
    State(pool): State<PgPool>,
    Json(dto): Json<RequestAccessDto>,
) -> Result<impl IntoResponse, AppError> {
    let emp_id = resolve_valid_employee_id(&pool, dto.employee_id.as_deref()).await?;
    let inv_id = resolve_valid_inventory_id(&pool, &dto.inventory_id).await?;

    let proj_id = dto
        .project_id
        .as_deref()
        .and_then(|s| Uuid::parse_str(s).ok());

    let access_level = dto.access_level.unwrap_or_else(|| "READ_WRITE".to_string());
    let grant_type = dto.grant_type.unwrap_or_else(|| "TEMPORARY_TIMED".to_string());
    let duration_hours = dto.duration_hours.unwrap_or(4);

    let now = Utc::now();
    let requested_end_time = now + Duration::hours(duration_hours);

    let query = r#"
        INSERT INTO access_grants (
            employee_id, inventory_id, project_id,
            access_level, grant_type, status, justification,
            requested_start_time, requested_end_time,
            metadata
        )
        VALUES (
            $1, $2, $3,
            $4::access_level_enum, $5::access_grant_type_enum, 'PENDING'::access_status_enum, $6,
            $7, $8,
            $9
        )
        RETURNING id
    "#;

    let meta = json!({
        "durationHours": duration_hours,
        "requestedDurationHours": duration_hours,
    });

    let row = sqlx::query(query)
        .bind(emp_id)
        .bind(inv_id)
        .bind(proj_id)
        .bind(&access_level)
        .bind(&grant_type)
        .bind(&dto.justification)
        .bind(now)
        .bind(requested_end_time)
        .bind(&meta)
        .fetch_one(&pool)
        .await?;

    let new_id: Uuid = row.get("id");

    // Audit log
    let _ = sqlx::query(
        r#"
        INSERT INTO access_audit_logs (grant_id, employee_id, inventory_id, action, metadata)
        VALUES ($1, $2, $3, 'ACCESS_REQUESTED', $4)
        "#,
    )
    .bind(new_id)
    .bind(emp_id)
    .bind(inv_id)
    .bind(json!({
        "accessLevel": access_level,
        "durationHours": duration_hours
    }))
    .execute(&pool)
    .await;

    let full = fetch_access_grant_by_id(&pool, new_id).await?;
    Ok((StatusCode::CREATED, Json(full)))
}

async fn update_access_grant(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(dto): Json<UpdateAccessGrantDto>,
) -> Result<impl IntoResponse, AppError> {
    let query = r#"
        UPDATE access_grants SET
            access_level = COALESCE($2::access_level_enum, access_level),
            grant_type = COALESCE($3::access_grant_type_enum, grant_type),
            status = COALESCE($4::access_status_enum, status),
            justification = COALESCE($5, justification),
            valid_from = COALESCE($6, valid_from),
            valid_until = COALESCE($7, valid_until),
            review_notes = COALESCE($8, review_notes),
            revocation_reason = COALESCE($9, revocation_reason),
            metadata = COALESCE($10, metadata),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id
    "#;

    let row = sqlx::query(query)
        .bind(id)
        .bind(dto.access_level)
        .bind(dto.grant_type)
        .bind(dto.status)
        .bind(dto.justification)
        .bind(dto.valid_from)
        .bind(dto.valid_until)
        .bind(dto.review_notes)
        .bind(dto.revocation_reason)
        .bind(dto.metadata)
        .fetch_optional(&pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Access grant {} not found", id)))?;

    let updated_id: Uuid = row.get("id");
    let full = fetch_access_grant_by_id(&pool, updated_id).await?;
    Ok(Json(full))
}

async fn approve_access(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(dto): Json<ReviewNotesDto>,
) -> Result<impl IntoResponse, AppError> {
    let grant = fetch_access_grant_by_id(&pool, id).await?;
    if grant.status != "PENDING" && grant.status != "ENDORSED" {
        return Err(AppError::BadRequest(format!(
            "Cannot approve grant in {} state",
            grant.status
        )));
    }

    let reviewer_id = resolve_valid_employee_id(&pool, None).await?;
    let now = Utc::now();
    let duration_hours = grant
        .metadata
        .as_ref()
        .and_then(|m| m.get("durationHours").or_else(|| m.get("requestedDurationHours")))
        .and_then(|v| v.as_i64())
        .unwrap_or(4);

    let valid_until = now + Duration::hours(duration_hours);
    let notes = dto
        .notes
        .or(dto.reason)
        .unwrap_or_else(|| "Access Approved via Dashboard".to_string());

    let query = r#"
        UPDATE access_grants SET
            status = 'ACTIVE'::access_status_enum,
            valid_from = $2,
            valid_until = $3,
            reviewed_by = $4,
            reviewed_at = $2,
            review_notes = $5,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
    "#;

    sqlx::query(query)
        .bind(id)
        .bind(now)
        .bind(valid_until)
        .bind(reviewer_id)
        .bind(&notes)
        .execute(&pool)
        .await?;

    let _ = sqlx::query(
        r#"
        INSERT INTO access_audit_logs (grant_id, employee_id, inventory_id, action, metadata)
        VALUES ($1, $2, $3, 'ACCESS_APPROVED_ACTIVATED', $4)
        "#,
    )
    .bind(id)
    .bind(grant.employee_id)
    .bind(grant.inventory_id)
    .bind(json!({
        "reviewedBy": reviewer_id,
        "validUntil": valid_until.to_rfc3339(),
        "notes": notes
    }))
    .execute(&pool)
    .await;

    let full = fetch_access_grant_by_id(&pool, id).await?;
    Ok(Json(full))
}

async fn reject_access(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(dto): Json<ReviewNotesDto>,
) -> Result<impl IntoResponse, AppError> {
    let grant = fetch_access_grant_by_id(&pool, id).await?;
    let reviewer_id = resolve_valid_employee_id(&pool, None).await?;
    let now = Utc::now();
    let notes = dto
        .notes
        .or(dto.reason)
        .unwrap_or_else(|| "Access request declined".to_string());

    let query = r#"
        UPDATE access_grants SET
            status = 'REJECTED'::access_status_enum,
            reviewed_by = $2,
            reviewed_at = $3,
            review_notes = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
    "#;

    sqlx::query(query)
        .bind(id)
        .bind(reviewer_id)
        .bind(now)
        .bind(&notes)
        .execute(&pool)
        .await?;

    let _ = sqlx::query(
        r#"
        INSERT INTO access_audit_logs (grant_id, employee_id, inventory_id, action, metadata)
        VALUES ($1, $2, $3, 'ACCESS_REJECTED', $4)
        "#,
    )
    .bind(id)
    .bind(grant.employee_id)
    .bind(grant.inventory_id)
    .bind(json!({
        "reviewedBy": reviewer_id,
        "notes": notes
    }))
    .execute(&pool)
    .await;

    let full = fetch_access_grant_by_id(&pool, id).await?;
    Ok(Json(full))
}

async fn revoke_access(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(dto): Json<RevokeReasonDto>,
) -> Result<impl IntoResponse, AppError> {
    let grant = fetch_access_grant_by_id(&pool, id).await?;
    let revoker_id = resolve_valid_employee_id(&pool, None).await?;
    let now = Utc::now();
    let reason = dto
        .reason
        .unwrap_or_else(|| "Manual administrative revocation".to_string());

    let query = r#"
        UPDATE access_grants SET
            status = 'REVOKED'::access_status_enum,
            revoked_by = $2,
            revoked_at = $3,
            revocation_reason = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
    "#;

    sqlx::query(query)
        .bind(id)
        .bind(revoker_id)
        .bind(now)
        .bind(&reason)
        .execute(&pool)
        .await?;

    let _ = sqlx::query(
        r#"
        INSERT INTO access_audit_logs (grant_id, employee_id, inventory_id, action, metadata)
        VALUES ($1, $2, $3, 'ACCESS_REVOKED', $4)
        "#,
    )
    .bind(id)
    .bind(grant.employee_id)
    .bind(grant.inventory_id)
    .bind(json!({
        "revokedBy": revoker_id,
        "reason": reason
    }))
    .execute(&pool)
    .await;

    let full = fetch_access_grant_by_id(&pool, id).await?;
    Ok(Json(full))
}

async fn cancel_access(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(dto): Json<RevokeReasonDto>,
) -> Result<impl IntoResponse, AppError> {
    let grant = fetch_access_grant_by_id(&pool, id).await?;
    let now = Utc::now();
    let reason = dto
        .reason
        .unwrap_or_else(|| "Cancelled by requester".to_string());

    let query = r#"
        UPDATE access_grants SET
            status = 'CANCELLED'::access_status_enum,
            revoked_at = $2,
            revocation_reason = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
    "#;

    sqlx::query(query)
        .bind(id)
        .bind(now)
        .bind(&reason)
        .execute(&pool)
        .await?;

    let _ = sqlx::query(
        r#"
        INSERT INTO access_audit_logs (grant_id, employee_id, inventory_id, action, metadata)
        VALUES ($1, $2, $3, 'ACCESS_REQUEST_CANCELLED', $4)
        "#,
    )
    .bind(id)
    .bind(grant.employee_id)
    .bind(grant.inventory_id)
    .bind(json!({
        "cancelledAt": now.to_rfc3339(),
        "reason": reason
    }))
    .execute(&pool)
    .await;

    let full = fetch_access_grant_by_id(&pool, id).await?;
    Ok(Json(full))
}

async fn delete_access_grant(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    // 1. Detach audit logs first to preserve audit trail
    let _ = sqlx::query("UPDATE access_audit_logs SET grant_id = NULL WHERE grant_id = $1")
        .bind(id)
        .execute(&pool)
        .await;

    // 2. Delete the grant
    let res = sqlx::query("DELETE FROM access_grants WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await?;

    if res.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Access grant {} not found", id)));
    }

    Ok(Json(json!({ "success": true, "id": id })))
}

async fn list_audit_logs(State(pool): State<PgPool>) -> Result<impl IntoResponse, AppError> {
    let query = r#"
        SELECT 
            id, grant_id, employee_id, inventory_id, action,
            host(ip_address) as ip_address, session_id, metadata, created_at
        FROM access_audit_logs
        ORDER BY created_at DESC
        LIMIT 200
    "#;

    let rows = sqlx::query_as::<_, AccessAuditLog>(query)
        .fetch_all(&pool)
        .await?;

    Ok(Json(rows))
}
