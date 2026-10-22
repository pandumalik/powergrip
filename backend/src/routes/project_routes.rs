use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::error::AppError;
use crate::models::{AssignMemberDto, CreateProjectDto, Project, UpdateProjectDto};

pub fn router() -> Router<PgPool> {
    Router::new()
        .route("/projects", get(list_projects).post(create_project))
        .route(
            "/projects/:id",
            get(get_project).put(update_project).delete(delete_project),
        )
        .route("/projects/:id/assign", post(assign_member))
        .route("/projects/:id/remove-member", post(remove_member))
}

pub async fn fetch_project_by_id(pool: &PgPool, id: Uuid) -> Result<Project, AppError> {
    let query = r#"
        SELECT 
            p.id, p.client_id, p.contract_id, p.project_manager_id, p.code, p.name,
            p.project_type::text as project_type, p.status::text as status,
            p.start_date, p.end_date, p.description, p.assigned_members, p.tags, p.version,
            p.created_at, p.updated_at,
            (
                SELECT to_json(c) FROM (
                    SELECT id, code, name, status::text as status, billing_email, country, timezone
                    FROM clients WHERE id = p.client_id
                ) c
            ) AS client,
            COALESCE((
                SELECT to_json(ct) FROM (
                    SELECT id, contract_number, title, contract_type::text as contract_type, status::text as status
                    FROM contracts WHERE id = p.contract_id
                ) ct
            )::json, 'null'::json) AS contract,
            COALESCE((
                SELECT to_json(e) FROM (
                    SELECT id, employee_number, first_name, last_name, email, job_title
                    FROM employees WHERE id = p.project_manager_id
                ) e
            )::json, 'null'::json) AS project_manager,
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
                )) FROM inventories i WHERE i.project_id = p.id
            ), '[]'::json) AS inventories
        FROM projects p
        WHERE p.id = $1
    "#;

    sqlx::query_as::<_, Project>(query)
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Project with ID {} not found", id)))
}

async fn list_projects(State(pool): State<PgPool>) -> Result<Json<Vec<Project>>, AppError> {
    let query = r#"
        SELECT 
            p.id, p.client_id, p.contract_id, p.project_manager_id, p.code, p.name,
            p.project_type::text as project_type, p.status::text as status,
            p.start_date, p.end_date, p.description, p.assigned_members, p.tags, p.version,
            p.created_at, p.updated_at,
            (
                SELECT to_json(c) FROM (
                    SELECT id, code, name, status::text as status, billing_email, country, timezone
                    FROM clients WHERE id = p.client_id
                ) c
            ) AS client,
            COALESCE((
                SELECT to_json(ct) FROM (
                    SELECT id, contract_number, title, contract_type::text as contract_type, status::text as status
                    FROM contracts WHERE id = p.contract_id
                ) ct
            )::json, 'null'::json) AS contract,
            COALESCE((
                SELECT to_json(e) FROM (
                    SELECT id, employee_number, first_name, last_name, email, job_title
                    FROM employees WHERE id = p.project_manager_id
                ) e
            )::json, 'null'::json) AS project_manager,
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
                )) FROM inventories i WHERE i.project_id = p.id
            ), '[]'::json) AS inventories
        FROM projects p
        ORDER BY p.created_at DESC
    "#;

    let rows = sqlx::query_as::<_, Project>(query)
        .fetch_all(&pool)
        .await?;

    Ok(Json(rows))
}

async fn get_project(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Project>, AppError> {
    let project = fetch_project_by_id(&pool, id).await?;
    Ok(Json(project))
}

async fn create_project(
    State(pool): State<PgPool>,
    Json(dto): Json<CreateProjectDto>,
) -> Result<impl IntoResponse, AppError> {
    let client_id = match dto.client_id {
        Some(cid) => cid,
        None => {
            let row = sqlx::query("SELECT id FROM clients ORDER BY created_at ASC LIMIT 1")
                .fetch_optional(&pool)
                .await?;
            match row {
                Some(r) => r.get::<Uuid, _>("id"),
                None => {
                    return Err(AppError::BadRequest(
                        "Cannot create project: No clients exist in database.".to_string(),
                    ));
                }
            }
        }
    };

    let code = dto
        .code
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| format!("PRJ-{}", &Uuid::new_v4().to_string()[..8].to_uppercase()));

    let project_type = dto.project_type.unwrap_or_else(|| "MANAGED_DEVOPS".to_string());
    let status = dto.status.unwrap_or_else(|| "IN_PROGRESS".to_string());
    let start_date = dto.start_date.unwrap_or_else(|| Utc::now().date_naive());
    let assigned_members = dto.assigned_members.unwrap_or_else(|| json!([]));
    let tags = dto.tags.unwrap_or_else(|| json!([]));

    let query = r#"
        INSERT INTO projects (
            client_id, contract_id, project_manager_id, code, name,
            project_type, status, start_date, end_date, description,
            assigned_members, tags
        )
        VALUES (
            $1, $2, $3, $4, $5,
            $6::project_type_enum, $7::project_status_enum, $8, $9, $10,
            $11, $12
        )
        RETURNING id
    "#;

    let row = sqlx::query(query)
        .bind(client_id)
        .bind(dto.contract_id)
        .bind(dto.project_manager_id)
        .bind(code)
        .bind(dto.name)
        .bind(project_type)
        .bind(status)
        .bind(start_date)
        .bind(dto.end_date)
        .bind(dto.description)
        .bind(assigned_members)
        .bind(tags)
        .fetch_one(&pool)
        .await?;

    let new_id: Uuid = row.get("id");
    let full = fetch_project_by_id(&pool, new_id).await?;
    Ok((StatusCode::CREATED, Json(full)))
}

