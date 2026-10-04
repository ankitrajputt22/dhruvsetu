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
Studio or the assistant. Login is only needed for Polar Data Lab, the Research
Workspace and the admin area.

| Role | What it adds |
|---|---|
| `user` | Nothing beyond what a visitor can do. Every new account gets this role. |
| `researcher` | Polar Data Lab, and the Research Workspace for submitting documents and datasets. |
| `admin` | Everything a researcher can do, the admin area, verification status changes, deciding researcher requests, and giving or removing the researcher role. |

A person becomes a researcher when an admin approves their request. See
[Researcher access and submissions](#researcher-access-and-submissions).

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
  forgery. CORS is not relied on for this. The two upload endpoints of the
  Research Workspace take a form with a file instead of JSON; they rely on the
  origin check and the `SameSite` cookie.
- After 5 failed logins for one email address, more attempts for it are
  refused for 5 minutes.
- The frontend passes browser requests for `/api/...` on to this API, so the
  cookie belongs to the site the user is looking at.

### Endpoints and permissions

| Endpoint | Who | Notes |
|---|---|---|
| `POST /api/auth/register` | Anyone | Creates a `user` account and logs it in. A `role` field is rejected. See "Signing up" below. |
| `POST /api/auth/login` | Anyone | One error message for every failure, so it does not show which accounts exist. |
| `POST /api/auth/logout` | Anyone | Ends the session and clears the cookie. |
| `GET /api/auth/me` | Signed in | Returns only the id, email, display name and role. |
| `POST` and `DELETE` under `/api/data-lab/sessions` | `researcher`, `admin` | Also needs `DATA_LAB_ENABLED=true`. |
| `GET` and `POST /api/researcher-access` | Signed in | The account's own researcher access and requests. |
| Everything under `/api/researcher` | `researcher`, `admin` | The Research Workspace. |
| Everything under `/api/admin` | `admin` | Verification, researcher requests and accounts. |

A request without a valid login gets `401`. A request from an account without
the needed role gets `403`. The frontend hides links a role cannot use, but the
API makes the decision on every request.

The checks are FastAPI dependencies in `app/auth/dependencies.py`:
`get_current_user`, `require_user`, `require_role(...)`, `require_researcher`,
`require_admin` and `verify_origin`. New protected routes should use these.

### Signing up

`POST /api/auth/register` takes an email, a password of 10 to 128 characters
and a display name. It can also take an `account_type`:

- `user` (the default) - a general account.
- `researcher` - the person is asking for researcher access. The request must
  come with a `researcher` object and a display name.

```json
{
  "email": "person@example.org",
  "password": "at least ten characters",
  "display_name": "Full Name",
  "account_type": "researcher",
  "researcher": {
    "institution": "Institution or organisation",
    "research_area": "Glaciology",
    "designation": "Optional",
    "reason": "Why researcher access is needed",
    "profile_url": "https://example.org/optional",
    "acknowledged": true
  }
}
```

The account type is what the person asks for. It is not a role. Every account
made here gets the `user` role, whichever type is chosen, and choosing
`researcher` unlocks nothing: no Polar Data Lab and no admin area. `admin` is
not an account type and is rejected, as is any `role` field.

A researcher request is saved in the `researcher_access_requests` table as a
`pending` request (institution, research area, designation, reason, profile
URL and the time). The profile URL must start with `http://` or `https://`,
and `acknowledged` must be `true`. The password confirmation on the form is
checked in the browser and is never sent. What happens to the request next is
described under
[Researcher access and submissions](#researcher-access-and-submissions).

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
- Role changes made by hand on the Users page are not kept in a history. Only
  request decisions and verification changes are.
- Researchers cannot edit or delete what they submitted.
- There is no page to disable or delete an account. The `is_active` column
  exists, and an inactive account cannot log in, but it is set in the database.
- A changing request that has neither an `Origin` nor a `Referer` header is
  accepted, so command-line tools work. Browsers send one of them.
- Opening the site by another address, such as a network IP, needs that
  address in `FRONTEND_ORIGINS`.

Before any public deployment: serve the site over HTTPS, set
`AUTH_COOKIE_SECURE=true`, set `FRONTEND_ORIGINS` to the real address, add a
password reset, and use a shared rate limit.

## Researcher access and submissions

Two things are checked by an admin, in two separate steps:

1. The person: a request for researcher access is approved or rejected.
2. The work: a document or dataset a researcher submits is reviewed and
   verified with the usual verification workflow.

### Asking for researcher access

A person asks for researcher access when signing up (see "Signing up"), or
later from the account at `/account/researcher-access`. Both use the same
questions: institution, research area, designation (optional), reason and
profile URL (optional).

| Endpoint | Who | Notes |
|---|---|---|
| `GET /api/researcher-access` | Signed in | The account's role, where it stands, and its own requests. |
| `POST /api/researcher-access` | Signed in | Sends a new request. |

A request has one of three statuses:

- `pending` - waiting for an admin. It gives no permissions at all.
- `approved` - an admin approved it and the account became a researcher.
- `rejected` - an admin said no. The account stays a normal user.

The request can only carry the answers to the questions. A `role`, `status`,
`approved` or any decision field in the request is rejected with `422`. Only
an admin sets those.

Rules for asking again:

- Only one request can be pending for an account. A second one gets `409`.
- An account that is already a researcher or an admin needs no request (`409`).
- After a rejection the person can send a new request. It is saved as a new
  row, so the earlier request and its decision stay on record.

What the person sees is one of: "No researcher access request", "Pending
Review", "Approved", "Rejected", or "Removed" (an admin took the role away
later). A waiting request is never shown as researcher access. The admin's
note is shown to the applicant; the admin's name is not.

### Deciding a request (admin)

The admin area has a "Researcher requests" page, with Pending shown first.

| Endpoint | Notes |
|---|---|
| `GET /api/admin/researcher-requests?status=pending` | `pending` (default), `approved`, `rejected` or `all`. |
| `GET /api/admin/researcher-requests/{id}` | The full request, the applicant's email and role, and the person's other requests. |
| `POST /api/admin/researcher-requests/{id}/approve` | Optional `{"note": "..."}`. |
| `POST /api/admin/researcher-requests/{id}/reject` | Optional `{"note": "..."}`. |

Approving a request does three things in one database transaction: the request
becomes `approved`, the account's role becomes `researcher`, and every session
of that account is ended. The person signs in again and then has researcher
access. If any part fails, nothing is saved.

Rejecting a request sets it to `rejected` and leaves the account as it is. The
account is not disabled or deleted.

Every decision stores who decided, when, and the note. A request is decided
once: deciding it again returns `409`. An admin cannot decide their own request
(`403`). Other accounts get `403`, and an unknown request gets `404`.

The Users page can still switch an account between User and Researcher by
hand. Giving the role there also marks a pending request of that account as
approved, by that admin, with the note "Researcher role given on the Users
page.", so an account is never a researcher while its request says pending.
Removing the role does not change any request and does not touch what the
person submitted.

### Research Workspace

Researchers and admins have a Research Workspace at `/researcher`. It shows
their own submissions and lets them submit a document or a dataset.

| Endpoint | Notes |
|---|---|
| `GET /api/researcher/submissions` | The documents and datasets this account submitted. |
| `POST /api/researcher/documents` | A form upload: `title`, `document_type`, `file`, and optional `source_url`, `publication_date`, `expedition_id`. |
| `POST /api/researcher/datasets` | A form upload: `title`, `file`, and optional `description`, `source_url`, `expedition_id`, `topic_id`. |

All three need the `researcher` or `admin` role, checked before anything is
read from the request. A normal user gets `403`.

| | Documents | Datasets |
|---|---|---|
| File types | PDF, TXT | CSV, JSON |
| Size limit | 20 MB | 5 MB |
| Checked on upload | Readable text, a real PDF header, not a copy of a stored document | Opens as a table with column names and at least one row |
| What happens | Ingested like any other document: stored and split into chunks | Stored and shown in the Dataset Explorer |

These are the limits the document ingestion and the dataset preview already
had. Other file types are refused, including the larger dataset formats that
an admin can still attach with `python -m app.datasets.attach`.

What the server decides, whatever the upload says:

- The verification status is always `uploaded`. A `verification_status`
  field in the upload is rejected.
- The record is never marked as demo data.
- The submitter is the signed-in account (`submitted_by_user_id` on documents
  and datasets). It cannot be chosen.
- The stored file gets a name made by the server (the file hash or the record
  ID). The uploaded name is only kept as a label, without any folder part, so
  a name such as `../../x.txt` cannot leave the store. Uploaded files are never
  run.

Researchers cannot edit or delete a submission, and cannot mark it Reviewed or
Verified. Editing is left for later work.

### Verifying a submission

A submission enters the same admin verification queue as every other record
and follows the same steps: Uploaded, then Reviewed, then Verified. Nothing
about that workflow is different for submissions.

The admin review page also shows who submitted the record (name and email),
the submitter's role now, and the date. The public page of a document or a
dataset shows "Submitted by" with the display name only. The email and the
account ID are never public.

The trail of a submission is made of stored facts: the submitter on the
record, and each status change with the admin who made it in
`verification_changes`. Removing a person's researcher role, or verifying the
record, does not change who submitted it.

### Search and the assistant

A submitted dataset can be found by keyword search at once. Semantic search
and the assistant use the local index, which is rebuilt by hand as before:

```bash
python -m app.search.build_index
```

Until that is run, a submitted document is not used as evidence by the
assistant. After it, the document's chunks are retrieved like any others, with
their real verification status and demo flag on the source card.

### Tests

`pytest tests/test_researcher_requests.py tests/test_researcher_submissions.py`
covers the request rules, the decisions, session ending, the upload checks and
the verification of a submission.

## Real starter data

The repository starts with real, sourced records about India's polar research.
Add them after migrations are current, then rebuild the search index:

```bash
python -m app.seed
python -m app.search.build_index
```

What the seed adds:

| Records | Count | Main sources |
|---|---|---|
| Institutions | 3 | NCPOR, MoES, IITM |
| Research stations | 3 | NCPOR station pages (Maitri, Bharati, Himadri) |
| Field sites | 2 | NCPOR IndARC page; Dey et al. (2026) |
| Expeditions | 4 | Press Information Bureau releases; NCPOR Arctic expedition reports |
| Reports | 2 | NCPOR Arctic expedition reports (linked, not copied) |
| Scientists | 13 | NCPOR staff profiles; ORCID |
| Publications | 7 | Open-access journal papers, checked against Crossref |
| Datasets | 4 | NCPOR Polar Data Centre; Zenodo (two with a data file) |
| Source documents | 9 | Five CC BY papers and four PIB press releases |
| Research topics | 8 | DhruvSetu's own grouping |
| Media records | 4 | Wikimedia Commons file pages |

Every source, the fields taken from it and its reuse terms are listed in
[`data/REAL_DATA_SOURCES.md`](data/REAL_DATA_SOURCES.md). The records
themselves are in `app/seed.py`.

Rules of the seed:

- **Nothing is invented.** A fact or a link between two records is stored only
  when a listed source states it. A field with no source stays empty.
- **A real source is not a verified record.** Every seeded record starts as
  `uploaded` and is never marked as demo data. An admin marks it Reviewed and
  Verified at `/admin`. Running the seed again keeps the status an admin gave.
- **It is safe to run again.** Records have fixed IDs, so nothing is added
  twice. Sourced values are put back if they were changed. A document already
  stored is skipped, because its file hash is known.
- **It leaves people's data alone.** Accounts, sessions, researcher requests,
  researcher submissions and the verification history are never touched.
- **It removes the old synthetic records.** Earlier versions seeded demo
  expeditions, scientists, publications, datasets and documents. The seed
  deletes exactly those records, found by their fixed IDs, and nothing else.
- **Files are kept only when their licence allows it.** Open-access papers
  (CC BY) and PIB press releases are stored in `data/documents`. NCPOR reports
  are linked, not copied, because the NCPOR website is "All Rights Reserved".
- **Scientists are records, not accounts.** No login account is created in a
  scientist's name, and no portrait is stored.

The `is_demo_data` flag and the Demo Data label still exist, and a record with
the flag is still labelled everywhere. The starter data holds no such record.
The tests create demo records for a test run and remove them after it (see
`tests/demo_data.py` and `tests/conftest.py`).

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

`python -m app.seed` ingests the nine real source documents in
`data/documents` in the same way: five open-access papers as PDF, with page
numbers, and four press releases as text. Each keeps its source type, original
link, publication date and its link to a publication or an expedition.

Rebuild the local semantic index after ingesting documents so their chunks are
available to source retrieval:

```bash
python -m app.search.build_index
```

Ingestion does not use OCR. A PDF needs readable text, and a scan is rejected.

Rules for a document that the assistant may quote:

- The file is stored here only when its licence allows redistribution, and the
  licence is written down in `data/REAL_DATA_SOURCES.md`.
- The file is stored unchanged, with a link to where it was published.
- A document starts as `uploaded`. The source card always shows its real status.

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
- A record that is not Verified carries a notice in the draft, also when it
  comes from a published source. A record flagged as demo data is marked
  `Based on Demo / Prototype Data`. The starter data holds no demo record, so
  that mark no longer appears for it. Neither notice blocks the draft.
- The draft ends with the record's original source link when it has one.
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
- Web map tiles end at 85 degrees latitude. A location beyond that keeps its
  coordinates as text and is marked `mappable: false`. No seeded location is
  that close to a pole.

The frontend draws these locations on a globe with MapLibre GL JS and the
vector tiles of OpenFreeMap. No API key is needed. A location without
coordinates has no marker. The API was not changed for the globe. See "Polar
Map globe" in the frontend README.

### Station and field-site coordinates

`python -m app.seed` adds three station locations and two field sites. Each
coordinate is the value its source publishes, converted to decimal degrees and
rounded to six places. No coordinate is estimated, and the published form is
the limit of its precision.

| Station | Published coordinate | Stored latitude | Stored longitude | Source |
|---|---|---|---|---|
| Bharati | 69°24.41′ S, 76°11.72′ E | -69.406833 | 76.195333 | NCPOR Bharati station page |
| Maitri | 70°45′52″ S, 11°44′03″ E | -70.764444 | 11.734167 | NCPOR Maitri station page |
| Himadri | 78°55′ N, 11°56′ E | 78.916667 | 11.933333 | NCPOR Arctic data portal (Himadri) |

| Kongsfjorden (IndARC mooring site) | 78°56′ N, 12° E | 78.933333 | 12.000000 | NCPOR IndARC page |
| Djupranen Ice Rise | 70.18° S, 9.18° E | -70.180000 | 9.180000 | Dey et al. (2026), The Cryosphere |

Some NCPOR data pages list slightly different coordinates for Maitri. This
project uses the NCPOR Maitri station page values only, so that values from
different pages are never mixed.

The source is written in each location's description, and each station record
stores the link to its NCPOR page (`source_url`), which the map shows as
"Open Original Source". Running the seed again puts these coordinates back to
the published values. It does not change a station's verification status,
which starts as `uploaded`.

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

### Real datasets and their provenance

The seed adds four dataset records. Two have a data file in `data/datasets`:

| Dataset | File | Size | Source |
|---|---|---|---|
| Maud Rise Polynya index and ice core proxy records, 1774-2016 | `maud-rise-polynya-ice-core-dey-2026.csv` | 243 rows, 7 columns | NCPOR Polar Data Centre, data of Dey et al. (2026) |
| Particulate organic matter composition in Kongsfjorden | `kongsfjorden-particulate-organic-matter-jagtap-2026.csv` | 12 rows, 92 columns | Zenodo, CC BY 4.0 |

The other two are metadata only. They describe data held by NCPOR and link to
it, and say that DhruvSetu holds no copy.

Each file was converted from the source Excel workbook to CSV so that it can be
previewed and opened in the Data Lab. Every row and column is kept and no value
was changed. `data/REAL_DATA_SOURCES.md` describes the conversion, and the
description of each dataset names its authors and source.

The preview shows a value as the file has it: a year is `2016`, and `0.14452`
keeps every digit. Only calculated values, such as a mean, are rounded.

## Sources and verification

Every document keeps its source details: title, source type, file type, page
numbers, original source URL, publication date, and links to a related
expedition, publication, or report. The documents API, the expedition detail
API, and assistant sources all return these details from MySQL. Missing
details are returned as empty values and are never filled in.

Verification status is one of:

- `uploaded` - added to the repository but not yet reviewed (the default)
- `reviewed` - checked by a person
- `verified` - source details and content confirmed by an admin

The status says how far DhruvSetu has checked a record. It does not say where
the record comes from. A paper from a journal or a dataset from a data centre
is real from the start, and still begins as `uploaded` here.

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

The assistant ("Ask DhruvSetu") answers questions using source chunks from the
repository. A cloud model writes the answer. The model is reached through
[OpenRouter](https://openrouter.ai), and only the backend talks to it.

```text
question
  -> retrieve_source_chunks()   up to 4 chunks from the local semantic index
  -> keep chunks that score at least 0.35
  -> OpenRouter                 one request, only if a chunk was kept
  -> answer and source cards
```

Retrieval, the semantic index and document ingestion are the same as before.
Source cards are built from the database, never from the model's text.

### Settings

Add these to the `.env` file in the project root. Never commit the real key.

```bash
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/free
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

| Setting | Default | Meaning |
|---|---|---|
| `OPENROUTER_API_KEY` | none | Your OpenRouter key. Used only by the backend and never sent to the browser. |
| `OPENROUTER_MODEL` | `openrouter/free` | The free router. It picks a free model that is available at that moment, so two questions can be answered by different models. |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | OpenRouter's OpenAI-compatible API. |
| `ASSISTANT_MIN_SCORE` | `0.35` | Chunks that score lower are treated as unrelated. |
| `ASSISTANT_TIMEOUT_SECONDS` | `60` | How long to wait for the model (5 to 120). |

The code uses the official `openai` Python package and its chat completions
call, pointed at OpenRouter. There is no paid fallback: only the model named
in `OPENROUTER_MODEL` is asked. A model that is not free costs money, so change
that setting on purpose only.

### What is sent to OpenRouter

Only three things: the assistant's instructions, the question, and the kept
chunks (title, page, type, verification status and text). Keys, passwords,
login cookies, session tokens and other database records are never sent.

The question and the source text are processed by OpenRouter and by the model
provider it picks. Do not use the assistant with text that must stay private.

### How it behaves

- Weak matches are not sent. The answer is then `The available DhruvSetu
  sources do not provide enough evidence to answer this confidently.` and no
  OpenRouter request is used.
- One question makes at most one request. There are no retries, no background
  calls and no automatic second attempts.
- The instructions tell the model to use only the supplied sources, to invent
  nothing, to say when the sources are not enough, and to treat text inside a
  source as content, never as instructions.
- Only the final answer is used. Reasoning fields in the reply are not read,
  and `<think>` blocks and Markdown bold or heading marks are removed.
- The model that answered is written to the `app.assistant.service` log at
  INFO level. It is not shown to users and is not part of the API response.

### When the model cannot answer

| Situation | Status | Message |
|---|---|---|
| Key missing or rejected | `503` | `AI assistant is not configured.` |
| Rate limit reached | `503` | `The AI assistant is busy right now. Please try again in a few minutes.` |
| No answer before the timeout | `504` | `The AI assistant took too long to answer. Please try again.` |
| Provider error, no free model available, or an empty answer | `502` | `The AI assistant could not answer right now. Please try again.` |
| Semantic index not built | `503` | `Source search is not ready right now. Please try again later.` |

The provider's own error text, the key and stack traces are never returned.
The rest of DhruvSetu keeps working in every one of these cases.

### Test the assistant

The automated tests use a fake provider and never call OpenRouter:

```bash
pytest tests/test_assistant.py
```

To try the real model, start the API with a key in `.env`, make sure the seed
and the index build have been run, and ask something the source documents
cover:

```bash
curl -X POST http://127.0.0.1:8000/api/assistant/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What does the repository say about Antarctic climate research?"}'
```

The answer should name its sources by number, and each source card should show
a real title, its page, its original link and its verification status.

Then ask `What is the capital of France?`. It should return the "not enough
evidence" sentence at once, without using an OpenRouter request. The frontend
page is at `/assistant`.

### Limits of the free tier

- OpenRouter limits free models. At the time of writing (October 2026) its
  documentation lists 20 requests per minute and 50 per day, or 1000 per day
  for an account that has bought at least 10 credits. Check the OpenRouter
  documentation for the current numbers.
- Free models can be slow, busy or unavailable. The assistant then shows one of
  the messages above.
- Answer quality changes with the model the free router picks. Answers are
  kept to the sources by instruction, which is not a guarantee, so readers
  should check the source cards.
