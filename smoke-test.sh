#!/usr/bin/env bash
# CA Deal Engine - Full-stack smoke test
# Runs against a live backend (default http://localhost:3001) and frontend (:3000).
# Usage: ./smoke-test.sh [backend_url] [frontend_url]
set -u

BACKEND="${1:-http://localhost:3001}"
FRONTEND="${2:-http://localhost:3000}"
PASS=0
FAIL=0

check() {
  local name="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo "PASS: $name"
    PASS=$((PASS+1))
  else
    echo "FAIL: $name (expected: $expected, got: $actual)"
    FAIL=$((FAIL+1))
  fi
}

check_contains() {
  local name="$1" needle="$2" haystack="$3"
  if echo "$haystack" | grep -q "$needle"; then
    echo "PASS: $name"
    PASS=$((PASS+1))
  else
    echo "FAIL: $name (missing: $needle)"
    FAIL=$((FAIL+1))
  fi
}

echo "=== CA Deal Engine Smoke Test ==="
echo "Backend: $BACKEND  Frontend: $FRONTEND"
echo ""

# --- Backend health ---
HEALTH=$(curl -s -o /dev/null -w '%{http_code}' "$BACKEND/health")
check "backend /health" "200" "$HEALTH"

# --- Auth: login ---
LOGIN_BODY=$(curl -s -X POST "$BACKEND/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"Demo123!"}')
check_contains "login returns token" '"token"' "$LOGIN_BODY"

TOKEN=$(echo "$LOGIN_BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
AUTH="Authorization: Bearer $TOKEN"

# --- Auth: bad credentials rejected ---
BAD=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BACKEND/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"WRONG"}')
check "login rejects bad password" "401" "$BAD"

# --- Auth: /me with real token ---
ME=$(curl -s -o /dev/null -w '%{http_code}' "$BACKEND/api/auth/me" -H "$AUTH")
check "GET /auth/me with token" "200" "$ME"

# --- Security: forged token rejected ---
FORGED=$(node -e "
const jwt = require('jsonwebtoken');
console.log(jwt.sign({userId:'x',email:'x@x.com',mfaVerified:true}, 'default-secret-change-me', {expiresIn:'1h'}));
" 2>/dev/null)
if [ -n "$FORGED" ]; then
  FORGED_RES=$(curl -s -o /dev/null -w '%{http_code}' "$BACKEND/api/auth/me" \
    -H "Authorization: Bearer $FORGED")
  check "forged token (fallback secret) rejected" "401" "$FORGED_RES"
fi

# --- Protected routes without token ---
NOAUTH=$(curl -s -o /dev/null -w '%{http_code}' "$BACKEND/api/leads")
check "GET /leads without token" "401" "$NOAUTH"

# --- Leads ---
LEADS=$(curl -s -o /dev/null -w '%{http_code}' "$BACKEND/api/leads" -H "$AUTH")
check "GET /leads with token" "200" "$LEADS"

# --- Parcels search ---
PARCELS=$(curl -s -o /dev/null -w '%{http_code}' "$BACKEND/api/parcels/search?q=Main" -H "$AUTH")
check "GET /parcels/search" "200" "$PARCELS"

# --- Calculator: wholesale math ---
CALC=$(curl -s -X POST "$BACKEND/api/calculator/wholesale" -H "$AUTH" \
  -H 'Content-Type: application/json' \
  -d '{"arv":350000,"rehab":30000,"holding":5000,"closing":8000,"wholesaleFee":10000,"buyerMargin":0.20}')
check_contains "wholesale maxOffer = 227000" '"maxOffer":227000' "$CALC"

# --- Admin stats ---
STATS=$(curl -s -o /dev/null -w '%{http_code}' "$BACKEND/api/admin/stats" -H "$AUTH")
check "GET /admin/stats" "200" "$STATS"

# --- Exports ---
EXPORT_ML=$(curl -s -X POST "$BACKEND/api/export/mailing-list" -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{}' | head -c 100)
check_contains "export mailing-list CSV header" 'Owner Name' "$EXPORT_ML"

# --- Frontend ---
LOGIN_PAGE=$(curl -s "$FRONTEND/login")
check_contains "frontend /login renders" 'CA Deal Engine' "$LOGIN_PAGE"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
