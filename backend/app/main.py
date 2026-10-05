from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app import reference_data
from app.admin.routes import router as admin_router
from app.api import router as api_router
from app.auth import config as auth_config
from app.auth.routes import router as auth_router
from app.data_lab.routes import router as data_lab_router
from app.data_lab.sessions import end_all_sessions
from app.database import get_db
from app.outreach.routes import router as outreach_router
from app.researcher.routes import access_router as researcher_access_router
from app.researcher.routes import workspace_router as researcher_workspace_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # On a server the data folder is a volume that can start empty. The
    # reference documents and datasets that are missing from it are put back
    # before the first request. Nothing that is there is replaced.
    reference_data.main()
    yield
    # Analysis containers never outlive the API process.
    end_all_sessions()


app = FastAPI(
    title="DhruvSetu API",
    description="Backend API for the DhruvSetu platform.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(auth_config.allowed_origins()),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(data_lab_router)
app.include_router(outreach_router)
app.include_router(researcher_access_router)
app.include_router(researcher_workspace_router)


@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "DhruvSetu API is running"}


@app.get("/health")
def read_health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/database")
def read_database_health(db: Session = Depends(get_db)) -> dict[str, str]:
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is unavailable",
        ) from error

    return {"status": "ok", "database": "connected"}
