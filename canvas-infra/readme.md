
# GAP Canvas - Postgres Helm chart (infra)

This document explains how the `gap-canvas-postgres` Helm chart (under `infra/helm/gap-canvas-postgres`) deploys PostgreSQL for the GAP Canvas application, and provides common commands and notes for deployment, secrets, storage, and network policy.

**Paths referenced**
- Chart: infra/helm/gap-canvas-postgres/templates/Chart.yaml
- Service: infra/helm/gap-canvas-postgres/templates/service.yaml
- StatefulSet + PVC: infra/helm/gap-canvas-postgres/templates/statefulset.yaml
- Init scripts ConfigMap: infra/helm/gap-canvas-postgres/templates/configmap-initdb.yaml
- NetworkPolicy: infra/helm/gap-canvas-postgres/templates/networkpolicy.yaml

## Chart overview

- `Chart.yaml` contains chart metadata and `appVersion` (Postgres major version). Update `version` when chart templates or defaults change.
- The chart deploys a single Postgres pod using a `StatefulSet` and a `volumeClaimTemplates` entry for persistent storage.
- Initialization SQL/scripts are provided via a ConfigMap mounted into `/docker-entrypoint-initdb.d` and executed only on first initialization (when the PVC is empty).
- Database credentials (POSTGRES_USER, POSTGRES_DB, POSTGRES_PASSWORD) are expected to be provided via a Kubernetes `Secret` (see Secrets section below).

## Important values (values.yaml)

The chart reads configuration from `values.yaml`. Key values used by the templates:

- `service.type` — Service type (`ClusterIP`, `LoadBalancer`, `NodePort`) used by `service.yaml`.
- `service.port` — Port exposed by the Service and referenced by NetworkPolicy.
- `image.repository` / `image.tag` / `image.pullPolicy` — Postgres image settings.
- `persistence.size` — PVC size request for Postgres data.
- `persistence.storageClassName` — Optional storage class for PVCs.
- `resources` — CPU/memory requests and limits for the Postgres container.
- `securityContext` — `runAsUser`, `runAsGroup`, `fsGroup` used in the Pod spec.
- `networkPolicy.enabled` — whether the NetworkPolicy manifest is rendered.

Open `infra/helm/gap-canvas-postgres/values.yaml` to adjust defaults for your environment before installing the chart.

## Secrets (database credentials)

Create a Kubernetes Secret for database credentials. The templates expect a Secret named `<release>-auth` (where `<release>` is the Helm release name returned by Helm). Example:

```bash
kubectl create secret generic <release>-auth \
	--from-literal=POSTGRES_USER=<dbuser> \
	--from-literal=POSTGRES_PASSWORD='<strong-password>' \
	--from-literal=POSTGRES_DB=<dbname>
```

Alternatively, create a YAML Secret from `kubectl create secret generic --from-file` or use sealed-secrets/External Secrets in production.

## Init scripts

Place any initialization SQL or shell scripts in `infra/helm/gap-canvas-postgres/sql/` and reference them in the `configmap-initdb.yaml` (the chart includes `01_init.sql`). Files included in the ConfigMap are mounted to `/docker-entrypoint-initdb.d` and executed only on first initialization of the database volume.

Notes:
- Use numeric prefixes (e.g. `01_`, `02_`) to control execution order.
- Scripts run only when the PVC is empty; to re-run scripts you must reinitialize the data (wipe PVC) or run ad-hoc jobs.

## NetworkPolicy

The chart includes a NetworkPolicy template (rendered when `networkPolicy.enabled` is `true`) to restrict ingress to the Postgres pods. By default the example is permissive (allows traffic from any namespace) to avoid accidental lockout. In production, tighten the policy by using `namespaceSelector` and/or `podSelector` matching your backend or namespace labels.

Example production restriction suggestion (values or cluster labels):
- Allow only pods in the `canvas` namespace with label `app.kubernetes.io/name=gap-backend`.

## Deploying the chart

1. Customize `values.yaml` in the chart directory (or prepare an overrides file `my-values.yaml`).

2. Create the auth Secret (see Secrets section).

3. Install the chart:

```bash
helm install <release> infra/helm/gap-canvas-postgres -f infra/helm/gap-canvas-postgres/values.yaml
```

Or with an overrides file:

```bash
helm install <release> infra/helm/gap-canvas-postgres -f my-values.yaml
```

4. Verify resources:

```bash
kubectl get pods -l app.kubernetes.io/instance=<release>
kubectl get pvc -l app.kubernetes.io/instance=<release>
kubectl get svc -l app.kubernetes.io/instance=<release>
```

To view Postgres logs:

```bash
kubectl logs statefulset/<release>-gap-canvas-postgres-0
```

## Accessing Postgres

- For `ClusterIP` services, your backend pods should connect to the Service name returned by the chart (the helper `fullname`); the chart's Service exposes the configured port (`service.port`).
- For `LoadBalancer` or `NodePort`, use `kubectl get svc` to fetch the external IP/port assigned by your cloud provider.

Example connection string environment variables for the backend:

- `DB_HOST=<release>-gap-canvas-postgres` (service name)
- `DB_PORT=<service.port>`
- `DB_USER` / `DB_PASSWORD` from the Secret

## Upgrades and maintenance

- To upgrade chart values or templates:

```bash
helm upgrade <release> infra/helm/gap-canvas-postgres -f my-values.yaml
```

- To uninstall and remove PVCs (data deletion):

```bash
helm uninstall <release>
# Optionally delete PVCs if you want to remove stored data
kubectl delete pvc -l app.kubernetes.io/instance=<release>
```

## Troubleshooting

- Pod not ready: check readiness/liveness probes in `statefulset.yaml` and view logs.
- Init scripts not applied: init scripts run only when PVC is empty. Confirm the PVC was newly provisioned.
- Permission errors: ensure `securityContext` values match the Postgres image expectations and underlying storage permissions.

## Example quick start (local cluster)

```bash
# 1. Create secret
kubectl create secret generic demo-auth \
	--from-literal=POSTGRES_USER=demo \
	--from-literal=POSTGRES_PASSWORD='demo123' \
	--from-literal=POSTGRES_DB=demodb

# 2. Install chart with demo release name
helm install demo infra/helm/gap-canvas-postgres

# 3. Verify pod and PVC
kubectl get pods -l app.kubernetes.io/instance=demo
kubectl get pvc -l app.kubernetes.io/instance=demo
```

---

If you want, I can add:
- A `values.example.yaml` with recommended production-safe defaults (resource requests, storageClassName, networkPolicy selectors).
- A sample `sql/02_schema.sql` to create initial schema/tables.

