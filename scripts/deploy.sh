#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${ROOT_DIR}"

echo "==> Pulling latest changes..."
git pull

echo "==> Building image..."
docker compose build --no-cache

echo "==> Stopping old container..."
docker compose down

echo "==> Starting service..."
docker compose up -d

echo "==> Done. Logs:"
docker compose logs --tail=50 sso
