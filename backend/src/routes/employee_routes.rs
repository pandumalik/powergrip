use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, patch},
    Json, Router,
};
use chrono::Utc;
use serde_json::json;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::error::AppError;
use crate::models::{
    CreateDepartmentDto, CreateEmployeeDto, Department, Employee, OffboardEmployeeDto,
    UpdateEmployeeDto,
};

pub fn router() -> Router<PgPool> {
    Router::new()
        .route("/employees", get(list_employees).post(create_employee))
        .route(
            "/employees/departments",
            get(list_departments).post(create_department),
        )
        .route(
            "/employees/:id",
            get(get_employee)
                .put(update_employee)
                .delete(delete_employee),
        )
        .route("/employees/:id/offboard", patch(offboard_employee))
}

pub async fn fetch_employee_by_id(pool: &PgPool, id: Uuid) -> Result<Employee, AppError> {
    let query = r#"
        SELECT 
            e.id, e.user_id, e.department_id, e.manager_id, e.employee_number,
            e.first_name, e.last_name, e.email, e.job_title,
            e.hierarchy_path::text as hierarchy_path,
            e.employment_status::text as employment_status,
            e.join_date, e.exit_date, e.metadata, e.created_at, e.updated_at,
            COALESCE((
                SELECT to_json(d) FROM (
                    SELECT id, code, name FROM departments WHERE id = e.department_id
                ) d
            )::json, 'null'::json) AS department,
            COALESCE((
                SELECT to_json(m) FROM (
                    SELECT id, employee_number, first_name, last_name, email, job_title
                    FROM employees WHERE id = e.manager_id
                ) m
            )::json, 'null'::json) AS manager,
            COALESCE((
                SELECT json_agg(json_build_object(
                    'id', ag.id,
                    'inventoryId', ag.inventory_id,
                    'accessLevel', ag.access_level::text,
                    'status', ag.status::text,
                    'validFrom', ag.valid_from,
                    'validUntil', ag.valid_until
                )) FROM access_grants ag WHERE ag.employee_id = e.id
            ), '[]'::json) AS access_grants
        FROM employees e
        WHERE e.id = $1
    "#;

    sqlx::query_as::<_, Employee>(query)
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Employee {} not found", id)))
}

async fn list_employees(State(pool): State<PgPool>) -> Result<impl IntoResponse, AppError> {
    let query = r#"
        SELECT 
            e.id, e.user_id, e.department_id, e.manager_id, e.employee_number,
            e.first_name, e.last_name, e.email, e.job_title,
            e.hierarchy_path::text as hierarchy_path,
            e.employment_status::text as employment_status,
            e.join_date, e.exit_date, e.metadata, e.created_at, e.updated_at,
            COALESCE((
                SELECT to_json(d) FROM (
                    SELECT id, code, name FROM departments WHERE id = e.department_id
                ) d
            )::json, 'null'::json) AS department,
            COALESCE((
                SELECT to_json(m) FROM (
                    SELECT id, employee_number, first_name, last_name, email, job_title
                    FROM employees WHERE id = e.manager_id
                ) m
            )::json, 'null'::json) AS manager,
            COALESCE((
                SELECT json_agg(json_build_object(
                    'id', ag.id,
                    'inventoryId', ag.inventory_id,
                    'accessLevel', ag.access_level::text,
                    'status', ag.status::text,
                    'validFrom', ag.valid_from,
                    'validUntil', ag.valid_until
                )) FROM access_grants ag WHERE ag.employee_id = e.id
            ), '[]'::json) AS access_grants
        FROM employees e
        ORDER BY e.created_at DESC
    "#;

    let rows = sqlx::query_as::<_, Employee>(query)
        .fetch_all(&pool)
        .await?;

    Ok(Json(rows))
}

async fn get_employee(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let emp = fetch_employee_by_id(&pool, id).await?;
    Ok(Json(emp))
}

async fn create_employee(
    State(pool): State<PgPool>,
    Json(dto): Json<CreateEmployeeDto>,
) -> Result<impl IntoResponse, AppError> {
    let emp_num = dto.employee_number.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| {
        format!("EMP-{}", &Uuid::new_v4().to_string()[..6].to_uppercase())
    });

    let status = dto.employment_status.unwrap_or_else(|| "ACTIVE".to_string());
    let join_date = dto.join_date.unwrap_or_else(|| Utc::now().date_naive());
    let metadata = dto.metadata.unwrap_or_else(|| json!({}));

    // Generate hierarchy path
    let mut hierarchy = emp_num.clone();
    if let Some(mgr_id) = dto.manager_id {
        let mgr_row = sqlx::query("SELECT hierarchy_path::text as hierarchy_path FROM employees WHERE id = $1")
            .bind(mgr_id)
            .fetch_optional(&pool)
            .await?;

        if let Some(r) = mgr_row {
            if let Some(mgr_path) = r.get::<Option<String>, _>("hierarchy_path") {
                hierarchy = format!("{}.{}", mgr_path, emp_num);
            }
        }
    }

    // Sanitize ltree: replace invalid characters with underscore
    let sanitized_ltree: String = hierarchy
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '_' || c == '.' { c } else { '_' })
        .collect();

    let query = r#"
        INSERT INTO employees (
            user_id, department_id, manager_id, employee_number,
            first_name, last_name, email, job_title, hierarchy_path,
            employment_status, join_date, metadata
        )
        VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8, $9::ltree,
            $10::employment_status_enum, $11, $12
        )
        RETURNING id
    "#;

    let row = sqlx::query(query)
        .bind(dto.user_id)
        .bind(dto.department_id)
        .bind(dto.manager_id)
        .bind(&emp_num)
        .bind(&dto.first_name)
        .bind(&dto.last_name)
        .bind(&dto.email)
        .bind(&dto.job_title)
        .bind(&sanitized_ltree)
        .bind(&status)
        .bind(join_date)
        .bind(&metadata)
        .fetch_one(&pool)
        .await?;

    let new_id: Uuid = row.get("id");
    let full = fetch_employee_by_id(&pool, new_id).await?;
    Ok((StatusCode::CREATED, Json(full)))
}

