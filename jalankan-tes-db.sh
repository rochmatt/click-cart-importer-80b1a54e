#!/usr/bin/env bash
# Menjalankan seluruh tes TERMASUK yang menyentuh PostgreSQL.
#
#   bash jalankan-tes-db.sh            # semua
#   bash jalankan-tes-db.sh src/lib/audit   # sebagian
#
# KENAPA TIDAK CUKUP `set -a; . .env.server.local`: berkas itu juga memuat
# NODE_ENV=production. Dengan NODE_ENV=production, React memuat build produksi
# yang TIDAK punya React.act, dan seluruh tes komponen gagal dengan
# "React.act is not a function" — pesan yang sama sekali tidak menyinggung
# NODE_ENV, sehingga mudah disalahartikan sebagai kerusakan komponen.
#
# Skrip ini hanya mengambil dua variabel yang benar-benar dibutuhkan tes.

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$APP_DIR/.env.server.local"
export PATH="/opt/node22/bin:$HOME/.bun/bin:$PATH"

if [ ! -f "$ENV_FILE" ]; then
  echo "Tidak menemukan $ENV_FILE" >&2
  exit 1
fi

ambil() { grep "^$1=" "$ENV_FILE" | cut -d= -f2- || true; }

DATABASE_URL="$(ambil DATABASE_URL)"
DATABASE_URL_APP="$(ambil DATABASE_URL_APP)"
export DATABASE_URL DATABASE_URL_APP

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL kosong di $ENV_FILE" >&2
  exit 1
fi

cd "$APP_DIR"
exec bunx vitest run "$@"
