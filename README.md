# JDAlign: Agentic Resume Auditor

JDAlign is an AI productivity tool that bridges generic rewrites and fact-grounded career documents. It uses a **multi-agent state machine** (LangGraph) to analyze, rewrite, and audit resume content against job descriptions, with an **Auditor** step that rejects hallucinated claims.

---

## Features

- **Multi-agent orchestration**: LangGraph for stateful, cyclic agent loops.
- **Self-correction**: An internal Auditor catches inconsistencies and routes back to the Writer.
- **Google OAuth**: NextAuth.js (optional; can be disabled for local use).
- **Provider-agnostic LLMs**: Ollama locally or OpenRouter / other LiteLLM providers via environment variables.
- **STAR-oriented rewrites**: Bullets framed as Situation, Task, Action, Result.
- **Observability**: Optional LangSmith tracing when a valid API key is configured.
- **Live pipeline UI**: The app calls `POST /audit/stream` (NDJSON) so the **Audit Results** pane shows the same stages as backend logs (critic → writer → auditor, plus approval / rejection / max-iterations), then the final payload.

---

## System flow

1. **Critic** — Compares resume vs JD and lists critical gaps.
2. **Writer** — Drafts bullets using the gap list and original resume.
3. **Auditor** — Checks drafts against the original resume; **REJECTS** or **APPROVES**.
4. **Loop** — On rejection, feedback returns to the Writer until approval or `MAX_ITERATIONS`.

---

## Tech stack

- **Backend**: Python 3.12+, FastAPI, LangGraph, LiteLLM, Pydantic. Dependencies are declared in `pyproject.toml` and pinned in **`uv.lock`**; installs use **[uv](https://docs.astral.sh/uv/)**.
- **Frontend**: Next.js 16, TypeScript, Tailwind CSS, Lucide.
- **Auth**: NextAuth.js (Google).
- **Runtime**: Docker Compose (optional local Ollama on the host).

---

## Getting started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) with Compose
- (Optional) [Ollama](https://ollama.com/) on the host for local models
- (Optional) [uv](https://docs.astral.sh/uv/getting-started/installation/) if you run the backend outside Docker

### Configure environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

- **Ollama from Docker**: set `LLM_BASE_URL=http://host.docker.internal:11434` so the backend container can reach Ollama on your machine. Compose already sets `extra_hosts` for `host.docker.internal`.
- **Ollama without Docker** (or Python on the host): use `http://localhost:11434`.
- **OpenRouter**: uncomment the OpenRouter block in `.env.example`, set `OPENROUTER_API_KEY`, and point `LLM_MODEL` / `LLM_BASE_URL` at OpenRouter. No extra Docker networking is required (outbound HTTPS).
- **LangSmith**: leave `LANGCHAIN_TRACING_V2=false` until you add a real `LANGCHAIN_API_KEY`. Tracing with `true` and a placeholder key causes **401** errors and noisy logs.

### Launch with Docker

```bash
docker compose up --build
```

- **Frontend**: [http://localhost:3003](http://localhost:3003)
- **Backend API**: [http://localhost:8000](http://localhost:8000)

### Run the backend locally (without Docker)

From the **repository root** (where `pyproject.toml` lives):

```bash
uv sync --frozen --no-dev --no-install-project
uv run python -m backend.api
```

Use `uv sync` without `--frozen` when you intentionally change dependencies and have regenerated `uv.lock` with `uv lock`.

---

## Configuration (`backend/.env`)

See `backend/.env.example` for a full template. Highlights:

| Category | Variable | Notes |
|----------|----------|--------|
| **Auth** | `NEXT_PUBLIC_AUTH_ENABLED`, `GOOGLE_*`, `NEXTAUTH_*` | Required when auth is enabled. |
| **LLM** | `LLM_MODEL` | LiteLLM route, e.g. `ollama/llama3` or `openrouter/anthropic/claude-3.5-sonnet`. |
| | `LLM_BASE_URL` | Ollama: `http://host.docker.internal:11434` in Docker, `http://localhost:11434` on host. OpenRouter: `https://openrouter.ai/api/v1`. |
| | `OPENROUTER_API_KEY` | Required when using OpenRouter. |
| **Control** | `MAX_ITERATIONS` | Cap on critic–writer–auditor loops (default 3). |
| **Tracing** | `LANGCHAIN_TRACING_V2`, `LANGCHAIN_API_KEY`, `LANGCHAIN_PROJECT` | Optional LangSmith; use a valid key or keep tracing off. |

---

## Secrets, LangSmith, and Docker

- **`backend/.env` is gitignored.** Never commit API keys. Copy from `.env.example` only.
- **Compose** loads `backend/.env` at **container runtime** (`env_file` in `docker-compose.yml`), not into the image recipe.
- **`.dockerignore`** excludes `backend/.env` from the build context so `COPY backend/` does not bake secrets into image layers.
- **Production**: store keys in your host’s secret store (Railway, Render, GitHub Actions secrets, etc.) and inject them as environment variables—same variable names as in `.env.example`.

---

## Dependency updates (backend)

1. Edit **`pyproject.toml`** `[project].dependencies`.
2. Run **`uv lock`** to refresh **`uv.lock`**.
3. Commit both files. CI and Docker use **`uv sync --frozen`** so installs match the lockfile.

---

## Deployment

### Backend (Render, Railway, etc.)

1. Connect the GitHub repo.
2. Set **root directory** to the repository root (`.`).
3. **Build command** (install uv, then sync from the lockfile):

   ```bash
   pip install uv && uv sync --frozen --no-dev --no-install-project
   ```

4. **Start command** (repo root on `PYTHONPATH`; `uv run` uses the project virtualenv):

   ```bash
   uv run uvicorn backend.api:app --host 0.0.0.0 --port $PORT
   ```

   If the platform does not put `uv` on `PATH` after build, use:

   ```bash
   .venv/bin/uvicorn backend.api:app --host 0.0.0.0 --port $PORT
   ```

5. Add environment variables from `backend/.env.example` in the provider dashboard (use secrets for keys).

### Frontend (Vercel)

1. Framework preset: **Next.js**.
2. Root directory: **`frontend`**.
3. Environment variables: `NEXT_PUBLIC_API_URL` (public backend URL), `NEXT_PUBLIC_AUTH_ENABLED`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (your production site URL).

---

## Stopping the stack

```bash
docker compose down
```
