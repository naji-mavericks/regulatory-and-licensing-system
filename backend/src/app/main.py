from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.router import router as auth_router
from app.routers.applications import router as applications_router
from app.routers.documents import router as documents_router

app = FastAPI(title="Regulatory and Licensing System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(documents_router)
app.include_router(applications_router)


@app.get("/health")
def health():
    return {"status": "ok"}
