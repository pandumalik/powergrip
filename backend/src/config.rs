use std::env;

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub port: u16,
    pub database_url: String,
    pub host: String,
}

impl AppConfig {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();

        let port = env::var("PORT")
            .ok()
            .and_then(|p| p.parse::<u16>().ok())
            .unwrap_or(4000);

        let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());

        let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| {
            "postgresql://powergrip_user:powergrip_secure_password_2026@localhost:5432/powergrip_db"
                .to_string()
        });

        Self {
            port,
            database_url,
            host,
        }
    }
}
