#!/bin/sh
set -e

# Default values if not provided
KEYCLOAK_URL="${KEYCLOAK_URL}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-canvas-realm}"
KEYCLOAK_CLIENT_ID="${KEYCLOAK_CLIENT_ID:-canvas-client}"
API_BASE_URL="${API_BASE_URL}"
BASE_PATH="${BASE_PATH:-/canvas}"

echo "Generating runtime config with:"
echo "  KEYCLOAK_URL: ${KEYCLOAK_URL}"
echo "  KEYCLOAK_REALM: ${KEYCLOAK_REALM}"
echo "  KEYCLOAK_CLIENT_ID: ${KEYCLOAK_CLIENT_ID}"
echo "  API_BASE_URL: ${API_BASE_URL}"
echo "  BASE_PATH: ${BASE_PATH}"

# Generate config.js from template
envsubst '${KEYCLOAK_URL} ${KEYCLOAK_REALM} ${KEYCLOAK_CLIENT_ID} ${API_BASE_URL} ${BASE_PATH}' \
  < /etc/nginx/config.template.js \
  > /usr/share/nginx/html/config.js

echo "Runtime config generated successfully"

# Start nginx
exec nginx -g 'daemon off;'