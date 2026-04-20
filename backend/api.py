import json
import os
from typing import Any

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from backend.engine import create_engine
from backend.utils import extract_text_from_pdf, extract_text_from_docx, scrape_jd_from_url

# Load environment variables
load_dotenv()

app = FastAPI(title="Agentic Resume Auditor API")

# Add CORS Middleware
allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

LABEL_CRITIC = "--- CRITIC: Identifying gaps ---"
LABEL_WRITER = "--- WRITER: Rewriting bullets ---"
LABEL_AUDITOR = "--- AUDITOR: Validating content ---"


class AuditResponse(BaseModel):
    analysis_report: list[str]
    draft_bullets: list[str]
    audit_feedback: str
    iteration_count: int


# Initialize Engine
engine = create_engine()


async def _build_initial_state(
    resume_file: UploadFile | None,
    resume_text: str | None,
    jd_input: str,
) -> dict[str, Any]:
    """Shared resume/JD parsing for /audit and /audit/stream."""
    final_resume_text = ""
    if resume_file:
        content = await resume_file.read()
        if not resume_file.filename:
            raise HTTPException(status_code=400, detail="Resume filename missing")
        if resume_file.filename.endswith(".pdf"):
            final_resume_text = extract_text_from_pdf(content)
        elif resume_file.filename.endswith(".docx"):
            final_resume_text = extract_text_from_docx(content)
        else:
            try:
                final_resume_text = content.decode("utf-8")
            except UnicodeDecodeError:
                final_resume_text = content.decode("latin-1")
    elif resume_text:
        final_resume_text = resume_text
    else:
        raise HTTPException(status_code=400, detail="No resume provided")

    final_jd_text = jd_input
    if jd_input.strip().startswith(("http://", "https://")):
        final_jd_text = scrape_jd_from_url(jd_input.strip())

    return {
        "original_resume": final_resume_text,
        "job_description": final_jd_text,
        "analysis_report": [],
        "draft_bullets": [],
        "audit_feedback": None,
        "iteration_count": 0,
    }


def _emit_ndjson(obj: dict[str, Any]) -> str:
    return json.dumps(obj, ensure_ascii=False) + "\n"


def _audit_stream_generator(initial_state: dict[str, Any]) -> Any:
    """
    NDJSON stream: lines of {"type":"stage","label":...} then {"type":"result",...}.
    Stage labels match server logs (engine + conditional routing).
    """
    max_iters = int(os.getenv("MAX_ITERATIONS", 3))
    merged: dict[str, Any] = dict(initial_state)

    try:
        for chunk in engine.stream(initial_state, stream_mode="updates", version="v1"):
            for node_name, node_out in chunk.items():
                if not isinstance(node_out, dict):
                    continue
                merged.update(node_out)

                if node_name == "critic":
                    yield _emit_ndjson({"type": "stage", "label": LABEL_CRITIC})
                elif node_name == "writer":
                    yield _emit_ndjson({"type": "stage", "label": LABEL_WRITER})
                elif node_name == "auditor":
                    yield _emit_ndjson({"type": "stage", "label": LABEL_AUDITOR})
                    fb = (merged.get("audit_feedback") or "").strip()
                    it = int(merged.get("iteration_count") or 0)
                    if "APPROVED" in fb.upper():
                        yield _emit_ndjson({"type": "stage", "label": "--- AUDIT APPROVED ---"})
                    elif it >= max_iters:
                        yield _emit_ndjson(
                            {"type": "stage", "label": f"--- MAX ITERATIONS ({max_iters}) REACHED ---"}
                        )
                    else:
                        yield _emit_ndjson(
                            {
                                "type": "stage",
                                "label": f"--- REJECTED: Re-routing to Writer (Iteration {it}) ---",
                            }
                        )

        yield _emit_ndjson(
            {
                "type": "result",
                "analysis_report": merged["analysis_report"],
                "draft_bullets": merged["draft_bullets"],
                "audit_feedback": merged.get("audit_feedback") or "",
                "iteration_count": merged["iteration_count"],
            }
        )
    except Exception as e:
        print(f"Error during audit stream: {str(e)}")
        yield _emit_ndjson({"type": "error", "detail": str(e)})


@app.post("/audit/stream")
async def audit_resume_stream(
    resume_file: UploadFile = File(None),
    resume_text: str = Form(None),
    jd_input: str = Form(...),
):
    """
    Same inputs as /audit; returns NDJSON: stage lines then a final result object.
    """
    try:
        initial_state = await _build_initial_state(resume_file, resume_text, jd_input)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return StreamingResponse(
        _audit_stream_generator(initial_state),
        media_type="application/x-ndjson",
    )


@app.post("/audit", response_model=AuditResponse)
async def audit_resume(
    resume_file: UploadFile = File(None),
    resume_text: str = Form(None),
    jd_input: str = Form(...),
):
    """
    Triggers the LangGraph engine. Supports file/text for resume and text/URL for JD.
    """
    try:
        initial_state = await _build_initial_state(resume_file, resume_text, jd_input)
        final_state = engine.invoke(initial_state)
        return {
            "analysis_report": final_state["analysis_report"],
            "draft_bullets": final_state["draft_bullets"],
            "audit_feedback": final_state.get("audit_feedback", ""),
            "iteration_count": final_state["iteration_count"],
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error during audit: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/health")
async def health_check():
    return {"status": "healthy", "model": os.getenv("LLM_MODEL")}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
