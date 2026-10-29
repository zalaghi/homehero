# Web app (Next.js + Prisma)

See the repository root `README.md` for Docker/Compose usage and infrastructure notes. This file focuses on the
`web/` app itself.

## Environment

```bash
cp .env.example .env
# Replace APP_ENCRYPTION_KEY_BASE64 with: openssl rand -base64 32
```

Key toggles:
- `OTP_PROVIDER` + `OTP_PEPPER` for dev/SMTP (Twilio Verify/Telegram are planned but not implemented)
- `UNIFI_BASE_URL` / `UNIFI_API_TOKEN` / `UNIFI_TLS_SKIP_VERIFY` are only used by the demo seed script
- `S3_*` + `MINIO_*` for MinIO/local S3 usage

## Local development

```bash
npm ci
npm run dev
```

Useful scripts:
- `npm run prisma:deploy` – apply migrations
- `npm run create:admin -- --email you@example.com --password "long-password"`
- `npm run seed:demo` – attendance/payroll demo dataset
- `npm run lint` / `npm run test` / `npm run build`
- `npm run worker:dev` – BullMQ worker entrypoint (needs Redis)


## UniFi Protect daily attendance review

The integration uses Protect's official Integration API (`X-API-Key`), not UniFi Access. Test Connection lists all connected cameras and whether they support facial recognition. TLS settings are scoped to each Protect request.

Create a named person in Protect → Find Anything → Faces → Manage Identifications. In Alarm Manager create an **ID → Specific Face** trigger for that person, scoped to one facial-recognition camera, with schedule **Always** and a **Custom Webhook** action (POST). Match the exact alarm name in HomeHero and use its private webhook URL. Keep that URL secret. A generic Person/Motion alarm must never be used for this flow.

HomeHero retains one minimal observation per employee per calendar day in Europe/Madrid. It does not retain images or biometric templates. Observations older than 15 minutes, from another camera or alarm, or received while disabled are ignored. Duplicate delivery and multiple sightings cannot create duplicate daily suggestions.

A sighting is evidence for review, not proof of a full day's work. Only an authenticated administrator's explicit approval writes attendance. It does not infer arrival time from a later sighting. Paid periods and conflicting manual decisions are protected. Approvals/dismissals are audited, and reviewed observations cannot be approved twice. The legacy Access polling worker is separate and is not needed for this Protect webhook flow.

For initial setup, test the webhook while HomeHero suggestions are disabled, then enable after verifying the exact person/camera/alarm selection. A real subsequent detection is required for end-to-end recognition acceptance; a test alarm does not establish a person's attendance.
