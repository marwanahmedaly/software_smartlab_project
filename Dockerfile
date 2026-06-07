# ── Base Image ────────────────────────────────────────────────
FROM node:20-alpine

# Install Python 3, pip, and curl for ML scripts and healthchecks
RUN apk add --no-cache \
    python3 \
    py3-pip \
    curl \
    make \
    gcc \
    g++ \
    musl-dev \
    python3-dev

# Create app directory
WORKDIR /app

# ── Install Node dependencies ─────────────────────────────────
COPY package*.json ./
RUN npm ci --omit=dev

# ── Install Python dependencies ───────────────────────────────
COPY requirements.txt ./
RUN python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir -r requirements.txt
ENV PATH="/opt/venv/bin:$PATH"

# ── Copy application code ─────────────────────────────────────
COPY . .

# ── Create persistent directories ─────────────────────────────
RUN mkdir -p /app/uploads /app/data

# ── Create non-root user ──────────────────────────────────────
# Note: For production, uncomment and use a non-root user
# RUN addgroup -g 1000 -S nodejs && \
#     adduser -S nodejs -u 1000 -G nodejs && \
#     chown -R nodejs:nodejs /app /app/data /app/uploads
# USER nodejs

# ── Entrypoint for auto-seeding ───────────────────────────────
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# ── Expose and run ────────────────────────────────────────────
EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
