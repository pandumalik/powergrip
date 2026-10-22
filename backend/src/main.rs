mod config;
mod db;
mod error;
mod models;
mod routes;
mod services;

use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    eprintln!("PowerGrip Backend starting up...");
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "powergrip_backend=info,tower_http=info,sqlx=warn".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = config::AppConfig::from_env();

    tracing::info!(
        "Connecting to PostgreSQL Database at {}...",
        config.database_url.split('@').last().unwrap_or("localhost")
    );

    let pool = match db::init_pool(&config.database_url).await {
        Ok(p) => {
            tracing::info!("PostgreSQL connection pool established successfully.");
            p
        }
        Err(err) => {
            tracing::warn!(
                "Initial connection to PostgreSQL at {} failed: {}. Utilizing lazy connection pool for resilience.",
                config.database_url.split('@').last().unwrap_or("localhost"),
                err
            );
            db::init_lazy_pool(&config.database_url)?
        }
    };

    // Configure CORS for web portal
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = routes::create_api_router(pool)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let addr: SocketAddr = format!("{}:{}", config.host, config.port).parse()?;
    tracing::info!("============================================================");
    tracing::info!("  PowerGrip Enterprise Backend (Rust Edition)");
    tracing::info!("  Listening on http://{}", addr);
    tracing::info!("  API V1 base: http://{}/api/v1", addr);
    tracing::info!("============================================================");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("Failed to listen for Ctrl+C shutdown signal");
    tracing::info!("Shutdown signal received, gracefully terminating PowerGrip backend...");
}
