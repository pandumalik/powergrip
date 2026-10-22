pub mod access_routes;
pub mod client_routes;
pub mod cloud_credential_routes;
pub mod employee_routes;
pub mod inventory_routes;
pub mod misc_routes;
pub mod project_routes;

use axum::{response::IntoResponse, routing::get, Json, Router};
use serde_json::json;
use sqlx::PgPool;

pub fn create_api_router(pool: PgPool) -> Router {
    let api_v1 = Router::new()
        .merge(client_routes::router())
        .merge(project_routes::router())
        .merge(inventory_routes::router())
        .merge(cloud_credential_routes::router())
        .merge(access_routes::router())
        .merge(employee_routes::router())
        .merge(misc_routes::router())
        .route("/health", get(health_check))
        .with_state(pool.clone());

    Router::new()
        .route("/health", get(health_check))
        .nest("/api/v1", api_v1)
        .with_state(pool)
}

async fn health_check() -> impl IntoResponse {
    Json(json!({
        "status": "healthy",
        "service": "powergrip-backend-rust",
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "version": "2.0.0"
    }))
}
