# Operations runbook: security, backups and recovery

For deployment and environment setup see [`DEPLOYMENT.md`](DEPLOYMENT.md).

## Backups

**What runs:** `scripts/backup-db.mjs`, nightly at 03:00 PKT. It dumps the database, checks the file is readable, uploads it to
the private R2 bucket `coco-backups`, then deletes copies older than 30 days. It removes old copies only after a successful
upload, and exits non-zero on any failure.

Setup on the server:

1. In Cloudflare, create the private bucket `coco-backups` (**no** public domain: dumps contain customer data) and an API token
   limited to that bucket. Keep it separate from the media token.
2. Build the backup image: `docker build --target backup -t coco-backup .`
3. Create `/etc/coco/backup.env` (readable by root only):

   ```
   DATABASE_URL=postgres://...
   BACKUP_S3_BUCKET=coco-backups
   S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   BACKUP_S3_ACCESS_KEY_ID=...
   BACKUP_S3_SECRET_ACCESS_KEY=...
   ```

4. Schedule it (server clock in UTC), and point a failure alert at it, e.g. a Coolify scheduled task or a cron line:

   ```
   0 22 * * * docker run --rm --network <db-network> --env-file /etc/coco/backup.env coco-backup || <send alert>
   ```

**Media:** turn on object versioning or lifecycle rules on the R2 media bucket.

## Restore drill: before launch, then quarterly

```bash
docker run --rm --network <db-network> --env-file /etc/coco/backup.env coco-backup node scripts/restore-drill.mjs
```

This downloads the latest backup, restores it into a new temporary database, checks tables, order totals and migrations, and
drops the temporary database. The live database is not changed. Record the result in [`RESTORE-LOG.md`](RESTORE-LOG.md).

## Recovering production

Only with the owner's agreement: this replaces live data with the backup's.

1. Put the site in maintenance (stop the app in Coolify) so no new orders are lost part-way.
2. Keep a copy of the current state: `node scripts/backup-db.mjs --file before-restore.dump`
3. Download the chosen backup from `coco-backups/db/`.
4. Create a new database and restore: `createdb coco_new`, then `pg_restore --no-owner --no-privileges -d <coco_new url> backup.dump`
5. Point `DATABASE_URL` at `coco_new` and start the app. Pending migrations apply on boot.
6. Check: admin login, latest order, a product with variants, place a test order. Keep the old database until confirmed.

Orders placed after the backup was taken are not in it. Compare with confirmation emails and contact those customers.

## Two-factor authentication

- Each admin user turns it on at **Admin > Security (2FA)**. The dashboard reminds owners and managers until they do.
- **Lost phone:** log in with a recovery code, or ask the owner to press **Reset 2FA** on that user's screen. Confirm the person's
  identity first (phone call, not email).
- **Owner lost phone and recovery codes:** on the server, with database access, after confirming identity:

  ```sql
  UPDATE users SET two_factor_enabled = false, two_factor_secret = NULL, two_factor_recovery_codes = NULL WHERE email = '...';
  ```

- Password reset never signs anyone in; the code is still needed at the next login.
- Authenticator secrets are encrypted with a key from `PAYLOAD_SECRET`. **Changing that secret breaks every user's 2FA** (and all
  sessions), so reset 2FA for everyone afterwards.

## Rotating secrets

| Secret | Effect of changing it | Steps |
|---|---|---|
| `PAYLOAD_SECRET` | Logs everyone out; breaks 2FA; invalidates sign-in codes and customer sessions | Change, restart, reset 2FA for each user |
| Database password | App down until updated | Change in Postgres, then in the hosting environment and `backup.env` |
| R2 tokens | Media or backups fail until updated | Create new token, update environment, delete old token |
| JazzCash / Easypaisa | Payments fail until updated | Update with the gateway, then the environment, and test one payment |
| SMTP password | Emails and customer sign-in fail until updated | Update and send a test order email |

## Incident checklist

1. **Contain:** suspected admin compromise? Reset that user's password and 2FA; check **Settings > Activity Logs**.
2. **Preserve:** take a backup before changing data, and keep server logs.
3. **Rotate:** any secret that may have been exposed (table above).
4. **Check:** recent orders, payment statuses marked Paid by hand, users and roles, redirects, banners.
5. **Tell:** the owner; and customers, if their data was exposed, following legal advice.
6. **Record:** what happened, when, and what changed.

## Dependency updates

- Dependabot opens monthly pull requests; security patches should be applied within 72 hours. CI fails on a **high** or
  **critical** production advisory.
- Known accepted advisories: moderate `esbuild` (through `drizzle-kit`, used to generate schema changes, and only a risk on a
  developer's machine running its dev server) and low `deepmerge` (inside Payload). Neither has a fix yet.
- Payload and Next must move together: check the Next range in `@payloadcms/next`'s peer dependencies.
