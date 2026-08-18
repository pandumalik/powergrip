export default () => ({
  port: parseInt(process.env.PORT || '4000', 10),
  database: {
    url: process.env.DATABASE_URL || 'postgresql://vcams_user:vcams_secure_password_2026@localhost:5432/vcams_db',
  },
  keycloak: {
    authServerUrl: process.env.KEYCLOAK_AUTH_SERVER_URL || 'http://localhost:8080',
    realm: process.env.KEYCLOAK_REALM || 'vcams-realm',
    clientId: process.env.KEYCLOAK_CLIENT_ID || 'vcams-backend',
  },
  vault: {
    addr: process.env.VAULT_ADDR || 'http://localhost:8200',
    token: process.env.VAULT_ROOT_TOKEN || 'root_dev_token_vcams_2026',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || 'redis_secure_password_2026',
  },
  minio: {
    apiPort: parseInt(process.env.MINIO_API_PORT || '9000', 10),
    bucket: process.env.MINIO_BUCKET_NAME || 'vcams-contracts',
  },
});
