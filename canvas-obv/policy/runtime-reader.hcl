path "secret/data/azureopenai/*" {
  capabilities = ["read"]
}

path "secret/metadata/azureopenai/*" {
  capabilities = ["list", "read"]
}
