from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401 - registers ORM models
from app.api import assistant, auth, incidents, reports, scans, settings as settings_api
from app.core.config import settings
from app.db import Base, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", description="Local-first, defensive browser security API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"chrome-extension://.*",
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
api = "/api/v1"
app.include_router(auth.router, prefix=api)
app.include_router(scans.router, prefix=api)
app.include_router(incidents.router, prefix=api)
app.include_router(settings_api.router, prefix=api)
app.include_router(assistant.router, prefix=api)
app.include_router(reports.router, prefix=api)


@app.get(f"{api}/health", tags=["system"])
def health():
    return {"status": "ok", "service": settings.app_name, "mode": "local-first"}
