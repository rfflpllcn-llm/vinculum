# Vinculum Cloud Run Deployment Guide

**Service URL:** https://vinculum-614737158522.europe-west1.run.app

## Project Details

| Property | Value |
|----------|-------|
| Project Name | vinculum2 |
| Project ID | vinculum2 |
| Project Number | 614737158522 |
| Region | europe-west1 |

---

## Deployment Steps

### 1. Set the Active Project

Configure the gcloud CLI to use the correct project:

```bash
gcloud config set project vinculum2
```

### 2. Enable Required APIs

Enable the necessary Google Cloud services for container registry, Cloud Run, and Cloud Build:

```bash
gcloud services enable artifactregistry.googleapis.com run.googleapis.com cloudbuild.googleapis.com
```

### 3. Create Artifact Registry Repository

Create a Docker repository in Artifact Registry to store container images:

```bash
gcloud artifacts repositories create vinculum \
  --repository-format=docker \
  --location=europe-west1 \
  --description="Vinculum container images"
```

### 4. Build and Push Container Image

Submit the build to Cloud Build, which builds the Docker image and pushes it to Artifact Registry:

```bash
gcloud builds submit --tag europe-west1-docker.pkg.dev/vinculum2/vinculum/vinculum:latest .
```

> **Note:** Run this command from the directory containing your `Dockerfile`.

### 5. Deploy to Cloud Run

Deploy the container image to Cloud Run with the specified configuration:

```bash
gcloud run deploy vinculum \
  --image europe-west1-docker.pkg.dev/vinculum2/vinculum/vinculum:latest \
  --region europe-west1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --cpu=1 \
  --memory=1Gi \
  --min-instances=0 \
  --max-instances=2 \
  --timeout=900
```

**Configuration breakdown:**

| Flag | Value | Description |
|------|-------|-------------|
| `--platform` | managed | Use fully managed Cloud Run |
| `--allow-unauthenticated` | - | Allow public access without authentication |
| `--port` | 8080 | Container listens on port 8080 |
| `--cpu` | 1 | 1 vCPU allocated |
| `--memory` | 1Gi | 1 GB memory allocated |
| `--min-instances` | 0 | Scale to zero when idle |
| `--max-instances` | 2 | Maximum 2 instances |
| `--timeout` | 900 | Request timeout of 15 minutes |

### 6. Configure Environment Variables

First, retrieve the service URL:

```bash
SERVICE_URL=$(gcloud run services describe vinculum \
  --region=europe-west1 \
  --format='value(status.url)')
```

Then update the service with the required environment variables:

```bash
gcloud run services update vinculum \
  --region=europe-west1 \
  --update-env-vars \
    NEXTAUTH_URL=$SERVICE_URL,\
    NEXTAUTH_SECRET=$NEXTAUTH_SECRET,\
    GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID,\
    GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET,\
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL,\
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY,\
    SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
```

> **Important:** Ensure all environment variables (`NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, etc.) are set in your shell before running this command.

---

## Required Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXTAUTH_URL` | The canonical URL of the deployed service |
| `NEXTAUTH_SECRET` | Secret key for NextAuth.js session encryption |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID for Google authentication |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret for Google authentication |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |

---

## Quick Redeploy

For subsequent deployments after code changes:

```bash
# Build and push new image
gcloud builds submit --tag europe-west1-docker.pkg.dev/vinculum2/vinculum/vinculum:latest .

# Deploy updated image
gcloud run deploy vinculum \
  --image europe-west1-docker.pkg.dev/vinculum2/vinculum/vinculum:latest \
  --region europe-west1
```


## Redeploy with tagging

Or tag both for convenience—latest for the current deployment plus a versioned tag for history:

```bash
VERSION=v1.0.0
gcloud builds submit --tag europe-west1-docker.pkg.dev/vinculum2/vinculum/vinculum:$VERSION .
gcloud artifacts docker tags add \
  europe-west1-docker.pkg.dev/vinculum2/vinculum/vinculum:$VERSION \
  europe-west1-docker.pkg.dev/vinculum2/vinculum/vinculum:latest
```