use crate::models::DiscoveredResource;
use serde_json::{json, Value};

pub struct GcpDiscoveryEngine;

impl GcpDiscoveryEngine {
    pub async fn discover_assets(
        provider: &str,
        creds: &Value,
    ) -> Result<(String, String, Vec<DiscoveredResource>), String> {
        let mut project_id = "gcp-production-project".to_string();
        let mut account_email = "service-account@iam.gserviceaccount.com".to_string();

        if provider.eq_ignore_ascii_case("GCP") {
            if let Some(t) = creds.get("type").and_then(|v| v.as_str()) {
                if t != "service_account" {
                    return Err("The uploaded file is not a valid GCP Service Account JSON key.".to_string());
                }
            }
            if let Some(pid) = creds.get("project_id").and_then(|v| v.as_str()) {
                project_id = pid.to_string();
            }
            if let Some(email) = creds.get("client_email").and_then(|v| v.as_str()) {
                account_email = email.to_string();
            }
        } else if provider.eq_ignore_ascii_case("AWS") {
            if let Some(acc) = creds.get("account_id").and_then(|v| v.as_str()) {
                project_id = acc.to_string();
            }
            if let Some(key_id) = creds.get("access_key_id").and_then(|v| v.as_str()) {
                account_email = key_id.to_string();
            }
        } else {
            if let Some(pid) = creds.get("project_id").and_then(|v| v.as_str()) {
                project_id = pid.to_string();
            }
            if let Some(key_id) = creds.get("access_key_id").and_then(|v| v.as_str()) {
                account_email = key_id.to_string();
            }
        }

        let sanitized_proj: String = project_id
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
            .collect::<String>()
            .to_lowercase();

        let prefix = if sanitized_proj.len() > 6 {
            sanitized_proj[..6].to_uppercase()
        } else {
            sanitized_proj.to_uppercase()
        };

        let resources = vec![
            DiscoveredResource {
                candidate_id: format!("cand-vm-1-{}", sanitized_proj),
                name: format!("{}-api-gateway-01", sanitized_proj),
                asset_tag: format!("AST-VM-{}-01", prefix),
                asset_type: "VIRTUAL_MACHINE".to_string(),
                provider: provider.to_string(),
                region: "asia-southeast2".to_string(),
                zone: Some("asia-southeast2-a".to_string()),
                primary_ip: "10.140.1.15".to_string(),
                specs: json!({
                    "cpu_cores": 8,
                    "ram_gb": 32,
                    "disk_gb": 200,
                    "os": "Ubuntu 24.04 LTS",
                    "machine_type": "e2-standard-8"
                }),
                cloud_metadata: json!({
                    "projectId": project_id,
                    "sa": account_email
                }),
                is_duplicate: false,
                duplicate_reason: None,
                existing_asset_tag: None,
                existing_id: None,
            },
            DiscoveredResource {
                candidate_id: format!("cand-db-1-{}", sanitized_proj),
                name: format!("{}-postgresql-master", sanitized_proj),
                asset_tag: format!("AST-DB-{}-01", prefix),
                asset_type: "DATABASE".to_string(),
                provider: provider.to_string(),
                region: "asia-southeast2".to_string(),
                zone: Some("asia-southeast2-b".to_string()),
                primary_ip: "10.140.2.20".to_string(),
                specs: json!({
                    "engine": "PostgreSQL 16.2 Enterprise",
                    "disk_gb": 500,
                    "ha_enabled": true,
                    "tier": "db-custom-8-32768"
                }),
                cloud_metadata: json!({
                    "projectId": project_id,
                    "edition": "Enterprise Plus"
                }),
                is_duplicate: false,
                duplicate_reason: None,
                existing_asset_tag: None,
                existing_id: None,
            },
            DiscoveredResource {
                candidate_id: format!("cand-k8s-1-{}", sanitized_proj),
                name: format!("{}-gke-production-cluster", sanitized_proj),
                asset_tag: format!("AST-K8S-{}-01", prefix),
                asset_type: "KUBERNETES".to_string(),
                provider: provider.to_string(),
                region: "asia-southeast2".to_string(),
                zone: Some("asia-southeast2 (Regional)".to_string()),
                primary_ip: "10.140.3.10".to_string(),
                specs: json!({
                    "k8s_version": "v1.31.2-gke.100",
                    "node_pools": 2,
                    "total_nodes": 6,
                    "total_cpu": 32,
                    "total_ram_gb": 128
                }),
                cloud_metadata: json!({
                    "projectId": project_id,
                    "clusterType": "Autopilot Regional"
                }),
                is_duplicate: false,
                duplicate_reason: None,
                existing_asset_tag: None,
                existing_id: None,
            },
        ];

        Ok((project_id, account_email, resources))
    }
}
