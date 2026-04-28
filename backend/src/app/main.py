from fastapi import FastAPI

from app.auth.router import router as auth_router
from app.routers.documents import router as documents_router

app = FastAPI(title="Regulatory and Licensing System")

app.include_router(auth_router)
app.include_router(documents_router)


@app.get("/health")
def health():
    return {"status": "ok"}
