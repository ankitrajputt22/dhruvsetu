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
