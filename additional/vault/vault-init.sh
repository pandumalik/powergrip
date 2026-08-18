#!/usr/bin/env sh
# ==============================================================================
# HashiCorp Vault Initial Setup for V-CAMS (SSH CA & Dynamic Secrets Engine)
# ==============================================================================

set -e

echo "==> Configuring Vault SSH Certificate Authority for Ephemeral PAM Access..."

export VAULT_ADDR="http://127.0.0.1:8200"
export VAULT_TOKEN="${VAULT_DEV_ROOT_TOKEN_ID:-root_dev_token_vcams_2026}"

# 1. Enable SSH CA Secrets Engine
vault secrets enable -path=ssh-client-signer ssh || true

# 2. Generate CA Signing Key
vault write ssh-client-signer/config/ca generate_signing_key=true || true

# 3. Configure Roles for Engineers (Max TTL: 4 hours)
vault write ssh-client-signer/roles/devops-client-role - <<"EOF"
{
  "allow_user_certificates": true,
  "allowed_users": "*",
  "allowed_extensions": "permit-pty,permit-port-forwarding",
  "default_extensions": {
    "permit-pty": ""
  },
  "key_type": "ca",
  "default_user": "ubuntu",
  "ttl": "4h0m0s",
  "max_ttl": "8h0m0s"
}
EOF

# 4. Enable KV v2 Secret Engine for Cloud IAM & VPN configs
vault secrets enable -path=secret kv-v2 || true

echo "==> Vault initialization complete!"
