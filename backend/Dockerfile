# Production image for the DhruvSetu API (FastAPI).
# Build from the backend folder:  docker build -t dhruvsetu-backend backend
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/app/backend/.cache/huggingface

# The code finds its data folder from its own location, so the layout of the
# repository is kept: /app/backend/app, /app/backend/data.
WORKDIR /app/backend

COPY requirements.txt .
RUN pip install -r requirements.txt

# The small model used by semantic search and the assistant is downloaded
# here, once, so the running container needs no access to Hugging Face.
# It is the model named MODEL_NAME in app/search/semantic.py.
ARG SEARCH_MODEL=minishlab/potion-base-8M
RUN python -c "from model2vec import StaticModel; StaticModel.from_pretrained('${SEARCH_MODEL}')"
ENV HF_HUB_OFFLINE=1

COPY alembic.ini .
COPY migrations ./migrations
COPY app ./app
# The real source documents and datasets that the seed reads. In production a
# volume is mounted here; a new, empty volume starts with these files.
COPY data ./data

RUN useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin dhruvsetu \
    && chown -R dhruvsetu:dhruvsetu /app/backend/data
USER dhruvsetu

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4)"

# Migrations are applied at every start. They are safe to run again.
# One process only: login attempt limits are kept in its memory.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
