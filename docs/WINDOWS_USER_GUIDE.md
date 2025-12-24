# Vinculum Windows User Guide (Docker)

This guide installs Vinculum on a Windows notebook using Docker Desktop and the prebuilt image.

## Prerequisites

- Windows 10/11 with virtualization enabled
- Docker Desktop (includes WSL2)
- Google Cloud project with Drive API enabled
- Supabase project (Postgres)
- OpenAI API key (optional, required for AI audit)

## 1. Install Docker Desktop

1. Download and install Docker Desktop: https://www.docker.com/products/docker-desktop/
2. During setup, enable WSL2 integration.
3. Reboot if prompted.
4. Open Docker Desktop and wait until it shows "Docker Engine running".

## 2. Create a local install folder

Open PowerShell and run:

```powershell
mkdir C:\vinculum
cd C:\vinculum
```

## 3. Create docker-compose.yml

Create `C:\vinculum\docker-compose.yml` with:

```yaml
version: '3.8'

services:
  vinculum:
    image: rfflpllcnllm/vinculum:0.2.0
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      NEXTAUTH_URL: ${NEXTAUTH_URL}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
      SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY}
    restart: unless-stopped
```

## 4. Create the .env file

Create `C:\vinculum\.env` with:

```env
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_random_secret_here
OPENAI_API_KEY=your_openai_key_here
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 4a. How to get each environment value

### GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET

1. Go to Google Cloud Console: https://console.cloud.google.com/
2. Create or select a project.
3. APIs & Services -> Library -> enable "Google Drive API".
4. APIs & Services -> Credentials -> Create Credentials -> OAuth client ID.
5. Choose "Web application".
6. Add this redirect URI:
   `http://localhost:3000/api/auth/callback/google`
7. Copy the Client ID and Client Secret into `.env`.

### NEXTAUTH_URL

Use the URL you open in your browser. For local Docker:

```
http://localhost:3000
```

If you changed the port in `docker-compose.yml`, update the URL and the Google OAuth redirect URI to match.

### NEXTAUTH_SECRET

Generate a random secret (PowerShell):

```powershell
$bytes = 1..32 | ForEach-Object { Get-Random -Maximum 256 }
[Convert]::ToBase64String([byte[]]$bytes)
```

### OPENAI_API_KEY

Create an API key at https://platform.openai.com/api-keys (optional, only needed for AI audit).

### NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

1. Open your Supabase project.
2. Go to Project Settings -> API.
3. Copy:
   - Project URL -> `NEXT_PUBLIC_SUPABASE_URL`
   - Service Role Key -> `SUPABASE_SERVICE_ROLE_KEY`

Keep the service role key secret.

## 5. Initialize Supabase tables

1. In your Supabase project, open SQL Editor -> New query.
2. Paste the contents of `docs/supabase_builder.sql` from this repository.
3. Run the query to create the required tables and policies.

Note: the script drops and recreates `documents`, `generation_tasks`, and `audit_sessions` (plus the `task_type_enum` type), so only run it on a fresh project or after backing up data.

## 6. Start the app

```powershell
docker compose pull
docker compose up -d
```

Open: http://localhost:3000

## 7. First-time use

- Sign in with Google.
- Vinculum will create `/Vinculum_Data/Books/` in your Drive.
- Upload PDFs to that folder to start.

## Update to a new image

```powershell
docker compose pull
docker compose up -d
```

## Stop or remove

```powershell
docker compose down
```

## Troubleshooting

- Login fails: confirm OAuth redirect URI is `http://localhost:3000/api/auth/callback/google`.
- 500 errors on load: verify Supabase URL and Service Role Key in `.env`, then restart:
  `docker compose down` then `docker compose up -d`.
- Port 3000 already used: change `3000:3000` to `8080:3000` and open http://localhost:8080.
