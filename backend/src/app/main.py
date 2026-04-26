from fastapi import FastAPI

app = FastAPI(title="Regulatory and Licensing System")


@app.get("/health")
def health():
    return {"status": "ok"}
