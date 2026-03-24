# Young Universitario Socios Backend

NestJS backend for membership registration/renewal.

## What it does

- Receives form data from frontend (`POST /api/v1/socios/actions/register-or-renew`)
- Checks Google Sheet for existing member by `ci`
- Renews subscription (`semestral` = +6 months, `anual` = +12 months) when member exists
- Creates a new row when member does not exist
- Sends admin email notification after create/update

## API

- `GET /api/v1/health`
- `POST /api/v1/socios/actions/register-or-renew`
- Swagger: `GET /api/docs`

### Headers

- `X-FORM-KEY: <FORM_KEY>`

## Local run

```bash
cp .env.example .env
npm install
npm run dev
```

## Required env vars

- `FORM_KEY`
- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SHEETS_SHEET_NAME`
- One of:
  - `GOOGLE_SERVICE_ACCOUNT_JSON`
  - or `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `MAIL_FROM`
- `ADMIN_NOTIFICATION_EMAIL`
- `CORS_ORIGIN`

## Google Sheets setup

1. Create a Google Cloud service account.
2. Enable Google Sheets API.
3. Share the spreadsheet with the service account email as Editor.
4. Use sheet name from `GOOGLE_SHEETS_SHEET_NAME` (default: `socios`).

## DigitalOcean App Platform (recommended cheaper option)

1. Push this repo to GitHub.
2. In DigitalOcean, create app from GitHub repo.
3. Configure service from `/backend` folder.
4. Build command: `npm run build`
5. Run command: `npm run start`
6. Set all environment variables from `.env.example`.
7. Set health check path: `/api/v1/health`
8. Deploy and copy URL, for example:
   - `https://young-socios-api.ondigitalocean.app`
9. Update frontend `BACKEND_API_URL` in `/config.js`:
   - `https://young-socios-api.ondigitalocean.app/api/v1/socios/actions/register-or-renew`

### Optional: DigitalOcean app spec

You can use `app-do.yaml` in this folder.

## AWS alternative (more expensive/complex)

Use AWS App Runner with same Dockerfile and env vars:

1. Create App Runner service from source (GitHub) or container.
2. Set port `8080`.
3. Configure env vars.
4. Health check path: `/api/v1/health`.
5. Deploy and update frontend `BACKEND_API_URL`.

