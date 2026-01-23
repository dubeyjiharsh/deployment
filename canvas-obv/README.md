Below is a practical, **step-by-step path** to get you working with **OpenBao** in **dev for testing**, and then migrate cleanly to a **production-grade setup**.

OpenBao, in plain terms: it’s a **secrets manager** (an open-source fork of HashiCorp Vault) that **encrypts secrets before storing them** and gives you controlled, audited access via **tokens + policies**. ([OpenBao][1])

Your current `docker-compose.yml` (dev mode) is here: 

---

## 0) Read this first (important)

* **Dev mode is intentionally insecure** and should **never** be used in production. It runs in-memory and short-circuits real security setup. ([OpenBao][2])
* Your compose sets a static root token (`root-token`). That’s fine for local testing, **not acceptable for prod**.

---

## 1) Bring up OpenBao in dev (your current setup)

### 1.1 Start it

From the folder containing your `docker-compose.yml`:

```bash
docker compose up -d
docker logs -f openbao
```

If it started correctly, it’s listening on:

* API/UI: `http://localhost:8200` (UI is typically at `/ui`)

### 1.2 Confirm it’s alive

```bash
curl -s http://localhost:8200/v1/sys/health | jq .
```

In dev mode it should report “initialized” and “unsealed” (dev mode starts unsealed). ([OpenBao][2])

---

## 2) Use the CLI inside the container (easiest way to learn)

Your container already has the `bao` CLI.

### 2.1 Open a shell

```bash
docker exec -it openbao sh
```

### 2.2 Point the CLI to the server + login with your dev root token

Inside the container:

```bash
export BAO_ADDR='http://127.0.0.1:8200'
export BAO_TOKEN='root-token'
bao status
bao login "$BAO_TOKEN"
```

---

## 3) Store and fetch secrets (KV engine)

OpenBao stores secrets through “**secrets engines**”. The most common is **KV** (key/value).

### 3.1 Enable KV v2 at path `secret/`

```bash
bao secrets enable -path=secret kv-v2
```

### 3.2 Write a secret

```bash
bao kv put secret/myapp username="ankit" password="supersecret"
```

### 3.3 Read it back

```bash
bao kv get secret/myapp
```

### 3.4 Fetch a single field (nice for apps/scripts)

```bash
bao kv get -field=password secret/myapp
```

---

## 4) Do it via HTTP API (how apps usually integrate)

OpenBao/Vault-compatible API uses the `X-Vault-Token` header.

### 4.1 Write

```bash
curl -s \
  -H "X-Vault-Token: root-token" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"data":{"username":"ankit","password":"supersecret"}}' \
  http://localhost:8200/v1/secret/data/myapp | jq .
```

### 4.2 Read

```bash
curl -s \
  -H "X-Vault-Token: root-token" \
  http://localhost:8200/v1/secret/data/myapp | jq .
```

---

## 5) The *right* dev-to-prod learning milestone: policies + non-root tokens

**Strong opinion:** don’t let your application use a root token even in dev. Train yourself the production way.

### 5.1 Create a minimal policy for your app

Inside the container, create a policy file:

```bash
cat > myapp-policy.hcl <<'HCL'
path "secret/data/myapp" {
  capabilities = ["read"]
}
HCL
```

Apply it:

```bash
bao policy write myapp-read myapp-policy.hcl
```

### 5.2 Create a token with that policy

```bash
bao token create -policy="myapp-read" -ttl="1h"
```

Copy the token it prints, then test read-only access:

```bash
export BAO_TOKEN="<PASTE_NEW_TOKEN>"
bao kv get secret/myapp
```

Try writing (it should fail):

```bash
bao kv put secret/myapp x=1
```

---

# Moving to Production (the real setup)

## 6) What changes in production

In production, OpenBao runs with:

* a **config file** (HCL/JSON), not `-dev` ([OpenBao][3])
* **persistent storage**, typically **Integrated Storage (Raft)** ([OpenBao][4])
* **init + unseal** ceremony (or auto-unseal)
* **TLS**, audit logging, and real auth methods (AppRole/K8s/OIDC)

---

## 7) Production-grade Docker Compose (single node) + config

**Note:** A single-node prod instance is still a risk. Raft is designed for clusters; OpenBao recommends multiple servers for failure tolerance. ([OpenBao][5])
But for an initial production-like environment, here is the *correct structure*.

### 7.1 Create `config.hcl` on your host

Create a folder like `./openbao-prod/` and add `config.hcl`:

