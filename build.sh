#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${VITE_SUPABASE_URL:-}" ]]; then
  echo "ERROR: VITE_SUPABASE_URL is required for the production build." >&2
  exit 1
fi

if [[ -z "${VITE_SUPABASE_ANON_KEY:-}" ]]; then
  echo "ERROR: VITE_SUPABASE_ANON_KEY is required for the production build." >&2
  exit 1
fi

npm run build
