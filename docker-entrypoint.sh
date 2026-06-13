#!/bin/sh
set -e

# ── Auto-seed on first startup ─────────────────────────────────
if [ ! -f /app/data/.seeded ]; then
    echo "🌱 First startup detected — seeding database..."
    node db/seed.js
    touch /app/data/.seeded
    echo "✅ Database seeded"
    echo "─────────────────────────────────────"
    echo "📧 admin@lab.com    / Admin@123  (Admin)"
    echo "📧 tech@lab.com     / Tech@123   (Technician)"
    echo "📧 user@lab.com     / User@123   (User)"
    echo "─────────────────────────────────────"
fi

# ── Start the application ──────────────────────────────────
exec "$@"