```hcl
ui = true

listener "tcp" {
  address         = "0.0.0.0:8200"
  tls_disable     = 1
}

storage "raft" {
  path    = "/openbao/raft"
  node_id = "node1"
}

api_addr     = "http://YOUR_SERVER_IP_OR_DNS:8200"
cluster_addr = "http://YOUR_SERVER_IP_OR_DNS:8201"
```

* For a real production deployment, **enable TLS** (set `tls_disable = 0` and provide cert/key files).
* `cluster_addr` is required for raft. ([OpenBao][4])

### 7.2 Production `docker-compose.yml` (example)

```yaml
version: "3.9"

services:
  openbao:
    image: openbao/openbao:2.4.4
    container_name: openbao
    ports:
      - "8200:8200"
      - "8201:8201"
    cap_add:
      - IPC_LOCK
    command: ["bao", "server", "-config=/openbao/config/config.hcl"]
    volumes:
      - bao-raft:/openbao/raft
      - ./openbao-prod/config.hcl:/openbao/config/config.hcl:ro
    restart: unless-stopped

volumes:
  bao-raft:
```

**Why pin version?** `:latest` is how you accidentally upgrade and break prod. (Pinning is professional hygiene.)

---

## 8) Initialize + unseal (production mode)

After starting the container:

```bash
docker compose up -d
docker exec -it openbao sh
export BAO_ADDR='http://127.0.0.1:8200'
```

### 8.1 Initialize

This generates:

* **unseal keys** (split using Shamir)
* an initial **root token**

```bash
bao operator init -key-shares=5 -key-threshold=3
```

**Store the output securely.** You need at least 3 unseal keys to unseal.

### 8.2 Unseal (run 3 times with 3 different keys)

```bash
bao operator unseal
bao operator unseal
bao operator unseal
```

### 8.3 Login with root token (only for bootstrapping)

```bash
bao login
```

---

## 9) Production basics you should do immediately

### 9.1 Enable audit logging (non-negotiable)

Example (inside container) to log to a file:

```bash
bao audit enable file file_path=/openbao/raft/audit.log
```

### 9.2 Create real auth for apps (AppRole is common outside K8s)

Enable AppRole:

```bash
bao auth enable approle
```

Create a policy for your service (read-only example):

```bash
cat > myapp-prod-policy.hcl <<'HCL'
path "secret/data/myapp" {
  capabilities = ["read"]
}
HCL
bao policy write myapp-read myapp-prod-policy.hcl
```

Create an AppRole:

```bash
bao write auth/approle/role/myapp token_policies="myapp-read" token_ttl="1h" token_max_ttl="4h"
```

Fetch RoleID:

```bash
bao read auth/approle/role/myapp/role-id
```

Generate SecretID:

```bash
bao write -f auth/approle/role/myapp/secret-id
```

Your app exchanges RoleID+SecretID for a token:

```bash
bao write auth/approle/login role_id="..." secret_id="..."
```

Now your app uses that token to read secrets.

---

## 10) Fixes/improvements to your current dev compose

From your file: you mount `bao-data:/openbao/data` but dev mode is **in-memory**, so that volume doesn’t give you “prod-like persistence”. Dev mode is meant to be disposable.  ([OpenBao][2])

Also, it’s cleaner to define the volume explicitly at the bottom:

```yaml
volumes:
  bao-data:
```

---

## What I recommend you do next (in order)

1. Keep your current dev compose, but practice with **KV + policies + non-root token** (Sections 3–5).
2. Stand up the **raft-based** config (Sections 7–8) *even on your laptop* to learn init/unseal.
3. Only then add **TLS**, audit, and a real app auth method.

If you tell me your target production environment (**single VM**, **Docker Swarm**, **Kubernetes**, **ECS**, etc.), I’ll give you the exact “production-ready” blueprint for that platform (TLS, HA, backup/restore, upgrades, and how your app should authenticate).

[1]: https://openbao.org/?utm_source=chatgpt.com "OpenBao"
[2]: https://openbao.org/docs/concepts/dev-server/?utm_source=chatgpt.com "\"Dev\" server mode"
[3]: https://openbao.org/docs/configuration/?utm_source=chatgpt.com "OpenBao configuration"
[4]: https://openbao.org/docs/configuration/storage/raft/?utm_source=chatgpt.com "Integrated Storage (Raft) backend"
[5]: https://openbao.org/docs/internals/integrated-storage/?utm_source=chatgpt.com "Integrated Storage"