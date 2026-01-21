
# -----------------------------------------------------------------------------
# Stage 1: Build (Node.js + npm present only here)
# -----------------------------------------------------------------------------
FROM node:20.19.6-bookworm-slim@sha256:4f415de854687bf6bee2f05878f0ed43e74c6f9f6d6bb886f3dfbbc4ce1ac5a6 AS build

# 1) Ensure Debian repositories use HTTPS (your existing hardening)
RUN sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources \
 && sed -i 's|http://security.debian.org|https://security.debian.org|g' /etc/apt/sources.list.d/debian.sources || true

# 2) Patch OS packages in the build image (keeps build tooling up-to-date)
RUN apt-get update \
 && apt-get upgrade -y \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

# 3) Create a non-root user (helps even during build if you choose to drop privileges later)
RUN groupadd --system appuser \
 && useradd  --system --gid appuser --create-home --home-dir /home/appuser appuser

WORKDIR /app

# 4) Install deps using lockfile for repeatable builds
#    - Prefer npm ci for deterministic installs (recommended for CI/CD and security)
COPY package*.json ./
RUN npm ci

# 5) Copy application code and build
COPY . .
RUN npm run build

# (Optional) If you have build-time secrets or want tighter hygiene,
# you can also clean npm cache in the build stage:
# RUN npm cache clean --force


# -----------------------------------------------------------------------------
# Stage 2: Runtime (No Node, no npm, runs as non-root)
# -----------------------------------------------------------------------------
# Nginx "unprivileged" image runs as a non-root user by default
# and avoids shipping npm entirely (removes the tar@6.2.1 issue from npm CLI deps).
FROM nginxinc/nginx-unprivileged:alpine3.22@sha256:062042031264627f065dbe8e16a2b54ec9a12757843c2d956e65623e650a1142 AS runtime

# Patch OS packages in runtime image too (apk equivalent of apt upgrade)
# RUN apk update && apk upgrade --no-cache

# Vite build output is typically /app/dist
# Nginx serves static content from /usr/share/nginx/html
COPY --from=build /app/dist /usr/share/nginx/html

# Configure Nginx to listen on 3001 and support SPA routing (Vite apps often need this).
# NOTE: If your app is not an SPA, you can remove the "try_files" line.
RUN printf '%s\n' \
  'server {' \
  '  listen 3001;' \
  '  server_name _;' \
  '' \
  '  root   /usr/share/nginx/html;' \
  '  index  index.html;' \
  '' \
  '  # SPA fallback (serves index.html for non-file routes)' \
  '  location / {' \
  '    try_files $uri $uri/ /index.html;' \
  '  }' \
  '' \
  '  # Basic hardening headers (safe defaults; adjust if you already set these elsewhere)' \
  '  add_header X-Content-Type-Options nosniff always;' \
  '  add_header X-Frame-Options DENY always;' \
  '  add_header Referrer-Policy no-referrer always;' \
  '  add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;' \
  '}' \
  > /etc/nginx/conf.d/default.conf

EXPOSE 3001

# nginx-unprivileged already runs as non-root, so no USER directive is needed.
# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]