from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import analyzer, matcher

app = FastAPI(title="NMM AI Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    description: str


class CompareRequest(BaseModel):
    description_a: str
    dna_a: dict = Field(default_factory=dict)
    description_b: str
    dna_b: dict = Field(default_factory=dict)


class FindMatchesRequest(BaseModel):
    description: str
    category: str = ""
    limit: int = 10


class NormalizeRequest(BaseModel):
    description: str


@app.get("/health")
def health():
    return {"status": "UP", "service": "nmm-ai-service"}


@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    dna = analyzer.extract_dna(req.description)
    normalized = analyzer.normalize_description(req.description)
    return {"normalized": normalized, "dna": dna}


@app.post("/normalize")
def normalize(req: NormalizeRequest):
    return {"normalized": analyzer.normalize_description(req.description)}


@app.post("/compare")
def compare(req: CompareRequest):
    return matcher.compare(req.description_a, req.dna_a, req.description_b, req.dna_b)


@app.post("/find-matches")
def find_matches(req: FindMatchesRequest):
    # Standalone helper: returns basic guidance. Cross-CPSE matching is orchestrated
    # by the backend which manages the full candidate pool persistently.
    dna = analyzer.extract_dna(req.description)
    return {
        "query": req.description,
        "category": dna.get("category"),
        "matches": [],
        "note": "Candidate matching is orchestrated by the backend matching service.",
    }
