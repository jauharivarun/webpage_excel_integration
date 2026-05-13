from fastapi import APIRouter

from app.routers.candidates import router as candidates_router
from app.routers.imports import router as imports_router

api_router = APIRouter()
api_router.include_router(candidates_router, prefix="/candidates", tags=["candidates"])
api_router.include_router(imports_router, prefix="/imports", tags=["imports"])
