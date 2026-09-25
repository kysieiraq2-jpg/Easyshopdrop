# Easy Shop & Drop SA — V19 controlled-test guide

## Start on your own computer
1. Install Docker Desktop and start it.
2. Extract the ZIP into a new folder.
3. Copy `.env.example` to `.env` and replace the local database password in BOTH `POSTGRES_PASSWORD` and `DATABASE_URL` (URL-encode special characters in the URL password).
4. Run `docker compose up --build -d` in the project folder.
5. Visit `http://localhost:3000` and check `http://localhost:3000/api/health`.
6. Run `npm install` then `npm test` for the included unit/static checks. These checks do not prove the entire application works.

## Backups
Run `sh scripts/backup.sh` for a local database dump. Test restoring to a separate disposable database before trusting backups. Do not commit backups or customer data to source control.

## Existing database caution
`db/init.sql` runs automatically ONLY when PostgreSQL initializes an EMPTY volume. Updating a running V18 database requires a separately reviewed migration. Do not delete an existing Docker volume to apply schema changes; doing so can destroy your data.

## Deployment status
This Docker Compose file binds the web app to 127.0.0.1 for local development. It is NOT a public production deployment. A public deployment needs HTTPS, domain/DNS, verified provider webhooks, real courier integration, secrets management, backups, monitoring, customer support, privacy/legal review and end-to-end security testing. Demo users and seed credentials must be removed before launch.
