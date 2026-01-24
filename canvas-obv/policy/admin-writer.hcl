# Write/update secrets for Azure OpenAI configs
path "secret/data/azureopenai/*" {
  capabilities = ["create", "update"]
}

# Optional: list metadata (useful for admin screens)
path "secret/metadata/azureopenai/*" {
  capabilities = ["list", "read"]
}
