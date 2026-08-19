#!/bin/sh
set -e

echo "🔐 Initializing HashiCorp Vault for PowerGrip SSH CA & PKI..."

export VAULT_ADDR="http://127.0.0.1:8200"
export VAULT_TOKEN="${VAULT_DEV_ROOT_TOKEN_ID:-root_dev_token_powergrip_2026}"

until vault status > /dev/null 2>&1; do
  echo "⏳ Waiting for Vault API to become responsive..."
  sleep 1
done

echo "✅ Vault is responsive. Enabling SSH CA Secrets Engine..."
vault secrets enable -path=ssh-client-signer ssh || true

echo "🔑 Configuring CA Signing Keys..."
vault write ssh-client-signer/config/ca generate_signing_key=true || true

echo "📜 Configuring Roles for Cloud Platform Engineers..."
vault write ssh-client-signer/roles/cloud-engineer \
  key_type=ca \
  algorithm_signer=rsa-sha2-512 \
  allow_user_certificates=true \
  allowed_users="ubuntu,ec2-user,root,admin,sre" \
  allowed_extensions="permit-pty,permit-port-forwarding" \
  default_extensions='{"permit-pty": ""}' \
  default_user="ubuntu" \
  ttl="1h" \
  max_ttl="24h"

echo "🎉 HashiCorp Vault SSH CA successfully initialized for PowerGrip!"
