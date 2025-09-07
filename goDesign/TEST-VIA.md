## Epic S2: VIA (View / Inspect / Action) End-to-End cURL Tests

Purpose: Reproducible manual / CI smoke walkthrough of the currently implemented VIA surface.

Notation:
- Base URL assumed: http://localhost:8080 (adjust if different)
- Auth disabled flag passed when starting server (`WithAuthDisabled(true)`); omit auth headers.
- For persistence scenarios set env vars: `MONGO_URI` & `MONGO_DB` before starting server.

### 0. Start Server
```bash
# (example) run server (adjust path/binary name if changed)
go run ./cmd/server &
SERVER_PID=$!
sleep 1
```

### 1. Load Workflow (CPN)
Simple INT workflow: p_in ->(t1 Auto adds 1)-> p_mid ->(t2 Manual echoes value)-> p_out.

```bash
cat > /tmp/via_cpn.json <<'JSON'
{
	"id": "via-cpn",
	"name": "VIA Demo",
	"description": "Demo for VIA tests",
	"colorSets": ["colset INT = int;"],
	"places": [
		{"id": "p_in",  "name": "In",  "colorSet": "INT"},
		{"id": "p_mid", "name": "Mid", "colorSet": "INT"},
		{"id": "p_out", "name": "Out", "colorSet": "INT"}
	],
	"transitions": [
		{"id": "t1", "name": "AutoAdd",  "kind": "Auto"},
		{"id": "t2", "name": "Manual",   "kind": "Manual"}
	],
	"arcs": [
		{"id": "a1", "sourceId": "p_in",  "targetId": "t1", "expression": "x",   "direction": "IN"},
		{"id": "a2", "sourceId": "t1",    "targetId": "p_mid", "expression": "x+1", "direction": "OUT"},
		{"id": "a3", "sourceId": "p_mid", "targetId": "t2", "expression": "y",   "direction": "IN"},
		{"id": "a4", "sourceId": "t2",    "targetId": "p_out", "expression": "y",   "direction": "OUT"}
	],
	"initialMarking": {"p_in": [{"value": 5, "timestamp": 0}]}
}
JSON

curl -s -X POST http://localhost:8080/api/cpn/load \
	-H 'Content-Type: application/json' \
	--data @/tmp/via_cpn.json | jq '.success'
```

Expect: `true`.

### 2. Create & Start Case
```bash
curl -s -X POST http://localhost:8080/api/cases/create \
	-H 'Content-Type: application/json' \
	-d '{"id":"case-via-1","cpnId":"via-cpn","name":"Demo Case"}' | jq '.success'

curl -s -X POST 'http://localhost:8080/api/cases/start?id=case-via-1' | jq '.success'
```

### 3. View: Colors List
```bash
curl -s http://localhost:8080/api/colors/list | jq '.data.colors'
```
Expect: `["INT"]`.

### 4. Action: Auto Step (advance t1)
```bash
curl -s -X POST 'http://localhost:8080/api/cases/execute?id=case-via-1&transitionId=t1' | jq '.success'
```
Token moved from p_in -> p_mid (value incremented to 6).

### 5. View: Marking
```bash
curl -s 'http://localhost:8080/api/cases/marking?id=case-via-1' | jq '.data.marking'
```
Expect p_mid has token value 6.

### 6. Inspect (Lifecycle – no persistence fallback)
Without persistence (no Mongo) the inspect endpoint returns empty with notice.
```bash
curl -s -X POST http://localhost:8080/api/tokens/inspect \
	-H 'Content-Type: application/json' \
	-d '{"caseId":"case-via-1","placeIds":["p_mid"]}' | jq '.data.notice,.data.lifecycles'
```
If persistence enabled you will see produced event for p_mid and lifecycle with status OPEN.

### 7. Enabled Transitions For Token
We ask which transitions a token at p_mid (value 6) enables.
```bash
curl -s -X POST http://localhost:8080/api/tokens/enabled \
	-H 'Content-Type: application/json' \
	-d '{"caseId":"case-via-1","tokens":[{"placeId":"p_mid","value":6}]}' | jq '.data.results[0]'
```
Expect: `enabledTransitions` includes t2.

### 8. Fire Transition via Token Context
```bash
curl -s -X POST http://localhost:8080/api/tokens/fire \
	-H 'Content-Type: application/json' \
	-d '{"caseId":"case-via-1","transitionId":"t2","tokenBinding":{"placeId":"p_mid","value":6}}' | jq '.success'
```
Expect: true. Token consumed from p_mid, produced at p_out.

### 9. Post-Fire Enabled Check (Should Be None)
```bash
curl -s -X POST http://localhost:8080/api/tokens/enabled \
	-H 'Content-Type: application/json' \
	-d '{"caseId":"case-via-1","tokens":[{"placeId":"p_mid","value":6}]}' | jq '.data.results[0].enabledTransitions'
```
Expect: `[]` (token consumed).

### 10. Inspect Lifecycle After Consumption (Persistence Mode)
If Mongo persistence is ON (events stored) you can observe produced+consumed pairing.
```bash
curl -s -X POST http://localhost:8080/api/tokens/inspect \
	-H 'Content-Type: application/json' \
	-d '{"caseId":"case-via-1","placeIds":["p_mid","p_out"],"limit":50}' | jq '.data.lifecycles'
```
Expect one lifecycle for token at p_mid with status CONSUMED and (optionally) new lifecycle(s) OPEN at p_out.

### 11. Value Hash Demonstration (Duplicate Values)
Fire manual transition again after injecting another initial token to produce identical value.
```bash
# Reset workflow to add second initial token value 5 then run steps again (simplified example)
curl -s -X POST 'http://localhost:8080/api/cpn/reset?id=via-cpn' | jq '.success'
curl -s -X POST 'http://localhost:8080/api/cases/execute?id=case-via-1&transitionId=t1' >/dev/null
curl -s -X POST 'http://localhost:8080/api/cases/execute?id=case-via-1&transitionId=t1' >/dev/null
curl -s -X POST http://localhost:8080/api/tokens/inspect \
	-H 'Content-Type: application/json' \
	-d '{"caseId":"case-via-1","placeIds":["p_mid"],"limit":100}' | jq '.data.items | map(.valueHash) | unique'
```
Expect: a single valueHash if values identical.

### 12. Error Case: Fire With Wrong Token Value
```bash
curl -s -X POST http://localhost:8080/api/tokens/fire \
	-H 'Content-Type: application/json' \
	-d '{"caseId":"case-via-1","transitionId":"t2","tokenBinding":{"placeId":"p_mid","value":999}}' | jq '.success,.error'
```
Expect: `false` and error explaining no matching binding.

### 13. Query Tokens (If tokens/query implemented)
NOTE: Current implementation may be limited; adapt filters accordingly.
```bash
curl -s -X POST http://localhost:8080/api/tokens/query \
	-H 'Content-Type: application/json' \
	-d '{"caseIds":["case-via-1"],"placeIds":["p_out"],"limit":20}' | jq '.data'
```
Expect: list of live/historical tokens depending on query mode (see handler implementation).

### 14. Cleanup
```bash
kill $SERVER_PID
```

### Summary Coverage
- colors/list: Step 3
- tokens/enabled: Steps 7 & 9
- tokens/fire: Steps 8 & 12
- tokens/inspect (events + lifecycle): Steps 6 & 10 & 11
- tokens/query: Step 13
- Value hash & lifecycle pairing: Steps 10 & 11

---
End of TEST-VIA
