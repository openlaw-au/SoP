# Kubernetes Deployment Guide

This guide covers deploying the SoP (Statement of Purpose) application to an internal Kubernetes cluster, connecting to a PostgreSQL database on the internal network (e.g., 10/8).

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    Internal Network (10/8)                    │
│                                                              │
│   ┌─────────────────┐         ┌─────────────────────────┐   │
│   │  Kubernetes      │         │  PostgreSQL             │   │
│   │  Cluster         │         │  (10.x.x.x:5432)       │   │
│   │                  │         │                         │   │
│   │  ┌────────────┐ │  TCP    │                         │   │
│   │  │ SoP Pod    │─┼────────>│                         │   │
│   │  │ (Next.js)  │ │  :5432  │                         │   │
│   │  │ Port 3000  │ │         │                         │   │
│   │  └────────────┘ │         └─────────────────────────┘   │
│   │       ▲          │                                       │
│   │       │ NodePort │                                       │
│   │       │ :300XX   │                                       │
│   └───────┼──────────┘                                       │
│           │                                                  │
│      Internal Users                                          │
└──────────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- All database access is server-side only (via Prisma in Next.js API routes) — the browser never touches the DB.
- The app runs as a standalone Next.js server inside a minimal Docker image.
- No external internet access is required at runtime.
- Secrets (`DATABASE_URL`) are managed via Terraform in `config-repo/infra/projects/` and injected as Kubernetes Secrets (matching the ledger-service pattern).

## Prerequisites

- Docker (for building the image)
- Access to GHCR (`ghcr.io/openlaw-au`) or your own container registry
- A Kubernetes cluster on the internal network
- PostgreSQL database accessible from the cluster
- ArgoCD configured to watch the `config-repo`

## Step 1: Build and Push the Docker Image

### Automated (CI — recommended)

The GitHub Actions workflow at `.github/workflows/docker-publish.yml` automatically builds and pushes to GHCR on every push to `main`. It:

1. Runs a multi-stage Docker build (dependencies → build → production image)
2. Auto-increments a semver tag (e.g., `sop/0.1.0`, `sop/0.1.1`, ...)
3. Pushes to `ghcr.io/openlaw-au/sop:<version>` and `ghcr.io/openlaw-au/sop:sha-<commit>`

No configuration is needed — it uses the built-in `GITHUB_TOKEN` for GHCR auth.

### Manual (local build)

```bash
# Build the image
docker build -t ghcr.io/openlaw-au/sop:0.1.0 .

# Log in to GHCR (if not already)
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Push
docker push ghcr.io/openlaw-au/sop:0.1.0
```

### Testing locally with Docker

```bash
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:password@host:5432/sop" \
  -e DIRECT_URL="postgresql://user:password@host:5432/sop" \
  -e ADMIN_EMAILS="admin@openlaw.com.au" \
  ghcr.io/openlaw-au/sop:0.1.0
```

Visit `http://localhost:3000` to verify.

## Step 2: Set Up the Database

The app uses Prisma as its ORM. Before the first deployment, you need to create the database schema on your internal PostgreSQL instance.

### Option A: Prisma DB Push (simplest)

From a machine that can reach the database:

```bash
# Clone the repo and install dependencies
git clone https://github.com/openlaw-au/SoP.git
cd SoP
npm ci

# Set the connection string
export DATABASE_URL="postgresql://user:password@10.x.x.x:5432/sop"

# Push the schema to the database
npx prisma db push
```

This creates all tables, indexes, and enums defined in `prisma/schema.prisma`.

### Option B: Prisma Migrate

If you prefer versioned migrations:

```bash
export DATABASE_URL="postgresql://user:password@10.x.x.x:5432/sop"
npx prisma migrate deploy
```

### Seeding (optional)

To populate with initial data:

```bash
npm run db:seed
```

## Step 3: Add Manifests to config-repo

Example manifests are provided in `docs/config-repo-manifests/`. These follow the existing conventions in `openlaw-au/config-repo` (matching the AIBB and ledger-service patterns).

### Files to add

Copy the following into `config-repo/deployment/prod/sop/`:

| File | Purpose |
|------|---------|
| `sop-deployment.yaml` | Deployment with securityContext, env vars, resource limits |
| `sop-svc.yaml` | NodePort Service exposing port 3000 |

Copy into `config-repo/deployment/support/ingress/`:

| File | Purpose |
|------|---------|
| `sop-networkpolicy.yaml` | NetworkPolicy allowing ingress on port 3000 |

### NodePort allocation

The example uses NodePort `30020`. Check existing allocations before deploying:

