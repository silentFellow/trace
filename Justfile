# Run `just` with no args to list every recipe.
default:
    @just --list

# --- Backend ---

# Start backend (:8081) and frontend (:3001) dev servers together, with live frontend reload.
dev:
    #!/usr/bin/env bash
    set -euo pipefail
    trap 'kill 0' EXIT INT TERM
    go run ./cmd/memos --port 8081 &
    (cd web && pnpm dev) &
    wait

# Run all Go tests.
test:
    @go test ./...

# Store tests, including DB drivers via TestContainers.
test-store:
    @go test -v ./store/...

# Server tests with the race detector.
test-server:
    @go test -v -race ./server/...

# Internal package tests with the race detector.
test-internal:
    @go test -v -race ./internal/...

# Run matching Go tests in one tree, e.g. `just test-one core TestFoo`.
test-one tree pattern:
    @go test -v -run {{pattern}} ./{{tree}}/...

# Match the CI tidy check.
tidy:
    @go mod tidy -go=1.27.0

# Go lint (config: .golangci.yaml).
lint:
    @golangci-lint run

# Go lint, auto-fixing what it can (including goimports).
lint-fix:
    @golangci-lint run --fix

# --- Frontend ---

# Install frontend dependencies.
web-install:
    @cd web && pnpm install

# Frontend dev server on :3001, proxying the API to :8081.
web-dev:
    @cd web && pnpm dev

# Type check + Biome lint.
web-lint:
    @cd web && pnpm lint

# Vitest unit tests.
web-test:
    @cd web && pnpm test

# Production frontend build.
web-build:
    @cd web && pnpm build

# Build the SPA into server/frontend/dist (what the Go binary embeds).
web-release:
    @cd web && pnpm release

# --- Protocol Buffers ---

# Regenerate Go + TypeScript + OpenAPI from proto sources.
proto-generate:
    @cd proto && buf generate

# Lint proto files.
proto-lint:
    @cd proto && buf lint

# Format proto files.
proto-format:
    @cd proto && buf format -w

# --- Docker (scripts/compose.yaml) ---

# Build and publish the stable Docker image. Run `podman login docker.io` first.
docker-publish: web-release
    @podman build --file scripts/Dockerfile --target monolithic --build-arg VERSION=dev --build-arg COMMIT="$(git rev-parse --short HEAD)" --tag docker.io/silentfellow/trace:stable .
    @podman push docker.io/silentfellow/trace:stable

# Start the app via podman compose (detached).
docker-up:
    @podman compose -f scripts/compose.yaml up -d

# Stop and remove the compose stack.
docker-down:
    @podman compose -f scripts/compose.yaml down

# Follow the compose stack's logs.
docker-logs:
    @podman compose -f scripts/compose.yaml logs -f