async fn update_employee(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(dto): Json<UpdateEmployeeDto>,
) -> Result<impl IntoResponse, AppError> {
    let query = r#"
        UPDATE employees SET
            user_id = COALESCE($2, user_id),
            department_id = COALESCE($3, department_id),
            manager_id = COALESCE($4, manager_id),
            employee_number = COALESCE($5, employee_number),
            first_name = COALESCE($6, first_name),
            last_name = COALESCE($7, last_name),
            email = COALESCE($8, email),
            job_title = COALESCE($9, job_title),
            employment_status = COALESCE($10::employment_status_enum, employment_status),
            join_date = COALESCE($11, join_date),
            exit_date = COALESCE($12, exit_date),
            metadata = COALESCE($13, metadata),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id
    "#;

    let row = sqlx::query(query)
        .bind(id)
        .bind(dto.user_id)
        .bind(dto.department_id)
        .bind(dto.manager_id)
        .bind(dto.employee_number)
        .bind(dto.first_name)
        .bind(dto.last_name)
        .bind(dto.email)
        .bind(dto.job_title)
        .bind(dto.employment_status)
        .bind(dto.join_date)
        .bind(dto.exit_date)
        .bind(dto.metadata)
        .fetch_optional(&pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Employee {} not found", id)))?;

    let updated_id: Uuid = row.get("id");
    let full = fetch_employee_by_id(&pool, updated_id).await?;
    Ok(Json(full))
}

async fn offboard_employee(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(dto): Json<OffboardEmployeeDto>,
) -> Result<impl IntoResponse, AppError> {
    let exit_date = dto.exit_date.unwrap_or_else(|| Utc::now().date_naive());

    let query = r#"
        UPDATE employees SET
            employment_status = 'TERMINATED'::employment_status_enum,
            exit_date = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id
    "#;

    let row = sqlx::query(query)
        .bind(id)
        .bind(exit_date)
        .fetch_optional(&pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Employee {} not found", id)))?;

    let updated_id: Uuid = row.get("id");
    let full = fetch_employee_by_id(&pool, updated_id).await?;
    Ok(Json(full))
}

async fn delete_employee(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let result = sqlx::query("DELETE FROM employees WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await;

    match result {
        Ok(res) => {
            if res.rows_affected() == 0 {
                return Err(AppError::NotFound(format!("Employee with ID {} not found", id)));
            }
            Ok(Json(json!({ "success": true, "id": id })))
        }
        Err(err) => {
            if let sqlx::Error::Database(ref db_err) = err {
                if db_err.code().as_deref() == Some("23503") {
                    return Err(AppError::Conflict(
                        "Cannot delete employee because they are assigned to projects, access grants, or department structures. Initiate employee offboarding instead.".to_string(),
                    ));
                }
            }
            Err(AppError::Database(err))
        }
    }
}

async fn list_departments(State(pool): State<PgPool>) -> Result<impl IntoResponse, AppError> {
    let query = r#"
        SELECT id, parent_id, code, name, head_of_department_id, created_at, updated_at
        FROM departments
        ORDER BY name ASC
    "#;

    let rows = sqlx::query_as::<_, Department>(query)
        .fetch_all(&pool)
        .await?;

    Ok(Json(rows))
}

async fn create_department(
    State(pool): State<PgPool>,
    Json(dto): Json<CreateDepartmentDto>,
) -> Result<impl IntoResponse, AppError> {
    let query = r#"
        INSERT INTO departments (code, name, parent_id, head_of_department_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id, parent_id, code, name, head_of_department_id, created_at, updated_at
    "#;

    let dept = sqlx::query_as::<_, Department>(query)
        .bind(dto.code)
        .bind(dto.name)
        .bind(dto.parent_id)
        .bind(dto.head_of_department_id)
        .fetch_one(&pool)
        .await?;

    Ok((StatusCode::CREATED, Json(dept)))
}