```bash
# Current allocations in prod (as of writing):
# 30001 - jasmine
# 30006 - the-vibe
# 30007 - mason
# 30010 - bfsla-archive
# 31115 - matomo
# 31310 - lawstream-public-api
# 32175 - evatt-service
# 32221 - jade-replica
# 32222 - jade-apps-dbs
# 32223 - jade-apps-dbs-secondary
# 32240 - doc-converter
# 32252 - aibb
# 32262 - rosetta
# 32282 - ledger-service
```

Adjust if `30020` is already in use.

### Secrets

Secrets are managed via Terraform in `config-repo/infra/projects/`, following the same pattern as ledger-service. This generates an `ExternalSecret` resource that pulls values from AWS Secrets Manager and creates the `sop-runtime-secrets` Kubernetes Secret referenced by the deployment's `envFrom`.

The following secret keys need to be provisioned:

| Secret Key | AWS Secrets Manager Path | Description |
|------------|--------------------------|-------------|
| `DATABASE_URL` | `sop/prod/database_url` | PostgreSQL connection string (e.g., `postgresql://user:pass@10.x.x.x:5432/sop`) |
| `DIRECT_URL` | `sop/prod/direct_url` | Direct PostgreSQL connection (for Prisma migrations; typically the same value) |

See `config-repo/infra/projects/ledger/service/prod/secrets.tf` for the Terraform pattern to follow.

## Step 4: Deploy via ArgoCD

Once the manifests are committed to `config-repo`, ArgoCD will detect the changes and deploy automatically (or prompt for sync, depending on your ArgoCD configuration).

To verify manually:

```bash
# Check the deployment
kubectl get pods -l run=sop-prod
kubectl logs -l run=sop-prod

# Check the service
kubectl get svc sop-prod

# Test connectivity (from within the cluster)
kubectl run curl --image=curlimages/curl --rm -it -- curl http://sop-prod:3000
```

## Step 5: Update the Image Version

When a new version is published to GHCR (automatically via CI or manually):

1. Update the `image` tag in `config-repo/deployment/prod/sop/sop-deployment.yaml`:
   ```yaml
   image: ghcr.io/openlaw-au/sop:0.2.0  # <- new version
   ```
2. Commit and push to `config-repo`.
3. ArgoCD picks up the change and rolls out the new version.

## Environment Variables Reference

| Variable | Required | Where | Description |
|----------|----------|-------|-------------|
| `DATABASE_URL` | Yes | Secret (via `infra/projects`) | PostgreSQL connection string. Example: `postgresql://user:pass@10.x.x.x:5432/sop` |
| `DIRECT_URL` | Yes | Secret (via `infra/projects`) | PostgreSQL direct connection string (for Prisma migrations). Usually the same as `DATABASE_URL` for internal Postgres. |
| `ADMIN_EMAILS` | Yes | Deployment env | Comma-separated list of admin email addresses. Example: `admin@openlaw.com.au,other@openlaw.com.au` |
| `NODE_ENV` | No | Deployment env | Set to `production` (default in the manifest). |
| `PORT` | No | Deployment env | Server port (default: `3000`). |
| `HOSTNAME` | No | Deployment env | Bind address (default: `0.0.0.0`). |

## Docker Image Details

The Dockerfile uses a multi-stage build:

| Stage | Base | Purpose |
|-------|------|---------|
| `deps` | `node:20-alpine` | Install npm dependencies |
| `builder` | `node:20-alpine` | Generate Prisma client, build Next.js (standalone) |
| `runner` | `node:20-alpine` | Minimal production image (~150-200MB) |

The `output: "standalone"` setting in `next.config.ts` produces a self-contained server that doesn't need `node_modules` at runtime (only the Prisma client binaries are copied over).

The container runs as UID/GID 1000 (`nextjs` user), matching the `securityContext` in the Kubernetes manifests.

## Troubleshooting

### Pod won't start — CrashLoopBackOff

Check logs:
```bash
kubectl logs -l run=sop-prod --previous
```

Common causes:
- **Missing `DATABASE_URL`**: Prisma will fail to initialise. Ensure the Secret exists and is correctly referenced.
- **Database unreachable**: Verify network connectivity from the pod to the DB host. The pod must be able to reach the 10/8 address on port 5432.

### Database connection timeout

```bash
# Test from within the cluster
kubectl run pg-test --image=postgres:16-alpine --rm -it -- \
  psql "postgresql://user:password@10.x.x.x:5432/sop" -c "SELECT 1"
```

If this fails, check:
- Network policies allowing egress from the sop-prod namespace to the DB host
- PostgreSQL `pg_hba.conf` allows connections from the pod's IP range
- Security groups / firewall rules between the K8s nodes and the DB

### Schema not found / table doesn't exist

Run `prisma db push` from a machine with DB access (see Step 2).

### Permission denied errors in container

The container runs as UID 1000. The Kubernetes `securityContext` must match:
```yaml
securityContext:
    fsGroup: 1000
    runAsUser: 1000
    runAsGroup: 1000
    runAsNonRoot: true
```
