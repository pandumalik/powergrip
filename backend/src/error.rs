use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

#[derive(Debug)]
#[allow(dead_code)]
pub enum AppError {
    NotFound(String),
    Conflict(String),
    BadRequest(String),
    Unauthorized(String),
    Database(sqlx::Error),
    Internal(String),
}

impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        if let sqlx::Error::Database(ref db_err) = err {
            // PostgreSQL code 23503 = foreign_key_violation
            if db_err.code().as_deref() == Some("23503") {
                return AppError::Conflict(
                    "Operation violates foreign key constraints: linked resources exist in the database.".to_string(),
                );
            }
            // PostgreSQL code 23505 = unique_violation
            if db_err.code().as_deref() == Some("23505") {
                return AppError::Conflict(format!(
                    "Unique constraint violation: {}",
                    db_err.message()
                ));
            }
        }
        AppError::Database(err)
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::BadRequest(format!("Invalid JSON payload: {}", err))
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message, error_type) = match self {
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg, "Not Found"),
            AppError::Conflict(msg) => (StatusCode::CONFLICT, msg, "Conflict"),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg, "Bad Request"),
            AppError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, msg, "Unauthorized"),
            AppError::Database(err) => {
                tracing::error!("Database query error: {:?}", err);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Database error: {}", err),
                    "Internal Server Error",
                )
            }
            AppError::Internal(msg) => {
                tracing::error!("Internal server error: {}", msg);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    msg,
                    "Internal Server Error",
                )
            }
        };

        let body = Json(json!({
            "statusCode": status.as_u16(),
            "message": message,
            "error": error_type,
        }));

        (status, body).into_response()
    }
}
