# DhruvSetu backend

The backend uses FastAPI and runs locally.

## Set up

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

## Start the API

```bash
uvicorn app.main:app --reload
```

The API runs at [http://127.0.0.1:8000](http://127.0.0.1:8000).
API documentation is available at
[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

## Run the test

The database tests use the local MySQL container. Start it from the project
root before running the tests.

```bash
pytest
```

## Database

Start MySQL from the project root:

```bash
docker compose up -d
```

Run migrations from this backend folder:

```bash
alembic upgrade head
```

Check the live database connection at
[http://127.0.0.1:8000/health/database](http://127.0.0.1:8000/health/database).

## Accounts and roles

The repository is open. Nobody has to log in to read expeditions, scientists,
publications, datasets, documents, the Polar Map, search, citations, Outreach
Studio or the assistant. Login is only needed for Polar Data Lab and the admin
area.

| Role | What it adds |
|---|---|
| `user` | Nothing beyond what a visitor can do. Every new account gets this role. |
| `researcher` | Polar Data Lab. |
| `admin` | Polar Data Lab, the admin area, verification status changes, and giving or removing the researcher role. |

Student, Teacher, Journalist and Public are audience settings in Outreach
Studio. They are not login roles and give no permissions.

### How login works

- Accounts are local: an email address and a password of 10 to 128 characters.
  Passwords are hashed with Argon2id (`argon2-cffi`). They are never stored,
  logged or returned by the API.
- Login creates a random session token. The browser gets it in the
  `dhruvsetu_session` cookie, which is HTTP-only (page scripts cannot read it)
  and `SameSite=Lax`. The database keeps only a SHA-256 hash of the token and
  its expiry time, in `user_sessions`.
- Logout deletes the session row, so the token stops working at once. A
  session also ends after `SESSION_EXPIRE_MINUTES`, and when the account's
  role or password is changed.
- Nothing is kept in `localStorage`, and no signing secret is needed.
- A request that changes something (`POST`, `PATCH`, `DELETE`) must come from
  an origin listed in `FRONTEND_ORIGINS`. This check, the `SameSite` cookie and
  JSON-only request bodies together protect against cross-site request
  forgery. CORS is not relied on for this.
- After 5 failed logins for one email address, more attempts for it are
  refused for 5 minutes.
- The frontend passes browser requests for `/api/...` on to this API, so the
  cookie belongs to the site the user is looking at.

### Endpoints and permissions

| Endpoint | Who | Notes |
|---|---|---|
| `POST /api/auth/register` | Anyone | Creates a `user` account and logs it in. A `role` field is rejected. |
| `POST /api/auth/login` | Anyone | One error message for every failure, so it does not show which accounts exist. |
| `POST /api/auth/logout` | Anyone | Ends the session and clears the cookie. |
| `GET /api/auth/me` | Signed in | Returns only the id, email, display name and role. |
| `POST` and `DELETE` under `/api/data-lab/sessions` | `researcher`, `admin` | Also needs `DATA_LAB_ENABLED=true`. |
| Everything under `/api/admin` | `admin` | Verification and accounts. |

A request without a valid login gets `401`. A request from an account without
the needed role gets `403`. The frontend hides links a role cannot use, but the
API makes the decision on every request.

The checks are FastAPI dependencies in `app/auth/dependencies.py`:
`get_current_user`, `require_user`, `require_role(...)`, `require_researcher`,
`require_admin` and `verify_origin`. New protected routes should use these.

### Create local accounts

Registration only creates `user` accounts. Admin and researcher accounts are
made with a command. Put the values in the root `.env` file, which Git ignores:

```bash
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=
SEED_RESEARCHER_EMAIL=
SEED_RESEARCHER_PASSWORD=
SEED_USER_EMAIL=
SEED_USER_PASSWORD=
```

Then run this from the backend folder:

```bash
python -m app.auth.seed_accounts
```

The command creates each account, or updates the password and role of one that
already exists. It never prints a password. An account whose email or password
is not set is skipped. Choose your own passwords and do not commit them.

This command is the only way to create or change an admin. The admin page
cannot change an admin account, so the last admin cannot be removed there by
mistake. An admin can give or remove the researcher role at `/admin/users`
(`PATCH /api/admin/users/{id}/role` with `user` or `researcher`).

### Settings

| Setting | Default | Meaning |
|---|---|---|
| `SESSION_EXPIRE_MINUTES` | `480` | How long a login lasts. |
| `AUTH_COOKIE_SECURE` | `false` | Set to `true` when the site is served over HTTPS, so the cookie is only sent over HTTPS. |
| `FRONTEND_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated addresses of the frontend that may send changing requests. |
| `SEED_*_EMAIL`, `SEED_*_PASSWORD` | empty | Used only by the account command above. |

### Limits of this prototype

- There is no password reset, no email verification and no email is sent. A
  forgotten password is replaced with the account command.
- There is no login through another service (OAuth or single sign-on).
- The failed-login limit is kept in the memory of one API process. It is reset
  when the API restarts and is not shared between several workers.
- There is no page to disable or delete an account. The `is_active` column
  exists, and an inactive account cannot log in, but it is set in the database.
- A changing request that has neither an `Origin` nor a `Referer` header is
  accepted, so command-line tools work. Browsers send one of them.
- Opening the site by another address, such as a network IP, needs that
  address in `FRONTEND_ORIGINS`.

Before any public deployment: serve the site over HTTPS, set
`AUTH_COOKIE_SECURE=true`, set `FRONTEND_ORIGINS` to the real address, add a
password reset, and use a shared rate limit.

## Demo data

Add the small prototype dataset after migrations are current:

```bash
python -m app.seed
```

The seed is safe to run again. It keeps the same demo records and does not
delete other data. Seeded demo content is clearly marked as demo or prototype
data and must not be treated as real scientific information.

The seed also adds three real station locations (Bharati, Maitri and Himadri)
with their published NCPOR coordinates. They are not demo data and are not
linked to the demo expeditions. See "Polar Map" below for the sources.

## Semantic search

Semantic search finds records with related meaning. It uses a small local model
and does not need an API key. Build or rebuild the local index from MySQL:

```bash
python -m app.search.build_index
```

Then start the API normally with `uvicorn app.main:app --reload` and start the
frontend with `npm run dev` from the `frontend` folder. On the search page,
choose **Keyword** for MySQL text search or **Semantic** for related meanings.
Generated model-cache and index files stay outside Git.

## Source documents

The ingestion command supports UTF-8 TXT files and text-based PDFs. It keeps
the original file on disk, stores source metadata and chunks in MySQL, and uses
a SHA-256 file hash to prevent duplicates.

```bash
python -m app.ingestion.ingest /path/to/source.txt --title "Source title"
```

Optional flags can connect the source to an existing record:

```bash
python -m app.ingestion.ingest /path/to/source.pdf \
  --title "Source title" \
  --source-type "research_report" \
  --report-id "existing-report-id"
```

Add the three small prototype documents used by the project:

```bash
python -m app.ingestion.seed_demo
```

Rebuild the local semantic index after ingesting documents so their chunks are
available to source retrieval:

```bash
python -m app.search.build_index
```

The prototype does not use OCR, accept public uploads, call an LLM, or generate
answers. Source retrieval returns original text chunks for later RAG work.

## Outreach Studio

The Outreach Studio turns one repository record into a short draft for a
chosen audience and format. It uses fixed templates. No AI model or external
service is called, and no API key is needed.

- `GET /api/outreach/sources?type=expedition&q=...` lists records to choose
  from. Types: `expedition`, `publication`, `dataset`, `document`, `report`.
- `GET /api/outreach/sources/{type}/{id}` returns the record details that a
  draft may use, with any notices.
- `POST /api/outreach/generate` returns the draft, the source details and the
  notices. Audiences: `student`, `teacher`, `journalist`, `public`. Formats:
  `short_explanation`, `social_post`, `classroom_note`, `news_brief`. Any other
  value is rejected.

How drafts are built:

- `app/outreach/sources.py` reads one record and its existing relationships
  into a plain list of facts. A fact is added only when the repository has a
  value for it.
- `app/outreach/templates.py` has one function per format. The audience
  changes the wording and which sections appear. The same request always
  gives the same draft.
- The repository description is quoted as stored. Nothing else is added apart
  from the fixed template wording and plain meanings of the record types.
- Document drafts use catalogue details only. The stored document text is not
  read or shown.
- A demo record is marked `Based on Demo / Prototype Data` in the draft, and a
  record that is not Verified carries a notice. Neither blocks the draft.
- "Why it matters" appears in a news brief only when the record is not demo
  data and has research topics with stored descriptions.

Drafts are not saved. A later generator, for example one that uses a language
model, can be added beside `TemplateGenerator` in `templates.py`.

## Polar Data Lab

The Data Lab runs Python on one dataset in a temporary session. Each session
is a short-lived Docker container with a real Jupyter (IPython) kernel inside.
User code never runs inside the FastAPI process or directly on the host.

### Requirements and setup

Docker must be running. Build the analysis image once from the project root:

```bash
docker compose build data-lab
```

This builds `dhruvsetu-data-lab:1` (Python 3.12 with pandas, numpy, matplotlib
and ipykernel). `docker compose up` does not start it and the MySQL service is
not affected. Then enable the feature in the root `.env` and restart the API:

```bash
DATA_LAB_ENABLED=true
```

Without `DATA_LAB_ENABLED=true` every Data Lab endpoint except the status
check returns `403`, and the frontend shows that the Data Lab is not available.

Starting, using and ending a session also needs a login with the `researcher`
or `admin` role (see [Accounts and roles](#accounts-and-roles)). Without a
login these calls return `401`, and with the `user` role they return `403`. A
session can only be used and ended by the account that started it.

### How a session works

- `GET /api/data-lab/status` says whether the Data Lab is enabled.
- `POST /api/data-lab/sessions` with `{"dataset_id": "..."}` starts a session.
  The dataset must have an attached CSV or JSON file of at most 50 MB.
- `POST /api/data-lab/sessions/{id}/execute` with `{"code": "..."}` runs one
  cell. Variables stay available to later cells in the same session.
- `DELETE /api/data-lab/sessions/{id}` ends the session and removes its
  container. Reset in the page is an end followed by a new session.

The backend creates the session id. The dataset file is mounted read-only at
`/data/dataset.csv` (or `.json`); the host path is never sent to the browser.
Output comes back as text, tables, PNG images or errors. HTML output is never
passed on. Output is limited to 20,000 characters of text, 50 table rows, 30
table columns, 4 images of 1 MB each and 30 outputs per cell, and the reply
says when something was left out.

### Limits and cleanup

| Limit | Value | Setting |
|---|---|---|
| Time per cell | 30 seconds | `DATA_LAB_CELL_TIMEOUT_SECONDS` |
| Idle time before a session ends | 30 minutes | `DATA_LAB_IDLE_TIMEOUT_MINUTES` |
| Sessions at the same time | 3 | `DATA_LAB_MAX_SESSIONS` |
| Memory per session | 512 MB, no swap | `app/data_lab/config.py` |
| CPU per session | 1 CPU | `app/data_lab/config.py` |
| Processes per session | 128 | `app/data_lab/config.py` |
| Workspace size | 128 MB, in memory | `app/data_lab/config.py` |

A cell that runs too long is interrupted and the session keeps its variables.
If the kernel cannot be interrupted or runs out of memory, it is restarted and
the variables are cleared. Sessions end when the user resets or leaves the
page, when they are idle too long, and when the API process stops or reloads
(including `uvicorn --reload`). To see or remove any that are left:

```bash
docker ps --filter label=dhruvsetu.data-lab=session
docker rm -f $(docker ps -q --filter label=dhruvsetu.data-lab=session)
```

### Isolation

Each session container runs with no network, a read-only root filesystem, a
non-root user, all Linux capabilities dropped and no privilege escalation. The
only host path it can see is the one dataset file, read-only. The repository,
`.env`, MySQL files and the Docker socket are never mounted, and no environment
variables from the host are passed in.

### Security limits of this prototype

- Any researcher or admin account can run Python in a container while
  `DATA_LAB_ENABLED` is true. Give those roles only to people you trust.
- Isolation relies on Docker. A container is not as strong a boundary as a
  virtual machine or a sandbox such as gVisor, so a container-escape bug in
  Docker or the kernel would reach the host.
- The API process starts containers with the Docker command line, so it has
  the same Docker access as the user who runs it.
- Sessions live in the memory of one API process. Several API workers, or
  several servers, are not supported.
- The limit of 3 sessions is for the whole server. There is no limit per
  account.

Before any public deployment, add per-user limits and stronger isolation.

### Tests

`pytest` covers the API with a fake runtime, and also starts real containers
when Docker is running and the image is built. Those tests are skipped
otherwise.

## Polar Map

`GET /api/map` returns every repository location for the map page: name,
region, coordinates, research stations, related expeditions, and the research
topics, datasets and documents connected through those expeditions.

- Coordinates come only from the `latitude` and `longitude` columns of the
  `locations` table. Nothing is guessed or looked up.
- A location without usable coordinates stays in the text list but has no
  marker. Coordinates outside the valid range are treated as missing.
- `location_type` is `station` when the location has a research station,
  `expedition_location` when it is linked to an expedition, otherwise `other`.
- `polar_region` is set from latitude only: south of 60 degrees south is
  Antarctic, north of 66.5 degrees north is Arctic. Names are not used.
- A standard web map cannot draw points beyond 85 degrees latitude. Those
  locations keep their coordinates as text and are marked `mappable: false`.

The frontend map uses Leaflet with OpenStreetMap standard tiles. No API key is
needed. The demo locations have no coordinates and have no markers.

### Station coordinates

`python -m app.seed` adds three real station locations. Each coordinate is the
value published by the National Centre for Polar and Ocean Research (NCPOR),
converted to decimal degrees and rounded to six places. No coordinate is
estimated, and the published form is the limit of its precision.

| Station | Published coordinate | Stored latitude | Stored longitude | Source |
|---|---|---|---|---|
| Bharati | 69°24.41′ S, 76°11.72′ E | -69.406833 | 76.195333 | NCPOR Bharati station page |
| Maitri | 70°45′52″ S, 11°44′03″ E | -70.764444 | 11.734167 | NCPOR Maitri station page |
| Himadri | 78°55′ N, 11°56′ E | 78.916667 | 11.933333 | NCPOR Arctic data portal (Himadri) |

Some NCPOR data pages list slightly different coordinates for Maitri. This
project uses the NCPOR Maitri station page values only, so that values from
different pages are never mixed.

The source is also written in each location's description. The locations table
has no source URL column, so no URL is stored. Running the seed again puts
these coordinates back to the published values. It does not change a station's
verification status, which starts as `uploaded`.

## Datasets

Dataset records can be metadata only, or they can have one data file in
`backend/data/datasets`. Apply the migration first (`alembic upgrade head`),
then attach a file to an existing dataset record:

```bash
python -m app.datasets.attach "existing-dataset-id" /path/to/data.csv
```

CSV and JSON files (a list of records) can be previewed. TXT, XLSX, NC, H5 and
ZIP files can be stored and downloaded but are not previewed. Other file types
are rejected.

- `GET /api/datasets` lists datasets. Optional filters: `q`, `topic`,
  `expedition`, `file_type`, `verification_status`.
- `GET /api/datasets/filters` returns the filter values that datasets use.
- `GET /api/datasets/{id}` returns the metadata, related expedition, research
  topics, and file details.
- `GET /api/datasets/{id}/preview` returns the first 50 rows, up to 30 columns,
  the detected column types, and simple statistics for number columns.
- `GET /api/datasets/{id}/download` sends the attached file.

Files larger than 5 MB are not previewed, and statistics use at most the first
5000 rows. The limits are at the top of `app/datasets/preview.py`. Column types
and statistics are calculated from the file and are not official metadata.

The seed adds one small file, `demo-prototype-preview-sample.csv`, to show the
preview. Its values are placeholders marked `Demo / Prototype Data`, not
measurements. Run `python -m app.seed` and rebuild the semantic index to add it.

## Sources and verification

Every document keeps its source details: title, source type, file type, page
numbers, original source URL, publication date, and links to a related
expedition, publication, or report. The documents API, the expedition detail
API, and assistant sources all return these details from MySQL. Missing
details are returned as empty values and are never filled in.

Verification status is one of:

- `uploaded` - added to the repository but not yet reviewed (the default)
- `reviewed` - checked by a person
- `verified` - source details and content confirmed for the prototype

Set the status when ingesting a document. Ingestion never marks a document as
reviewed or verified on its own.

```bash
python -m app.ingestion.ingest /path/to/source.pdf \
  --title "Source title" \
  --source-url "https://example.org/source.pdf" \
  --verification-status reviewed
```

The source URL must start with `http://` or `https://`. Demo data is a separate
flag (`--demo`) and does not replace the verification status.

### Admin review

Admins change the status at `/admin` in the frontend. The page uses these
endpoints, which all need an admin login:

- `GET /api/admin/summary` - how many records of each type have each status
- `GET /api/admin/records?status=uploaded&type=dataset` - the verification
  queue (`status` defaults to `uploaded`, `type` is optional)
- `GET /api/admin/records/{type}/{id}` - what the reviewer sees before deciding
- `PATCH /api/admin/records/{type}/{id}/verification` with
  `{"status": "reviewed"}` - the change

The record types are `expedition`, `publication`, `report`, `dataset`,
`document`, `station` and `media`. An unknown type or status returns `422` and
an unknown ID returns `404`.

A record moves forward one step at a time: Uploaded, then Reviewed, then
Verified. It can be moved back to an earlier status if a change was a mistake.
Going from Uploaded straight to Verified returns `409`. Nothing is verified
automatically, and Demo Data stays a separate label. The stations Bharati,
Maitri and Himadri stay Uploaded until an admin reviews them.

Every change is saved in `verification_changes`: the record, the old and new
status, the admin who made it and the time. The review page shows the latest
20 changes for the record. The public pages read the same status, so the badge
on a public page changes as soon as the admin changes it.

## AI assistant

The assistant answers questions using source chunks from the repository. It
calls `retrieve_source_chunks()`, sends the best matching chunks to Claude, and
returns the answer with its sources.

Add these values to the `.env` file in the project root. Never commit the real
key.

```bash
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
```

`ANTHROPIC_MODEL` is optional. When it is empty the assistant uses
`claude-opus-5-5`. Without an API key the endpoint returns
`AI assistant is not configured.` and the rest of DhruvSetu keeps working.

```bash
curl -X POST http://127.0.0.1:8000/api/assistant/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What does the sea ice observation plan record?"}'
```

Weak matches are not sent to Claude. Tune the cut-off with
`ASSISTANT_MIN_SCORE` (default `0.35`). The frontend page is at `/assistant`.
