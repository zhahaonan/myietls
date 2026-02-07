#!/usr/bin/env bash
set -euo pipefail

STEP="${1:-}"

# ---- Config (edit these if ports change) ----
API_BASE="http://localhost:8000"
FRONT_BASE="http://localhost:5173"
TIMEOUT_SEC="3"

# ---- Helpers ----
fail() { echo "❌ $1"; exit 1; }
ok() { echo "✅ $1"; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

http_status() {
  # prints status code only
  curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT_SEC" "$1" || true
}

curl_json() {
  curl -sS --max-time "$TIMEOUT_SEC" -H "Content-Type: application/json" -d "$2" "$1"
}

grep_must_not() {
  local pattern="$1"
  local path="$2"
  if grep -RIn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=build \
      --exclude="*.lock" --exclude="*.map" "$pattern" "$path" >/dev/null 2>&1; then
    echo "Found forbidden pattern: $pattern"
    grep -RIn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=build \
      --exclude="*.lock" --exclude="*.map" "$pattern" "$path" | head -n 20
    fail "Forbidden pattern exists in $path"
  else
    ok "No forbidden pattern '$pattern' in $path"
  fi
}

grep_must_have() {
  local pattern="$1"
  local path="$2"
  if grep -RIn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=build \
      --exclude="*.lock" --exclude="*.map" "$pattern" "$path" >/dev/null 2>&1; then
    ok "Found required pattern '$pattern' in $path"
  else
    fail "Required pattern not found: $pattern in $path"
  fi
}

check_backend_running() {
  local code
  code="$(http_status "$API_BASE/docs")"
  if [[ "$code" != "200" ]]; then
    fail "Backend not reachable at $API_BASE (GET /docs => $code). Start uvicorn first."
  fi
  ok "Backend reachable ($API_BASE)"
}

check_frontend_present() {
  # not strict "running", just checks repo structure
  [[ -f package.json ]] || fail "package.json not found at repo root."
  ok "Frontend project files present"
}

# ---- Steps ----
step0() {
  need_cmd git
  need_cmd curl
  need_cmd grep
  check_frontend_present
  [[ -d backend ]] || fail "backend/ directory missing."
  ok "backend/ directory present"
  ok "step0 done"
}

step1() {
  check_backend_running

  # Docs should be reachable
  local code
  code="$(http_status "$API_BASE/docs")"
  [[ "$code" == "200" ]] || fail "GET $API_BASE/docs expected 200, got $code"
  ok "GET /docs returns 200"

  # Expect new evaluate endpoint to exist (we accept 405 if method mismatch via GET)
  code="$(http_status "$API_BASE/v1/ielts/evaluate")"
  if [[ "$code" == "404" ]]; then
    fail "/v1/ielts/evaluate not found (404)."
  fi
  ok "/v1/ielts/evaluate exists (GET returned $code; 405 is fine)"

  # Chat completions should accept JSON POST (status not 404)
  code="$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT_SEC" \
      -H "Content-Type: application/json" \
      -d '{"model":"test","messages":[{"role":"user","content":"ping"}]}' \
      "$API_BASE/v1/chat/completions" || true)"
  [[ "$code" != "404" ]] || fail "/v1/chat/completions still missing (404)."
  ok "POST /v1/chat/completions exists (status $code)"

  ok "step1 done"
}

step2() {
  check_backend_running

  local resp
  resp="$(curl_json "$API_BASE/v1/chat/completions" '{"model":"test","messages":[{"role":"user","content":"say hello"}]}')"

  echo "$resp" | grep -q '"choices"' || fail "Response missing 'choices'"
  echo "$resp" | grep -q '"message"' || fail "Response missing 'message'"
  echo "$resp" | grep -q '"content"' || fail "Response missing 'content'"
  ok "chat completions returns OpenAI-like structure"

  ok "step2 done"
}

step3() {
  check_backend_running

  # Endpoint existence
  local code
  code="$(http_status "$API_BASE/v1/audio/speech")"
  [[ "$code" != "404" ]] || fail "/v1/audio/speech not found (404)."
  ok "/v1/audio/speech exists (GET returned $code; 405 is fine)"

  # Frontend should not contain obvious keys (basic hygiene checks)
  grep_must_not "DASHSCOPE_API_KEY" "."
  grep_must_not "dashscope.*api.*key" "."
  grep_must_not "sk-" "."

  ok "step3 done (Note: actual audio content check requires DASHSCOPE_API_KEY and POST success)."
}

step4() {
  # Pure repo checks
  [[ -f "components/WaveformCanvas.tsx" || -f "src/components/WaveformCanvas.tsx" || -f "frontend/components/WaveformCanvas.tsx" ]] \
    || fail "WaveformCanvas.tsx not found in common locations."

  # Ensure MockTest references WaveformCanvas somewhere
  grep_must_have "WaveformCanvas" "."

  ok "step4 done"
}

step5() {
  check_backend_running

  local resp
  resp="$(curl_json "$API_BASE/v1/chat/completions" '{
    "model":"test",
    "messages":[{"role":"user","content":"Generate Part1 answer"}],
    "metadata":{
      "task":"p1_answer",
      "band":"6.5",
      "question":"Do you like your hometown?",
      "profile":{"identity":"student","hobbies":["music","badminton"],"city":"Shanghai"}
    }
  }')"

  echo "$resp" | grep -q '"choices"' || fail "Response missing 'choices'"
  echo "$resp" | grep -q '"content"' || fail "Response missing 'content'"
  ok "p1_answer returns content"

  ok "step5 done"
}

# ---- Router ----
case "$STEP" in
  step0) step0 ;;
  step1) step1 ;;
  step2) step2 ;;
  step3) step3 ;;
  step4) step4 ;;
  step5) step5 ;;
  *)
    echo "Usage: $0 step0|step1|step2|step3|step4|step5"
    exit 2
    ;;
esac
