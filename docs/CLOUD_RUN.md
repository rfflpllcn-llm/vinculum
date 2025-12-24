# Deploy to Cloud Run (Docker)

This guide deploys Vinculum to Google Cloud Run so the Python pipeline is available in production.

## Prerequisites

- Google Cloud project
- Billing enabled
- `gcloud` CLI installed and authenticated
- Artifact Registry enabled

## 1) Create Artifact Registry (one-time)

```bash
gcloud config set project YOUR_PROJECT_ID
gcloud services enable artifactregistry.googleapis.com run.googleapis.com cloudbuild.googleapis.com
gcloud artifacts repositories create vinculum \
  --repository-format=docker \
  --location=europe-west1 \
  --description="Vinculum container images"
```

## 2) Build and deploy

```bash
gcloud builds submit \
  --tag europe-west1-docker.pkg.dev/YOUR_PROJECT_ID/vinculum/vinculum:latest \
  .

gcloud run deploy vinculum \
  --image europe-west1-docker.pkg.dev/YOUR_PROJECT_ID/vinculum/vinculum:latest \
  --region europe-west1 \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --set-env-vars \
NEXTAUTH_URL=https://YOUR_SERVICE_URL,\
NEXTAUTH_SECRET=YOUR_SECRET,\
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID,\
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET,\
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL,\
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY,\
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY,\
OPENAI_API_KEY=YOUR_OPENAI_API_KEY \
  --cpu=1 \
  --memory=1Gi \
  --min-instances=0 \
  --max-instances=2 \
  --timeout=900
```

## 3) Update Google OAuth

In Google Cloud Console → OAuth client:

- Authorized JavaScript origin: `https://YOUR_SERVICE_URL`
- Authorized redirect URI: `https://YOUR_SERVICE_URL/api/auth/callback/google`

## Notes

- Set `NEXTAUTH_URL` to the Cloud Run URL.
- Increase `--timeout` if large PDFs need more time.
