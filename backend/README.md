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
delete other data. All seeded content is clearly marked as demo or prototype
data and must not be treated as real scientific information.
