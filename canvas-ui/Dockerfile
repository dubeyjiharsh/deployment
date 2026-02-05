# -----------------------------------------------------------------------------
# Stage 1: Build (Node.js + npm present only here)
# -----------------------------------------------------------------------------
FROM node:20.19.6-bookworm-slim@sha256:4f415de854687bf6bee2f05878f0ed43e74c6f9f6d6bb886f3dfbbc4ce1ac5a6 AS build

# 1) Ensure Debian repositories use HTTPS
RUN sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources \
 && sed -i 's|http://security.debian.org|https://security.debian.org|g' /etc/apt/sources.list.d/debian.sources || true

# 2) Patch OS packages in the build image
RUN apt-get update \
 && apt-get upgrade -y \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

# 3) Create a non-root user
RUN groupadd --system appuser \
 && useradd  --system --gid appuser --create-home --home-dir /home/appuser appuser

WORKDIR /app

# 4) Install deps using lockfile for repeatable builds
COPY package*.json ./
RUN npm ci

# 5) Copy application code
COPY . .

# 6) Build with base path for asset loading
# This ensures assets load from /canvas/assets/... instead of /assets/...
ARG VITE_BASE_PATH=/canvas/
ENV VITE_BASE_PATH=${VITE_BASE_PATH}
RUN npm run build

# 7) AFTER build completes, ensure images are in the dist folder
# Copy images to dist/images if they're not already there from the build
RUN mkdir -p dist/images && \
    if [ -d "public/images" ]; then \
      cp -r public/images/* dist/images/ 2>/dev/null || true; \
    fi

# -----------------------------------------------------------------------------
# Stage 2: Runtime (No Node, no npm, runs as non-root)
# -----------------------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:1.27-alpine3.21 AS runtime

# ==============================================================================
# FIX: Update vulnerable packages
# ==============================================================================
USER root

# Add Alpine edge repositories to get libavif 1.3.0+
RUN echo "https://dl-cdn.alpinelinux.org/alpine/edge/main" >> /etc/apk/repositories && \
    echo "https://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories && \
    apk update && \
    apk upgrade --no-cache && \
    apk upgrade --no-cache libavif libgd --repository=https://dl-cdn.alpinelinux.org/alpine/edge/community && \
    rm -rf /var/cache/apk/*

# Install envsubst for runtime config injection
RUN apk add --no-cache gettext

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html
# Ensure nginx user owns html dir for runtime config write
RUN chown -R nginx:nginx /usr/share/nginx/html

# Copy runtime config template
COPY public-config.template.js /etc/nginx/config.template.js
RUN chmod 644 /etc/nginx/config.template.js

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod 755 /entrypoint.sh

# Configure Nginx to listen on 3000 and support SPA routing with /canvas base path
RUN printf '%s\n' \
  'server {' \
  '  listen 3000;' \
  '  server_name _;' \
  '' \
  '  root   /usr/share/nginx/html;' \
  '  index  index.html;' \
  '' \
  '  # Serve images directly from /images path (for AKS ingress)' \
  '  location /images/ {' \
  '    alias /usr/share/nginx/html/images/;' \
  '    expires 1y;' \
  '    add_header Cache-Control "public, immutable";' \
  '    add_header X-Content-Type-Options nosniff always;' \
  '  }' \
  '' \
  '  # Serve from /canvas base path' \
  '  location /canvas/ {' \
  '    alias /usr/share/nginx/html/;' \
  '    try_files $uri $uri/ /canvas/index.html;' \
  '' \
  '    # Ensure proper MIME types for assets' \
  '    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$ {' \
  '      expires 1y;' \
  '      add_header Cache-Control "public, immutable";' \
  '    }' \
  '  }' \
  '' \
  '  # Fallback for root path' \
  '  location = / {' \
  '    return 301 /canvas/;' \
  '  }' \
  '' \
  '  # Basic hardening headers' \
  '  add_header X-Content-Type-Options nosniff always;' \
  '  add_header X-Frame-Options DENY always;' \
  '  add_header Referrer-Policy no-referrer always;' \
  '  add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;' \
  '}' \
  > /etc/nginx/conf.d/default.conf

# Switch back to nginx user
USER nginx

EXPOSE 3000

# Use entrypoint script to inject config and start nginx
ENTRYPOINT ["/entrypoint.sh"]