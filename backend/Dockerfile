# ==============================================================================
# Multi-stage Dockerfile for PowerGrip Enterprise Rust Backend
# ==============================================================================

# Stage 1: Build binary in Linux environment
FROM rust:latest AS builder

WORKDIR /app

# Pre-compile dependencies to take advantage of Docker layer caching
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -rf src

# Copy actual source code
COPY src ./src

# Invalidate dummy build timestamp and build production release binary
RUN touch src/main.rs && cargo build --release

# Stage 2: Ultra-lightweight Debian Slim runtime
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy compiled Linux binary from builder stage
COPY --from=builder /app/target/release/powergrip-backend /app/powergrip-backend

# Listen on port 4000
EXPOSE 4000

ENV PORT=4000
ENV RUST_LOG=info,powergrip_backend=debug

# Container Healthcheck targeting the Axum health route
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4000/api/v1/health || exit 1

ENTRYPOINT ["/app/powergrip-backend"]
