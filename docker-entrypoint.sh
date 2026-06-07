#!/bin/sh
set -e

# ── Auto-seed on first startup ────────────────────────────────
if [ ! -f /app/data/.seeded ]; then
    echo "🌱 First startup detected — seeding database..."
    node db/seed.js
    touch /app/data/.seeded
    echo "✅ Database seeded"
fi

# ── Start the application ─────────────────────────────────────
exec "$@"
