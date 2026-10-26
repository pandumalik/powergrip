use axum::{
    extract::State,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{PgPool, Row};

use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    pub email: Option<String>,
    pub password: Option<String>,
    pub provider: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GoogleAuthRequest {
    pub email: String,
    pub name: Option<String>,
    pub picture: Option<String>,
    pub sub: Option<String>,
    pub token: Option<String>,
    pub credential: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: AuthUser,
    pub gcp_session: Option<GcpSessionInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthUser {
    pub id: String,
    pub name: String,
    pub email: String,
    pub role: String,
    pub job_title: String,
    pub avatar: String,
    pub hierarchy_path: Option<String>,
    pub gcp_connected: bool,
    pub gcp_account: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GcpSessionInfo {
    pub active: bool,
    pub account: String,
    pub status: String,
}

pub fn router() -> Router<PgPool> {
    Router::new()
        .route("/auth/login", post(login_handler))
        .route("/auth/google", post(google_auth_handler))
        .route("/auth/me", get(get_current_user))
}

async fn google_auth_handler(
    State(pool): State<PgPool>,
    Json(payload): Json<GoogleAuthRequest>,
) -> Result<impl IntoResponse, AppError> {
    let email = payload.email.trim().to_lowercase();
    if email.is_empty() {
        return Err(AppError::BadRequest("Valid Google email is required for authentication".to_string()));
    }

    let display_name = payload.name.unwrap_or_else(|| {
        email.split('@').next().unwrap_or("Google User").to_string()
    });

    let picture = payload.picture.unwrap_or_else(|| {
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80".to_string()
    });

    let sub = payload.sub.unwrap_or_default();

    // Check if employee already exists in PostgreSQL
    let emp_row = sqlx::query(
        r#"
        SELECT id, employee_number, first_name, last_name, email, job_title, metadata
        FROM employees
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
        "#,
    )
    .bind(&email)
    .fetch_optional(&pool)
    .await?;

    let user = if let Some(row) = emp_row {
        let id: uuid::Uuid = row.get("id");
        let first_name: String = row.get("first_name");
        let last_name: String = row.get("last_name");
        let db_email: String = row.get("email");
        let job_title: String = row.get("job_title");
        let mut metadata: Value = row.get("metadata");

        // Merge google info into metadata
        if let Some(obj) = metadata.as_object_mut() {
            obj.insert("avatar".to_string(), json!(picture));
            obj.insert("google_sub".to_string(), json!(sub));
            obj.insert("auth_provider".to_string(), json!("google"));
            obj.insert("last_login".to_string(), json!(chrono::Utc::now().to_rfc3339()));
        }

        let _ = sqlx::query(
            "UPDATE employees SET metadata = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        )
        .bind(&metadata)
        .bind(id)
        .execute(&pool)
        .await;

        let role = metadata
            .get("role")
            .and_then(|v| v.as_str())
            .unwrap_or("ADMIN")
            .to_string();

        AuthUser {
            id: id.to_string(),
            name: format!("{} {}", first_name, last_name).trim().to_string(),
            email: db_email,
            role,
            job_title,
            avatar: picture,
            hierarchy_path: None,
            gcp_connected: true,
            gcp_account: Some(email.clone()),
        }
    } else {
        // Register new employee from Google login as Admin
        let new_id = uuid::Uuid::new_v4();
        let parts: Vec<&str> = display_name.split_whitespace().collect();
        let first_name = parts.first().copied().unwrap_or("Google");
        let last_name = if parts.len() > 1 {
            parts[1..].join(" ")
        } else {
            "User".to_string()
        };
        let emp_num = format!("EMP-GGL-{}", &new_id.to_string()[..6].to_uppercase());
        let job_title = "Cloud & PAM Administrator";
        let meta = json!({
            "role": "Admin",
            "avatar": picture,
            "google_sub": sub,
            "auth_provider": "google",
            "is_superadmin": true,
            "gcp_iam_connected": true,
            "created_via": "google_oauth"
        });

        sqlx::query(
            r#"
            INSERT INTO employees (id, employee_number, first_name, last_name, email, job_title, metadata, employment_status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE')
            "#,
        )
        .bind(new_id)
        .bind(&emp_num)
        .bind(first_name)
        .bind(&last_name)
        .bind(&email)
        .bind(job_title)
        .bind(&meta)
        .execute(&pool)
        .await?;

        AuthUser {
            id: new_id.to_string(),
            name: display_name,
            email: email.clone(),
            role: "Admin".to_string(),
            job_title: job_title.to_string(),
            avatar: picture,
            hierarchy_path: Some("ROOT.ADMIN".to_string()),
            gcp_connected: true,
            gcp_account: Some(email.clone()),
        }
    };

    let token = format!("pg-google-token-{}", uuid::Uuid::new_v4());

    Ok(Json(AuthResponse {
        token,
        user,
        gcp_session: Some(GcpSessionInfo {
            active: true,
            account: email,
            status: "ACTIVE".to_string(),
        }),
    }))
}

async fn login_handler(
    State(pool): State<PgPool>,
    Json(payload): Json<LoginRequest>,
) -> Result<impl IntoResponse, AppError> {
    let email_req = payload.email.as_deref().unwrap_or("").trim().to_lowercase();
    let password_req = payload.password.as_deref().unwrap_or("").trim();

    if email_req.is_empty() {
        return Err(AppError::BadRequest("Corporate email address is required.".to_string()));
    }

    // Verify known dummy passwords if provided
    if !password_req.is_empty() {
        let is_valid = match email_req.as_str() {
            "admin@powergrip.internal" => password_req == "AdminPass2026!",
            "manager@powergrip.internal" => password_req == "ManagerPass2026!",
            "employee@powergrip.internal" => password_req == "EmployeePass2026!",
            _ => true,
        };
        if !is_valid {
            return Err(AppError::Unauthorized(
                "Invalid password for this account. Please check your credentials.".to_string(),
            ));
        }
    }

    let emp_row = sqlx::query(
        r#"
        SELECT id, employee_number, first_name, last_name, email, job_title, hierarchy_path::text as hierarchy_path, metadata
        FROM employees
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
        "#,
    )
    .bind(&email_req)
    .fetch_optional(&pool)
    .await?;

    let row = match emp_row {
        Some(r) => r,
        None => {
            return Err(AppError::Unauthorized(
                "Invalid credentials. No employee profile found for this corporate email address. Please sign in with Keycloak or contact your administrator.".to_string(),
            ));
        }
    };

    let id: uuid::Uuid = row.get("id");
    let first_name: String = row.get("first_name");
    let last_name: String = row.get("last_name");
    let email: String = row.get("email");
    let job_title: String = row.get("job_title");
    let hierarchy_path: Option<String> = row.get("hierarchy_path");
    let metadata: Value = row.get("metadata");

    let role = metadata
        .get("role")
        .and_then(|v| v.as_str())
        .unwrap_or("Employee")
        .to_string();

    let avatar = metadata
        .get("avatar")
        .and_then(|v| v.as_str())
        .unwrap_or_else(|| match role.to_lowercase().as_str() {
            "admin" => "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80",
            "manager" => "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
            _ => "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
        })
        .to_string();

    let user = AuthUser {
        id: id.to_string(),
        name: format!("{} {}", first_name, last_name).trim().to_string(),
        email: email.clone(),
        role,
        job_title,
        avatar,
        hierarchy_path,
        gcp_connected: false,
        gcp_account: None,
    };

    let token = format!("pg-jwt-sess-{}", uuid::Uuid::new_v4());

    Ok(Json(AuthResponse {
        token,
        user,
        gcp_session: None,
    }))
}

async fn get_current_user() -> impl IntoResponse {
    Json(json!({
        "status": "ready"
    }))
}
