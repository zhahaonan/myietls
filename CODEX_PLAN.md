# CODEX_PLAN.md — Hackathon MVP Execution Plan (OpenAI-Compatible API)

> Target repo: myielts-voice-5
> Fixed ports (edit if needed):
> - Backend: http://localhost:8000
> - Frontend: http://localhost:5173

## HARD RULES (MUST FOLLOW)
1. Codex MUST execute **ONLY ONE STEP** at a time (Step0, Step1, Step2...).
2. After finishing a step, Codex MUST run: `./scripts/verify.sh stepN` and paste the output.
3. After finishing a step, Codex MUST summarize:
   - Files changed
   - What changed (short)
   - Verify result (pass/fail)
   - Next step suggestion
4. No large refactors. No framework swaps. Keep changes minimal and reviewable.

---

## Goal (Hackathon MVP)
- Unify API management using **OpenAI-compatible** endpoints.
- Frontend contains **NO secrets** (no API keys in TS/React).
- TTS is proxied by backend through OpenAI-style endpoint.
- Existing speaking evaluation remains but moved to a clear custom endpoint.
- Add waveform UI for both user recording and TTS playback.
- Implement Part1 personalization: RAG-ish sample retrieval + rewrite + band control.
- Band levels fixed: **5.5 / 6 / 6.5 / 7 / 7.5 / 8**

---

## Environment Variables

### Backend (.env or exported in shell)
- OPENAI_BASE_URL=... (optional if using official OpenAI)
- OPENAI_API_KEY=...
- OPENAI_MODEL=...
- DASHSCOPE_API_KEY=... (for Aliyun DashScope TTS)
- DASHSCOPE_TTS_MODEL=... (optional)
- DASHSCOPE_TTS_VOICE=... (optional)
- ALLOW_ORIGINS=* (or http://localhost:5173)

### Frontend (.env)
- VITE_API_BASE=http://localhost:8000

---

## Step0 — Baseline & Safety
### Goal
Make repo safe to iterate: git baseline + verify script runnable.

### Files to change
- scripts/verify.sh (create)
- (no business logic changes)

### Commands
- `chmod +x scripts/verify.sh`
- `./scripts/verify.sh step0`

### Done when
- step0 verification passes.

---

## Step1 — Split endpoints: preserve evaluation, free standard ChatCompletions
### Goal
Move existing multipart speaking evaluation off `/v1/chat/completions`, and reserve `/v1/chat/completions` for standard JSON chat.

### Files to change
- backend/main.py (or wherever FastAPI routes live)
- frontend/services/apiService.ts (or where callIELTSAgent lives)

### Spec
1) Rename current multipart endpoint:
- FROM: `POST /v1/chat/completions` (multipart audio)
- TO:   `POST /v1/ielts/evaluate` (multipart audio)
- Keep response structure the same as before (don’t break UI parsing).

2) Add standard OpenAI-style JSON endpoint:
- `POST /v1/chat/completions` accepts JSON: `{ model?, messages, metadata? }`
- Returns JSON with keys: `id, object, created, model, choices`
- For now minimal behavior is okay (echo last user message or placeholder) — real LLM wiring comes Step2.

3) Frontend:
- Update `callIELTSAgent()` to use `/v1/ielts/evaluate` (multipart unchanged).

### Commands
- Run backend, then: `./scripts/verify.sh step1`

### Done when
- verify step1 passes.

---

## Step2 — Wire standard ChatCompletions to OpenAI-compatible LLM client
### Goal
Implement a reusable OpenAI-compatible client in backend and use it for `/v1/chat/completions`.

### Files to change
- backend/engine/openai_client.py (new)
- backend/main.py (use openai_client)
- (optional) backend/engine/camel_agents.py (switch from Gemini to openai_client)

### Spec
- openai_client reads `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`.
- Exposes function: `chat(messages, temperature=0.7, response_format?)`.
- `/v1/chat/completions` should actually call the LLM and return content.

### Commands
- `./scripts/verify.sh step2`

### Done when
- step2 verification passes (chat endpoint returns choices[0].message.content non-empty).

---

## Step3 — TTS proxy via OpenAI-style endpoint
### Goal
Frontend should never call DashScope directly. Backend proxies TTS.

### Files to change
- backend/main.py
- backend/engine/tts.py (new, optional)
- frontend/engine/TTSProvider.ts (remove hardcoded key, call backend)

### Spec
- Add endpoint: `POST /v1/audio/speech`
- Request JSON (OpenAI-like):
  - `{ input: string, voice?: string, format?: "wav"|"mp3", model?: string }`
- Response: audio bytes, Content-Type: audio/wav (or audio/mpeg)
- Frontend TTSProvider uses `VITE_API_BASE` + `/v1/audio/speech`

### Commands
- `./scripts/verify.sh step3`

### Done when
- verify step3 passes and frontend contains no TTS keys.

---

## Step4 — Waveform UI (User recording + TTS playback)
### Goal
Add waveform visualization in MockTest for both user audio and TTS audio.

### Files to change
- frontend/components/WaveformCanvas.tsx (new)
- frontend/components/MockTest.tsx (use WaveformCanvas)

### Spec
- Live waveform during recording (MediaStream + AnalyserNode)
- Static waveform after recording (decode Blob -> AudioBuffer -> draw)
- Static waveform for TTS blob as well

### Commands
- `./scripts/verify.sh step4`

### Done when
- verify step4 passes (presence checks). Manual UI check recommended.

---

## Step5 — Part1 personalization task (metadata.task="p1_answer")
### Goal
Implement Part1 answer generation with band control and sample retrieval, using standard `/v1/chat/completions`.

### Files to change
- backend/engine/p1_service.py (new)
- backend/main.py (route handler to dispatch metadata.task)
- frontend/components/PracticeBank.tsx (call chat endpoint with metadata.task)

### Spec
- Allowed bands: ["5.5","6","6.5","7","7.5","8"] else 400
- Input:
  - POST /v1/chat/completions
  - body: `{ messages, metadata: { task:"p1_answer", band, profile, question } }`
- Retrieval:
  - Use existing question bank JSON for MVP (simple keyword match TopK).
- Output:
  - choices[0].message.content is a 2–4 sentence spoken answer, personalized to profile.
  - One answer only.

### Commands
- `./scripts/verify.sh step5`

### Done when
- verify step5 passes and UI can generate one personalized answer.

---

## How to ask Codex to run
Use one of these commands/prompts in Codex terminal:

- "Read CODEX_PLAN.md and execute ONLY Step1. Then run ./scripts/verify.sh step1 and paste output + summary."
- "Continue with ONLY Step2 ..."