async fn update_project(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(dto): Json<UpdateProjectDto>,
) -> Result<impl IntoResponse, AppError> {
    let query = r#"
        UPDATE projects SET
            client_id = COALESCE($2, client_id),
            contract_id = COALESCE($3, contract_id),
            project_manager_id = COALESCE($4, project_manager_id),
            code = COALESCE($5, code),
            name = COALESCE($6, name),
            project_type = COALESCE($7::project_type_enum, project_type),
            status = COALESCE($8::project_status_enum, status),
            start_date = COALESCE($9, start_date),
            end_date = COALESCE($10, end_date),
            description = COALESCE($11, description),
            assigned_members = COALESCE($12, assigned_members),
            tags = COALESCE($13, tags),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id
    "#;

    let updated = sqlx::query(query)
        .bind(id)
        .bind(dto.client_id)
        .bind(dto.contract_id)
        .bind(dto.project_manager_id)
        .bind(dto.code)
        .bind(dto.name)
        .bind(dto.project_type)
        .bind(dto.status)
        .bind(dto.start_date)
        .bind(dto.end_date)
        .bind(dto.description)
        .bind(dto.assigned_members)
        .bind(dto.tags)
        .fetch_optional(&pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Project with ID {} not found", id)))?;

    let updated_id: Uuid = updated.get("id");
    let full = fetch_project_by_id(&pool, updated_id).await?;
    Ok(Json(full))
}

async fn assign_member(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(dto): Json<AssignMemberDto>,
) -> Result<impl IntoResponse, AppError> {
    let row = sqlx::query("SELECT assigned_members FROM projects WHERE id = $1")
        .bind(id)
        .fetch_optional(&pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Project with ID {} not found", id)))?;

    let current_members_val: Value = row.get("assigned_members");
    let mut members_vec: Vec<Value> = current_members_val.as_array().cloned().unwrap_or_default();

    members_vec.retain(|m| {
        m.get("employee_id").and_then(|v| v.as_str()) != Some(&dto.employee_id)
            && m.get("employeeId").and_then(|v| v.as_str()) != Some(&dto.employee_id)
    });

    members_vec.push(json!({
        "employee_id": dto.employee_id,
        "role": dto.role,
        "assigned_at": Utc::now().to_rfc3339(),
        "is_active": true
    }));

    let new_members_val = Value::Array(members_vec);

    sqlx::query("UPDATE projects SET assigned_members = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1")
        .bind(id)
        .bind(new_members_val)
        .execute(&pool)
        .await?;

    let full = fetch_project_by_id(&pool, id).await?;
    Ok(Json(full))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RemoveMemberDto {
    #[serde(alias = "employeeId")]
    employee_id: Option<String>,
}

async fn remove_member(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(dto): Json<RemoveMemberDto>,
) -> Result<impl IntoResponse, AppError> {
    let emp_id = dto
        .employee_id
        .ok_or_else(|| AppError::BadRequest("employee_id is required".to_string()))?;

    let row = sqlx::query("SELECT assigned_members FROM projects WHERE id = $1")
        .bind(id)
        .fetch_optional(&pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Project with ID {} not found", id)))?;

    let current_members_val: Value = row.get("assigned_members");
    let mut members_vec: Vec<Value> = current_members_val.as_array().cloned().unwrap_or_default();

    members_vec.retain(|m| {
        m.get("employee_id").and_then(|v| v.as_str()) != Some(&emp_id)
            && m.get("employeeId").and_then(|v| v.as_str()) != Some(&emp_id)
    });

    let new_members_val = Value::Array(members_vec);

    sqlx::query("UPDATE projects SET assigned_members = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1")
        .bind(id)
        .bind(new_members_val)
        .execute(&pool)
        .await?;

    let full = fetch_project_by_id(&pool, id).await?;
    Ok(Json(full))
}

async fn delete_project(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let result = sqlx::query("DELETE FROM projects WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await;

    match result {
        Ok(res) => {
            if res.rows_affected() == 0 {
                return Err(AppError::NotFound(format!("Project with ID {} not found", id)));
            }
            Ok(Json(json!({ "success": true, "id": id })))
        }
        Err(err) => {
            if let sqlx::Error::Database(ref db_err) = err {
                if db_err.code().as_deref() == Some("23503") {
                    return Err(AppError::Conflict(
                        "Cannot delete project because it has assigned inventory resources, team member grants, or contract bindings.".to_string(),
                    ));
                }
            }
            Err(AppError::Database(err))
        }
    }
}
