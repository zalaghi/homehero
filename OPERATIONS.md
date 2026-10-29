# HomeHero operations

The deployment consists of the Next.js web service, PostgreSQL, Redis, MinIO and a dedicated `notification-worker`. The worker is required for queued push notifications and weekly payslip emails. It runs independently of browser sessions and restarts with Docker.

## Weekly payslips

Enable **Weekly payslip email** on each weekly-paid employee's admin profile. The email address must already belong to that employee. The schedule is Sunday at 20:00 in `Europe/Madrid`, including daylight saving time. Enabling the setting starts with the next due Sunday; it never emails earlier weeks. A restart can recover a missed run within 48 hours. The test account should remain disabled unless explicitly needed.

Emails use `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `NOTIFY_FROM_EMAIL` (falls back to `SMTP_USER`) and optional `NOTIFY_FROM_NAME`. Port 465 uses implicit TLS; other ports require STARTTLS. A database record per employee and week prevents scheduled duplicate submissions. `SENT` means the SMTP server accepted the message, not proof that it reached the inbox. An interrupted or uncertain SMTP submission is marked `REVIEW_REQUIRED`; confirm mail-server delivery before retrying, rather than blindly resending.

The PDF uses Spanish number/date formatting and embedded fonts. It shows the stored period totals, daily attendance and transaction details. Paid/final totals are preserved. Historic day and transaction detail comes from current records and may reflect later corrections; the stored totals are authoritative. Downloads do not mark a period paid. This is an internal household pay statement; it does not calculate statutory tax withholding or Social Security contributions. Employer information is optional under **Payslip settings**.

## Push diagnostics

Open the employee's notification screen from the installed PWA and allow notifications. The application repairs subscriptions on startup, focus and network reconnection. On iOS the app must be installed on the Home Screen. Android battery restrictions and iOS Focus settings may affect presentation.

The Home Screen badge shows the unread notification count on platforms that support the Badging API. It updates in the push service worker and after reading notifications in the app. iOS users must also allow Badges in Settings. Explicit admin test pushes now create a diagnostic inbox item and delivery receipt so this path can be tested.

The admin employee profile shows subscription hostnames and recent delivery records. `ACCEPTED` is acceptance by the push service. A device receipt means the service worker's notification display call completed. A click receipt means a notification was opened. Neither a provider acceptance nor a device receipt proves the user saw an alert. Transient failures retry with backoff; expired subscriptions are excluded. New notifications are stored in an outbox transaction, and the worker heartbeat records actual execution. Existing historical inbox items are not pushed again during migration.

Keep `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` and `OTP_PEPPER` stable and private. Do not rotate VAPID keys without a device re-registration plan. The browser now receives the public key at runtime through an authenticated endpoint.

## Installed admin app

Open `/{locale}/admin` in Safari or Chrome and add it to the Home Screen. The admin app has its own installation identity, the name **HomeHero Admin**, and a blue icon. Its localized manifest is available on both the admin login screen and authenticated admin pages. Launching without a valid session opens admin sign-in; it never grants access without authentication.

An admin icon installed before this separation may retain the employee launch URL and artwork. Remove that old admin shortcut and install again from the admin page. Keep any employee installation: its manifest identity, icons, push subscriptions and service worker remain unchanged. Signed-in admins visiting the former `/en/portal` start URL are redirected to their admin panel. Admin worker registration does not subscribe the account to employee push notifications.

The editable admin artwork is `web/public/pwa/admin/icon.svg`; regenerate its PNG sizes from `web/` with `node scripts/generate-admin-icons.mjs`.

Employee payslips open in an in-app PDF preview with a persistent close button. The original period stays open underneath. On iOS, saving uses the native file share sheet after an explicit tap; dismissing it keeps the preview open. The viewer and its versioned worker are served locally; PDFs never go to a third-party viewer. `predev` and `prebuild` copy the worker from the pinned `pdfjs-dist` dependency. The generated worker directory is excluded from Git.

## Safe deployment

1. Back up PostgreSQL, documents and source/configuration. Keep backups and `.env` files private and outside the repository.
2. Run unit tests, lint, type checking and an isolated database migration/runtime smoke test. `sh scripts/update.sh` builds the web, worker and maintenance images and then applies the update.
3. The update script runs Prisma migrations through `docker compose run --rm --no-deps --name homehero-maintenance maintenance`. It does not rerun admin creation or demo seeds. For the first installation only, use `sh scripts/setup.sh`.
4. The five persistent containers are `homehero-web`, `homehero-notification-worker`, `homehero-postgres`, `homehero-redis` and `homehero-minio`. Setup tools belong to the optional `tools` profile and are removed on completion. Preserve the `db/`, `redis/` and `minio/` bind directories. Verify `/api/health`, authenticated pages, a PDF download, the worker heartbeat and scheduled-email configuration.
5. Retain the previous web image and source backup until acceptance. The 0016/0017 migrations are additive, so the previous web image can run against the expanded schema. Migration 0018 adds the DIAGNOSTIC_TEST notification enum value; older clients may not understand diagnostic test records. Evaluate those records before rolling back beyond this change. Stop the new worker during a rollback to avoid background processing under a rolled-back web version. Do not restore a stale database over newer financial activity.

Database and Redis published ports bind to loopback. Public HTTP and S3 routing should be managed at the existing reverse proxy. Containers use bounded logs. Never commit database folders, document storage, `.env`, private keys or production exports to a public repository.

During migration from the old Compose layout, running containers can be renamed to the five names above before running `docker compose up -d --no-recreate --no-build --wait`. This preserves live database connections and in-flight deliveries. A subsequent ordinary update reconciles changed container configuration. Remove only the old exited `homehero-init-1`, `homehero-postgres_init-1` and `homehero-minio_init-1` containers after verifying the new layout. Never use a host-wide prune to clean this application on a shared Docker server.

Keep `homehero-web:latest`, `homehero-notification-worker:latest` and `homehero-maintenance:latest` (or the configured release tag). Record current image IDs and retain a rollback configuration before deleting historical HomeHero tags. The maintenance image is an on-demand migration/admin tool, not a running service. Docker's builder cache may be shared with other applications and must not be pruned without identifying ownership.
