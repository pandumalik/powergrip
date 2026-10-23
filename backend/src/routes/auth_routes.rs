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
    pub provider: Option<String>, // "google", "local_gcp", "credentials"
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
        .route("/auth/me", get(get_current_user))
        .route("/auth/gcp-status", get(get_gcp_auth_status))
}

pub async fn check_local_gcp_session() -> Result<Option<String>, String> {
    #[cfg(windows)]
    let mut cmd = tokio::process::Command::new("cmd");
    #[cfg(windows)]
    let command = cmd.args(["/C", "gcloud", "auth", "list", "--format=json"]);

    #[cfg(not(windows))]
    let mut cmd = tokio::process::Command::new("gcloud");
    #[cfg(not(windows))]
    let command = cmd.args(["auth", "list", "--format=json"]);

    let output = match command.output().await {
        Ok(out) => out,
        Err(e) => return Err(format!("gcloud CLI execution error: {}", e)),
    };

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("gcloud returned error: {}", err));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let accounts: Value = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse gcloud auth JSON: {}", e))?;

    if let Some(arr) = accounts.as_array() {
        for acc in arr {
            let status = acc.get("status").and_then(|v| v.as_str()).unwrap_or("");
            if status.eq_ignore_ascii_case("ACTIVE") {
                if let Some(email) = acc.get("account").and_then(|v| v.as_str()) {
                    return Ok(Some(email.to_string()));
                }
            }
        }
        // Fallback to first account if available
        if let Some(first) = arr.first() {
            if let Some(email) = first.get("account").and_then(|v| v.as_str()) {
                return Ok(Some(email.to_string()));
            }
        }
    }

    Ok(None)
}

async fn get_gcp_auth_status() -> Result<impl IntoResponse, AppError> {
    match check_local_gcp_session().await {
        Ok(Some(account)) => Ok(Json(json!({
            "available": true,
            "connected": true,
            "account": account,
            "status": "ACTIVE",
            "isAdmin": account.eq_ignore_ascii_case("muhammad.galang@ist.id"),
            "message": format!("Active Google Cloud IAM identity detected: {}", account)
        }))),
        Ok(None) => Ok(Json(json!({
            "available": true,
            "connected": false,
            "account": null,
            "status": "NOT_LOGGED_IN",
            "isAdmin": false,
            "message": "gcloud is installed, but no active account is currently logged in. Run 'gcloud auth login' to connect."
        }))),
        Err(err) => Ok(Json(json!({
            "available": false,
            "connected": false,
            "account": null,
            "error": err,
            "status": "CLI_NOT_FOUND",
            "isAdmin": false,
            "message": "Google Cloud SDK CLI not detected in local path."
        }))),
    }
}

async fn login_handler(
    State(pool): State<PgPool>,
    Json(payload): Json<LoginRequest>,
) -> Result<impl IntoResponse, AppError> {
    let email_req = payload.email.as_deref().unwrap_or("").trim().to_lowercase();
    let provider = payload.provider.as_deref().unwrap_or("credentials");

    // Check if logging in via Google / local GCP
    let is_google = provider.eq_ignore_ascii_case("google") || provider.eq_ignore_ascii_case("local_gcp");
    
    let target_email = if is_google {
        if let Ok(Some(gcp_email)) = check_local_gcp_session().await {
            gcp_email.to_lowercase()
        } else if !email_req.is_empty() {
            email_req
        } else {
            "muhammad.galang@ist.id".to_string()
        }
    } else if !email_req.is_empty() {
        email_req
    } else {
        "muhammad.galang@ist.id".to_string()
    };

    // Find employee in database
    let emp_row = sqlx::query(
        r#"
        SELECT id, employee_number, first_name, last_name, email, job_title, metadata
        FROM employees
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
        "#,
    )
    .bind(&target_email)
    .fetch_optional(&pool)
    .await?;

    let user = if let Some(row) = emp_row {
        let id: uuid::Uuid = row.get("id");
        let first_name: String = row.get("first_name");
        let last_name: String = row.get("last_name");
        let email: String = row.get("email");
        let job_title: String = row.get("job_title");
        let metadata: Value = row.get("metadata");

        let role = metadata
            .get("role")
            .and_then(|v| v.as_str())
            .unwrap_or_else(|| {
                if email.eq_ignore_ascii_case("muhammad.galang@ist.id") {
                    "ADMIN"
                } else {
                    "SRE_LEAD"
                }
            })
            .to_string();

        let avatar = if email.eq_ignore_ascii_case("muhammad.galang@ist.id") {
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80".to_string()
        } else {
            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80".to_string()
        };

        AuthUser {
            id: id.to_string(),
            name: format!("{} {}", first_name, last_name).trim().to_string(),
            email,
            role,
            job_title,
            avatar,
            gcp_connected: is_google || target_email.eq_ignore_ascii_case("muhammad.galang@ist.id"),
            gcp_account: Some(target_email.clone()),
        }
    } else if target_email.eq_ignore_ascii_case("muhammad.galang@ist.id") {
        // Fallback for Muhammad Galang as Admin
        AuthUser {
            id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890".to_string(),
            name: "Muhammad Galang".to_string(),
            email: "muhammad.galang@ist.id".to_string(),
            role: "ADMIN".to_string(),
            job_title: "Principal Cloud Architect & PowerGrip Superadmin".to_string(),
            avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80".to_string(),
            gcp_connected: true,
            gcp_account: Some("muhammad.galang@ist.id".to_string()),
        }
    } else {
        // Fallback generic demo user
        AuthUser {
            id: format!("usr-{}", uuid::Uuid::new_v4()),
            name: target_email.split('@').next().unwrap_or("User").to_string(),
            email: target_email.clone(),
            role: "SRE_LEAD".to_string(),
            job_title: "Cloud Operations Specialist".to_string(),
            avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80".to_string(),
            gcp_connected: false,
            gcp_account: None,
        }
    };

    let token = format!("pg-jwt-sess-{}", uuid::Uuid::new_v4());

    let gcp_session = if user.gcp_connected {
        Some(GcpSessionInfo {
            active: true,
            account: target_email.clone(),
            status: "ACTIVE".to_string(),
        })
    } else {
        None
    };

    Ok(Json(AuthResponse {
        token,
        user,
        gcp_session,
    }))
}

async fn get_current_user() -> impl IntoResponse {
    // Default session endpoint for client verification
    Json(json!({
        "authenticated": true,
        "defaultAdmin": {
            "name": "Muhammad Galang",
            "email": "muhammad.galang@ist.id",
            "role": "ADMIN",
            "jobTitle": "Principal Cloud Architect & PowerGrip Superadmin"
        }
    }))
}
