#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8082}"

echo "Loading LLM demo CPN..."
curl -sS -X POST "$BASE_URL/api/cpn/load" -H 'Content-Type: application/json' \
  --data-binary @- <<'JSON' | jq .status >/dev/null
{
  "id":"llm-demo","name":"LLM Demo","description":"","colorSets":["colset STR = string;"],
  "places":[{"id":"p_q","name":"q","colorSet":"STR"},{"id":"p_a","name":"a","colorSet":"STR"}],
  "transitions":[{"id":"t_llm","name":"Chat","kind":"LLM"}],
  "arcs":[{"id":"a1","sourceId":"p_q","targetId":"t_llm","expression":"q","direction":"IN"},
           {"id":"a2","sourceId":"t_llm","targetId":"p_a","expression":"answer","direction":"OUT"}],
  "initialMarking": {"p_q":[{"value":"Say hello in one sentence","timestamp":0}]}
}
JSON

echo "Query enabled transitions..."
curl -sS "$BASE_URL/api/transitions/enabled?id=llm-demo" | tee /tmp/gpf_enabled.json >/dev/null
if ! jq -e '.data[0].bindingCount > 0' /tmp/gpf_enabled.json >/dev/null; then
  echo "No binding found for LLM transition"; exit 1
fi

echo "Firing LLM transition..."
curl -sS -X POST "$BASE_URL/api/transitions/fire" -H 'Content-Type: application/json' \
  --data "{\"cpnId\":\"llm-demo\",\"transitionId\":\"t_llm\",\"bindingIndex\":0}" | jq .

echo "Marking after fire:"
curl -sS "$BASE_URL/api/marking/get?id=llm-demo" | jq .

echo "Loading LLM template demo CPN..."
curl -sS -X POST "$BASE_URL/api/cpn/load" -H 'Content-Type: application/json' \
  --data-binary @- <<'JSON' | jq .status >/dev/null
{
  "id":"llm-tpl","name":"LLM Tpl","description":"","colorSets":["colset STR = string;"],
  "places":[{"id":"p_q2","name":"q2","colorSet":"STR"},{"id":"p_a2","name":"a2","colorSet":"STR"}],
  "transitions":[{"id":"t_llm2","name":"Chat2","kind":"LLM","LlmTemplate":"Answer in 3 words: {{q}}","LlmVars":{"tone":"brief"},"Stream":true}],
  "arcs":[{"id":"b1","sourceId":"p_q2","targetId":"t_llm2","expression":"q","direction":"IN"},
           {"id":"b2","sourceId":"t_llm2","targetId":"p_a2","expression":"answer","direction":"OUT"}],
  "initialMarking": {"p_q2":[{"value":"Introduce yourself","timestamp":0}]}
}
JSON

echo "Firing LLM template transition..."
curl -sS -X POST "$BASE_URL/api/transitions/fire" -H 'Content-Type: application/json' \
  --data '{"cpnId":"llm-tpl","transitionId":"t_llm2","bindingIndex":0}' | jq .

echo "Marking after template fire:"
curl -sS "$BASE_URL/api/marking/get?id=llm-tpl" | jq .

echo "Loading LLM JSON demo CPN..."
curl -sS -X POST "$BASE_URL/api/cpn/load" -H 'Content-Type: application/json' \
  --data-binary @- <<'JSON' | jq .status >/dev/null
{
  "id":"llm-json","name":"LLM JSON","description":"",
  "jsonSchemas":[{"name":"Person","schema":{"type":"object","required":["name"],"properties":{"name":{"type":"string"}}}}],
  "colorSets":["colset STR = string;","colset PERSON = json<Person>;"],
  "places":[{"id":"p_q3","name":"q3","colorSet":"STR"},{"id":"p_a3","name":"a3","colorSet":"PERSON"}],
  "transitions":[{"id":"t_llm3","name":"Chat3","kind":"LLM","LlmTemplate":"{\\"name\\": \\\"{{q}}\\\"}","Stream":false}],
  "arcs":[{"id":"c1","sourceId":"p_q3","targetId":"t_llm3","expression":"q","direction":"IN"},
           {"id":"c2","sourceId":"t_llm3","targetId":"p_a3","expression":"answer","direction":"OUT"}],
  "initialMarking": {"p_q3":[{"value":"Alice","timestamp":0}]}
}
JSON

echo "Firing LLM JSON transition..."
curl -sS -X POST "$BASE_URL/api/transitions/fire" -H 'Content-Type: application/json' \
  --data '{"cpnId":"llm-json","transitionId":"t_llm3","bindingIndex":0}' | jq .

echo "Marking after JSON fire:"
curl -sS "$BASE_URL/api/marking/get?id=llm-json" | jq .

echo "Loading LLM JSON STREAM demo CPN..."
curl -sS -X POST "$BASE_URL/api/cpn/load" -H 'Content-Type: application/json' \
  --data-binary @- <<'JSON' | jq .status >/dev/null
{
  "id":"llm-json-stream","name":"LLM JSON Stream","description":"",
  "jsonSchemas":[{"name":"Person","schema":{"type":"object","required":["name"],"properties":{"name":{"type":"string"}}}}],
  "colorSets":["colset STR = string;","colset PERSON = json<Person>;"],
  "places":[{"id":"p_q4","name":"q4","colorSet":"STR"},{"id":"p_a4","name":"a4","colorSet":"PERSON"}],
  "transitions":[{"id":"t_llm4","name":"Chat4","kind":"LLM","LlmTemplate":"{\\"name\\": \\\"{{q}}\\\"}","Stream":true}],
  "arcs":[{"id":"d1","sourceId":"p_q4","targetId":"t_llm4","expression":"q","direction":"IN"},
           {"id":"d2","sourceId":"t_llm4","targetId":"p_a4","expression":"answer","direction":"OUT"}],
  "initialMarking": {"p_q4":[{"value":"Charlie","timestamp":0}]}
}
JSON

echo "Firing LLM JSON STREAM transition..."
curl -sS -X POST "$BASE_URL/api/transitions/fire" -H 'Content-Type: application/json' \
  --data '{"cpnId":"llm-json-stream","transitionId":"t_llm4","bindingIndex":0}' | jq .

echo "Marking after JSON STREAM fire:"
curl -sS "$BASE_URL/api/marking/get?id=llm-json-stream" | jq .
