# HomeHero

HomeHero manages household employees, attendance, weekly/monthly pay periods, expenses, debt balances and private documents. It includes separate administrator and employee PWAs, English/Spanish/German/Persian interfaces, durable Web Push delivery, and detailed Spanish weekly pay statements.

## Docker services

Ordinary `docker compose up -d` runs exactly five services:

| Container | Purpose |
| --- | --- |
| `homehero-web` | Admin and employee application |
| `homehero-notification-worker` | Push delivery and scheduled weekly emails |
| `homehero-postgres` | Accounts, attendance and financial records |
| `homehero-redis` | Rate limiting and queue infrastructure |
| `homehero-minio` | Private document storage |

The `maintenance` and `storage-setup` services belong to the optional `tools` profile. Setup/update scripts run them with `--rm` and explicit names; they leave no exited containers. The former `init`, `postgres_init` and `minio_init` services are no longer part of the stack. Fixed container names support one HomeHero installation per Docker host.

## First installation

Requirements: Docker Engine, Docker Compose v2 or later, and a POSIX shell. Persistent `db/`, `redis/` and `minio/` directories live next to the Compose file; they can therefore be deployed outside any specific server path.

1. Copy `.env.example` to `.env` and make the file private (`chmod 600 .env`).
2. Set `POSTGRES_PASSWORD`, `MINIO_ROOT_PASSWORD`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `OTP_PEPPER` and `APP_ENCRYPTION_KEY_BASE64`. Use a different `openssl rand -hex 32` value for each password/pepper and `openssl rand -base64 32` for the encryption key. Hexadecimal database passwords do not need URL escaping.
3. Configure SMTP for employee sign-in and email delivery. The admin account can sign in independently of SMTP.
4. Run `sh scripts/setup.sh`. It builds the images, prepares private storage, applies migrations, creates the initial admin and starts the application. It does not seed employee or financial demo data.
5. Open `http://localhost:3000/en/admin` on the Docker host.

For production, place the app behind HTTPS, set `APP_ORIGIN` to its public URL and set `SESSION_COOKIE_SECURE=true`. Set `S3_PUBLIC_ENDPOINT` to the HTTPS storage endpoint reachable by employee browsers. Database and Redis ports bind only to loopback. The web/storage bind addresses are configurable for a reverse proxy on another machine. Never expose the MinIO console or database directly to the public internet.

To generate Web Push keys after the images are built:

```sh
docker compose run --rm --no-deps --name homehero-vapid maintenance \
  node -e 'console.log(JSON.stringify(require("web-push").generateVAPIDKeys(), null, 2))'
```

Copy the result into the private `.env` file and set `VAPID_SUBJECT` to your contact email (`mailto:...`). Recreate the web and notification-worker services after configuring keys. Keep encryption, OTP and VAPID keys stable when updating an existing installation.

## Updates and routine operation

Back up PostgreSQL, the `minio/` directory and `.env` first. Deploy the new source, then run:

```sh
sh scripts/update.sh
```

This builds the three application/tool images, runs migrations in a temporary container and updates the two application services. It does not recreate admin credentials or seed demo records.

Routine commands:

```sh
docker compose up -d --wait
docker compose ps
docker compose logs --tail=100 web notification-worker
docker compose run --rm --no-deps --name homehero-maintenance maintenance
```

Keep the notification worker running: push retries and Sunday statements must not depend on an open browser. See [OPERATIONS.md](OPERATIONS.md) for delivery diagnostics, weekly scheduling, backup/rollback and PWA installation.

## Employee payslips and PWAs

Employees can open PDF pay statements in an in-app preview with a persistent close button and save/share action. PDFs are rendered locally, including on mobile; documents are not sent to an external viewer. The admin PWA has its own blue icon and starts at `/{locale}/admin`. Install it from that page. Employee installs retain their existing start URL, notifications and unread badge behavior.

Weekly statements can be emailed every Sunday at 20:00 in Europe/Madrid. Enabling the setting starts with the next due week and does not bulk-email past periods. These are internal household pay statements; statutory tax withholding and Social Security contributions are not calculated automatically.

## UniFi Protect

Configure a named **Specific Face** alarm for one camera in Protect, then use the private webhook URL provided by HomeHero. A matching event produces a daily attendance suggestion. An administrator reviews and approves it; a face detection alone is not treated as proof of a full day's work. Details are in [web/README.md](web/README.md).

## Development

The application is in `web/` and uses Next.js 16, React 19, Prisma 7 and PostgreSQL. Use Node.js 22.13 or later. See [web/README.md](web/README.md) for local configuration and commands.

```sh
cd web
npm ci
npm test
npm run lint
npm run typecheck
npm run build
```

Only source code, migrations, assets and environment templates belong in Git. Do not commit `.env`, database folders, employee documents, exports, backups or private keys.
