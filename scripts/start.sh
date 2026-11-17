#!/usr/bin/env sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$repo_root"

if [ ! -f .env ]; then
  cp .env.example .env
fi

python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r backend/requirements.txt

api_port=$(sed -n 's/^API_PORT=//p' .env | head -n 1)
if [ -z "$api_port" ]; then
  api_port=8001
fi

exec uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port "$api_port"
