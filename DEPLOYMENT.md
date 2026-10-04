# Deploying DhruvSetu

This describes how to run DhruvSetu in production with Docker. It does not
choose a hosting provider. Any server with Docker and Docker Compose works.

Three containers run together (`compose.production.yaml`):

| Service | What it is | Reachable from outside |
|---|---|---|
| `frontend` | The website (Next.js), port 3000 | Yes, through your HTTPS proxy |
| `backend` | The API (FastAPI), port 8000 | No. Only the website talks to it. |
| `mysql` | MySQL 8.4 | No. No port is published. |

The browser only ever talks to the website. The website passes `/api/...` on to
the API inside Docker.

## 1. Environment variables

Copy `.env.example` to `.env.production` on the server and fill it in. Git
ignores the copy. Never commit it.

| Variable | Required | Meaning |
|---|---|---|
| `MYSQL_DATABASE` | Yes | Database name, for example `dhruvsetu` |
| `MYSQL_USER` | Yes | Database user of the API |
| `MYSQL_PASSWORD` | Yes | A long random password |
| `MYSQL_ROOT_PASSWORD` | Yes | A different long random password |
| `FRONTEND_ORIGINS` | Yes | The public address of the website, for example `https://dhruvsetu.example.org`. Login and every form are refused from any other address. |
| `AUTH_COOKIE_SECURE` | No | `true` by default in production. The site must then be served over HTTPS. |
| `OPENROUTER_API_KEY` | For the assistant | Without it the assistant answers "not configured". Everything else works. |
| `OPENROUTER_MODEL` | No | Default `openrouter/free` |
| `OPENROUTER_BASE_URL` | No | Default `https://openrouter.ai/api/v1` |
| `SESSION_EXPIRE_MINUTES` | No | Default `480` |
| `FRONTEND_PORT` | No | Port of the website on the server. Default `3000`. |

Set by `compose.production.yaml` itself, not by you: `MYSQL_HOST=mysql`,
`MYSQL_PORT=3306`, `API_URL=http://backend:8000` and `DATA_LAB_ENABLED=false`.

`API_URL` is where the website finds the API. It is written into the website
when it is built, so the website image must be built again if it changes.

## 2. Build and start

```bash
docker compose -f compose.production.yaml --env-file .env.production up -d --build
```

The API applies the database migrations every time it starts
(`alembic upgrade head`). They are safe to run again.

Check that all three are healthy:

```bash
docker compose -f compose.production.yaml --env-file .env.production ps
```

## 3. First-time setup

Run these once, after the first start. Each is safe to run again.

Add the real starter data:

```bash
docker compose -f compose.production.yaml --env-file .env.production exec backend python -m app.seed
```

Build the semantic search index (also needed by the assistant):

```bash
docker compose -f compose.production.yaml --env-file .env.production exec backend python -m app.search.build_index
```

Create the first admin account. The values are given to this one command and
are not stored. Use your own email and a strong password:

```bash
docker compose -f compose.production.yaml --env-file .env.production exec -e SEED_ADMIN_EMAIL=you@example.org -e SEED_ADMIN_PASSWORD='choose-a-strong-password' backend python -m app.auth.seed_accounts
```

Run the index build again after researchers submit new documents or datasets,
so that semantic search and the assistant can use them.

## 4. HTTPS

Put an HTTPS proxy in front of the website port (for example Caddy, Nginx or
your host's load balancer) and point it at `FRONTEND_PORT`. The proxy must pass
the `Host` and `Origin` headers on unchanged. Only the website port needs to be
open in the firewall, besides 80 and 443 for the proxy.

With `AUTH_COOKIE_SECURE=true`, login only works over HTTPS. To try the stack
on your own computer without HTTPS, set `AUTH_COOKIE_SECURE=false` and
`FRONTEND_ORIGINS=http://localhost:3000` for that trial only.

## 5. What must be kept

Two Docker volumes hold everything that cannot be rebuilt. Back both up.

| Volume | Holds |
|---|---|
| `mysql_data` | The database: accounts, records, verification history |
| `backend_data` (`/app/backend/data`) | Documents and datasets that researchers upload, the seed files, and the search index |

Never run `docker compose down -v` in production: `-v` deletes both volumes.

A database backup:

```bash
docker compose -f compose.production.yaml --env-file .env.production exec mysql sh -c 'mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' > backup.sql
```

The backup contains password hashes. Keep it private.

## 6. Updating

```bash
git pull
docker compose -f compose.production.yaml --env-file .env.production up -d --build
```

Run the seed and the index build again when the starter data has changed. The
seed files inside `backend_data` are copied from the image only when the volume
is new. After an update that adds seed files, copy them in before seeding:

```bash
docker compose -f compose.production.yaml --env-file .env.production cp backend/data/. backend:/app/backend/data/
```

## 7. Limits to know

- **Polar Data Lab is off.** It starts a Docker container for each analysis
  session, and the API container cannot start containers. It stays
  `DATA_LAB_ENABLED=false` here. To offer it, run the API directly on a server
  that has Docker (not in a container), build the image with
  `docker compose --profile data-lab build data-lab`, and set
  `DATA_LAB_ENABLED=true`. The page says "not enabled" until then.
- **One API process.** Login attempt limits are kept in the memory of the API
  process. Run one `backend` container, not several.
- **The assistant uses a free tier.** OpenRouter limits free requests per day
  and free models are sometimes busy. The site shows a clear message then.
- **The globe needs the map service.** Visitors' browsers load map tiles from
  `tiles.openfreemap.org`. If it cannot be reached, the Polar Map shows its
  text list.
- **Build from a clean checkout.** The API image copies `backend/data`. On a
  development machine that folder can hold test uploads.

## 8. Without Docker

The same steps by hand, for a platform that runs the processes itself:

```bash
# API (Python 3.14), from backend/, with the variables of section 1 set,
# plus MYSQL_HOST and MYSQL_PORT
pip install -r requirements.txt
alembic upgrade head
python -m app.seed
python -m app.search.build_index
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Website (Node 20 or newer), from frontend/, with API_URL set to the API address
npm ci
npm run build
npm start
```

`backend/data` must be on a disk that survives restarts.
