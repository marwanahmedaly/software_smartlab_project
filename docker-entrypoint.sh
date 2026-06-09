#!/bin/sh
set -e

# â”€â”€ Auto-seed on first startup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
if [ ! -f /app/data/.seeded ]; then
    echo "ðŸŒ± First startup detected â€” seeding database..."
    node db/seed.js
    touch /app/data/.seeded
    echo "âœ… Database seeded"
fi

# â”€â”€ Start the application â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exec "$@"
