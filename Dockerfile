FROM node:18-slim

# Create app directory
WORKDIR /app

# Install git
RUN apt-get update && apt-get install -y git \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
RUN npm install

# Copy app source
COPY . .

# Create backup directory
RUN mkdir -p /backups && \
    chmod -R 777 /backups

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3000}/api/status || exit 1

# Default environment variables
ENV PUID=99 \
    PGID=100 \
    BACKUP_DIR=/backups \
    PORT=3000

# Add s6-overlay for proper permission handling
COPY <<'EOF' /entrypoint.sh
#!/bin/sh
echo "Starting with UID: $PUID, GID: $PGID"
groupmod -o -g "$PGID" node
usermod -o -u "$PUID" node
chown -R node:node /app /backups

# Switch to node user and start the application
exec su-exec node node index.js
EOF

RUN chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"]
