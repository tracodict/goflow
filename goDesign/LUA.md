## CPN Tool Style Inscription
## Revamp prompt

redesign inscription to align to CPN tools more, update detailed design to #file:LUA.md 
1. for input and out arc inscription, follow the proposed Lua inscription above, to define how Lua variables are inscripted to denote bound tokens
2. for transition action inscription in cpn tools, there are three parts:
  a. input pattern: a tuple of CPN variables
  b. output pattern: a tuple of CPN variables
  c. code action: an ML expression,
  currently, go-petri-flow transition's actionExpression is the part c: code action. update the design, so that actionExpression is always a Lua function and rename it to actionFunction:
  a. the function name should be {transiton_id}_action, the parameters form the tuple, like input pattern of cpn tools
  b. the return statement in the Lua function can return a tuple of variables or values. Since Lua can't define a tuple of variables in function signature, go-petri-net transition needs to explicit have another `actionFunctionOutput` property to define a tuple of variables as actionFunction's output pattern. 
  c. current actionExpression (exclusiving return statement) basically acts the role of cpn tools transition code action

When a transition is fired, revamp the design, which is described  #file:TEST-varscope.md , to new design:
1. arc variable is a multiset expression, only used to bind variable to token,  should be immutable, and scope should be adjacent, 
2. when a transition is fired, it will call the actionFunction, the function's argument tuple would match input arcs' inscription and the tokens bound to input arcs' variable will be passed as value by actionFunction argument that has same name
3. when the actionFunction returns, the returned tuples bind to variables listed in `actionFunctionOutput`, implemented like `local a,b,c = transition_1_action()`, iif transition_1_action return a three item tuple, and the `actionFunctionOutput` is a, b, c

take in consideration of input/output arc inscription, guard inscription, action inscription in above chat history, append updated inscription design for go-petri-flow to #file:LUA.md 

Since the actionFunction name always follow convention of {transition_id}_action, we can have a API like `/api/cpn/transitions/actions` to GET all actionFunctions' details.

## CPN Tool Style Inscription
This section specifies the redesigned inscription model aligning go-petri-flow more closely with Classical CPN Tools semantics while remaining pragmatic for a dynamic Lua embedding and existing workflow engine features (LLM / Tools transitions).

### 1. Goals
* Preserve expressive power of prior `actionExpression` while formalizing input/output patterns and multiset semantics.
* Make variable binding explicit, immutable, and local to a single firing.
* Support production/consumption of multiple tokens per arc via multiset expressions (value with multiplicity) in both input and output directions.
* Provide a structured action function interface (`actionFunction`) with explicit outputs (`actionFunctionOutput`).
* Offer backward compatibility for existing nets that still use `actionExpression`.
* Expose metadata for tooling / UI via a new REST endpoint listing action functions.

### 2. Terminology
| Term | Meaning |
|------|---------|
| Binding Variable | A Lua identifier appearing in an input arc multiset expression denoting a token value placeholder. |
| Input Multiset Expression | Lua snippet that evaluates to one or more multiset elements consumed from the source place. |
| Multiset Element | Either a simple variable name (implicit multiplicity=1) or a table/value paired with an integer multiplicity. |
| Normalization | Canonical representation of an output multiset as a list of {value, count} with count > 0 merged by value equality. |
| Action Function | Lua function named `{transition_id}_action` invoked exactly once per firing after successful binding & guard. |
| Action Outputs | Ordered variable names listed in `actionFunctionOutput` receiving the multiple return values of the action. |

### 3. JSON Model Additions
Each Transition gains two optional fields:
```
"actionFunction": "function t_proc_action(x,y) \n  -- body (no surrounding return tuple wrapper inserted automatically) \n  return x + y, x * y \n end",
"actionFunctionOutput": ["sum","prod"]
```
Rules:
* `actionFunction` MUST define exactly one Lua function whose name == `{transition_id}_action`.
* The parameter list forms the ordered INPUT PATTERN tuple.
* `actionFunctionOutput` lists zero or more identifiers forming the OUTPUT PATTERN tuple.
* Arity match: number of return values produced at runtime MUST equal length of `actionFunctionOutput` (0 allowed). Single return + single output is fine. Extra returns or too few returns => runtime error.
* Identifiers in `actionFunctionOutput` are bound after the function returns (e.g., `local sum,prod = t_proc_action(...)`). They behave like immutable binding variables for subsequent output arc evaluation only.

### 4. Backward Compatibility (`actionExpression` Legacy)
If a transition lacks `actionFunction` but has `actionExpression` (legacy):
1. The engine synthesizes a wrapper function `{id}_action()` whose body is exactly the legacy code (unless it already starts with `function`).
2. If the legacy expression contains an explicit `return`, its returned values map to `actionFunctionOutput` derived heuristically: when a single value returned and no existing outputs, an implicit temp name `_ret` is used but NOT exposed to output arcs (maintains prior semantics where outgoing arcs referenced transition ID alias). For multi-value returns, engine will raise an error unless the net is updated to the new format.
3. All legacy adjacency aliases (arc ID / transition ID) remain temporarily supported but marked DEPRECATED in docs; new nets must use binding variables & output multiset semantics.

### 5. Input Arc Multiset Inscriptions
An input arc inscription now denotes a multiset pattern describing which tokens (and how many) can be consumed from the place. Grammar (conceptual):
```
InputArcExpr := SimpleBinding | MultiPattern
SimpleBinding := <Identifier>                -- equivalent to consuming 1 token bound to Identifier
MultiPattern  := 'return' <LuaExpression>    -- Lua expression evaluating to one of:
    a) a single variable name string (deprecated form treated as SimpleBinding)
    b) a table { value = <expr>, count = <int_expr> }
    c) an array list of a/b shapes
```
Simpler (ergonomic) form: if the entire inscription is just an identifier (no `return` keyword), it is treated as SimpleBinding with multiplicity = 1.

Binding Semantics:
* Each SimpleBinding consumes exactly one token and binds the variable to its value (plus implicit `<var>_timestamp`).
* A table form must provide `count >= 1` integer. That many tokens of (possibly matching) value are required. If the place doesn't have sufficient tokens of that value (value equality by deep JSON equivalence), binding fails for that alternative.
* When array form returns multiple elements, all must be simultaneously satisfiable; variables inside are distinct OR reused with identical value requirement.
* Variables are immutable once bound in a candidate binding.

Multiple Input Arcs:
* Engine enumerates combinations across input arcs (cartesian search with pruning) to produce candidate bindings.
* Order of evaluation is deterministic: sorted by arc ID (or attach explicit priority later—out of scope now) to reduce nondeterminism.
* On first successful complete binding passing the guard, the enumeration stops (single firing semantics). Future enhancement may allow maximal set selection.

### 6. Guard Evaluation Environment
Available during guard evaluation:
* All bound input variables and their `<var>_timestamp` fields.
* (Deprecated) Arc ID result aliases from legacy path if still enabled.
* No output variables yet.
Guard MUST evaluate to a truthy Lua value; non-boolean truthy accepted (Lua semantics). Errors or nil => binding rejected.

### 7. Action Function Invocation
* Parameters: EXACT ordered list of binding variable names as they appear in the function signature. Each must have been bound by input arcs; otherwise load-time validation error.
* The Lua state for the firing starts from a clean ephemeral environment (NEW FEATURE vs legacy) containing only standard libs + deterministic injected helper functions + pre-bound variables (read-only by convention). Attempting to reassign parameter names is allowed by Lua but semantically discouraged; engine MAY later enforce immutability by snapshot diff (future work).
* Any side-effect global definitions remain confined to this firing environment and are discarded (sandbox per firing) — target behavior for alignment. (If not implemented yet, doc will note “planned isolation”).

### 8. Action Outputs Binding
After the function returns:
```
local <actionFunctionOutput[1]>,...,<actionFunctionOutput[n]> = <transition_id>_action(<params...>)
```
* These output variables are then available (read-only) to outgoing output arc inscriptions.
* They are NOT visible to subsequent transition firings (environment cleared at end of firing).

### 9. Output Arc Multiset Inscriptions
An output arc inscription must evaluate to one of:
1. A single value (produces multiplicity 1 token of that value)
2. A table { value = <expr>, count = <int_expr> }
3. An array list of 1 or 2 forms above
4. A simple variable / identifier (shorthand for that variable’s bound value, multiplicity 1)

Evaluation occurs with access to:
* All input binding variables
* All action output variables (from `actionFunctionOutput`)
* (Deprecated) transition ID alias for legacy `actionExpression` return

Normalization Algorithm:
1. Collect raw elements (value, count default 1).
2. Validate each `count` is integer >=1.
3. Merge elements with deep-equal JSON values by summing counts.
4. Emit resulting list; insert that many tokens into target place (timestamp = current logical time or inherited strategy; unchanged from legacy engine).

### 10. Firing Sequence (Detailed)
1. For each input arc, prepare candidate token groups & variable assignments from its multiset expression.
2. Perform backtracking search across arcs to find a full consistent binding set (variable reuse requires identical value; mismatch prunes branch).
3. For each full binding candidate:
   a. Evaluate guard; if falsy, continue search.
   b. Invoke action function with ordered parameters.
   c. Capture returned values; enforce arity; bind output variables.
   d. Evaluate each output arc inscription into normalized multisets.
   e. Atomically: remove consumed tokens, add produced tokens.
   f. Stop (single firing per step call).
4. If no candidate succeeds => transition not enabled / no-op for that step.

### 11. Variable Scoping & Immutability
| Category | Scope | Write Allowed | Notes |
|----------|-------|---------------|-------|
| Input binding vars | Entire firing (guard + action + outputs) | Mutating table fields allowed (discouraged), rebind forbidden (future hard error) | Derived solely from tokens |
| `<var>_timestamp` | Read-only | No | Numeric timestamp of consumed token |
| Action parameters | Same as input vars | Same as above | Identical set (just ordered) |
| Action output vars | Output arc phase only | No rebind | Assigned from return; immutable afterwards |
| Legacy arc/transition aliases | Transitional, per phase | No guarantee | Deprecated; slated for removal |

### 12. Error Conditions
| Condition | Error Message (pattern) | Phase |
|-----------|-------------------------|-------|
| Unbound variable in action params | `unbound variable <name> in actionFunction params` | Load/validation |
| Duplicate conflicting value binding | `variable <name> conflict` | Binding search |
| Inscription returns invalid shape | `invalid multiset element` | Arc eval |
| count <=0 or non-integer | `invalid multiplicity` | Arc eval |
| Guard runtime error | `guard error: ...` | Guard |
| Guard nil/false | (silent prune) | Guard |
| Action returns wrong arity | `action return arity mismatch: expected N got M` | Action |
| Output var used but unbound | `unbound output variable <name>` | Output arc eval |
| Output inscription invalid type | `invalid output inscription` | Output arc eval |

### 13. REST Endpoint: List Action Functions
`GET /api/cpn/transitions/actions`
Response JSON:
```
[
  {
    "cpnId": "net_1",
    "transitionId": "t_proc",
    "functionName": "t_proc_action",
    "parameters": ["x","y"],
    "outputs": ["sum","prod"],
    "kind": "Auto",               // or Human, Tools, etc.
    "hasLegacyWrapper": false,
    "source": "function t_proc_action(x,y)\n  return x+y, x*y\nend"
  }
]
```
Use Cases: UI introspection, code assist, documentation export.

Status: Implemented as `GET /api/cpn/transitions/actions` returning the array of action function metadata for all loaded CPNs.

### 14. Examples
#### 14.0 Multiset Input & Output Example (Implemented)
```
{
  "id": "ms_net",
  "colorSets": ["colset INT = int;"],
  "places": [
    {"id":"p_in","name":"In","colorSet":"INT"},
    {"id":"p_out","name":"Out","colorSet":"INT"}
  ],
  "transitions": [
    {
      "id":"t_collect",
      "kind":"Auto",
      "actionFunction":"function t_collect_action(x) return x end",
      "actionFunctionOutput":["v"]
    }
  ],
  "arcs": [
    {"id":"a_in","sourceId":"p_in","targetId":"t_collect","direction":"IN","expression":"{ value = x, count = 2 }"},
    {"id":"a_out","sourceId":"t_collect","targetId":"p_out","direction":"OUT","expression":"{ value = v, count = 2 }"}
  ],
  "initialMarking": {"p_in":[{"value":5,"timestamp":0},{"value":5,"timestamp":0}]}
}
```
This net consumes two tokens of value 5 (binding `x` to 5) and produces two output tokens of value 5 via normalized output multiset.

#### 14.1 Summation & Product
```
{
  "id": "math_net",
  "colorSets": ["colset INT = int;"],
  "places": [
    {"id":"p_a","colorSet":"INT"},
    {"id":"p_b","colorSet":"INT"},
    {"id":"p_out","colorSet":"INT"}
  ],
  "transitions": [
    {
      "id":"t_proc",
      "kind":"Auto",
      "actionFunction": "function t_proc_action(a,b) return a+b, a*b end",
      "actionFunctionOutput": ["s","p"]
    }
  ],
  "arcs": [
    {"id":"a1","sourceId":"p_a","targetId":"t_proc","direction":"IN","expression":"a"},
    {"id":"a2","sourceId":"p_b","targetId":"t_proc","direction":"IN","expression":"b"},
    {"id":"a3","sourceId":"t_proc","targetId":"p_out","direction":"OUT","expression":"{ value = s, count = 1 }"},
    {"id":"a4","sourceId":"t_proc","targetId":"p_out","direction":"OUT","expression":"{ value = p, count = 1 }"}
  ],
  "initialMarking": {"p_a":[{"value":3,"timestamp":0}],"p_b":[{"value":4,"timestamp":0}]}
}
```

#### 14.2 Consuming Multiple Identical Tokens
Input arc wants two identical INT tokens binding variable `x` and one token binding `y` (distinct place):
```
// Arc inscription on p_x -> t:
return { value = x, count = 2 }
```
During search the engine tries each distinct token value in `p_x` that has multiplicity ≥2.

#### 14.3 Output Multi-token Production (Merged)
```
-- OUT arc expression
return {
  { value = s, count = 2 },
  { value = s, count = 3 }, -- merged => {s,5}
  { value = p, count = 1 }
}
```

### 15. Differences vs Classic CPN Tools
| Aspect | Classic CPN Tools | Redesigned go-petri-flow |
|--------|-------------------|--------------------------|
| Language | Standard ML expressions | Lua function + multiset snippets |
| Per-firing purity | Pure evaluation per binding | Planned sandbox per firing (migration ongoing) |
| Multiset binding | Built-in pattern semantics | Emulated via Lua table shapes |
| Output pattern | Tuple return | Explicit `actionFunctionOutput` mapping |
| Variable immutability | Enforced by functional style | Engine-level convention + (future) enforcement |
| Tool transitions | N/A | Integrated (no semantic change) |

### 16. Migration Guidance
1. For each transition with `actionExpression`, wrap logic into `actionFunction` with parameters for every variable formerly bound via simple input arc variables.
2. Add `actionFunctionOutput` if you previously relied on transition ID alias return values.
3. Replace complex output arc calculations referencing transition ID with explicit output variable referencing the function output.
4. Validate with new endpoint metadata; fix any arity mismatches.

### 17. Future Enhancements (Not Yet Implemented)
* Strict enforcement of parameter & binding immutability.
* Deterministic ordering strategy / priority weighting for bindings.
* Support for guard-dependent multiplicities (requires two-phase evaluation check).
* Partial firing with maximal multisets (batch consumption) for performance.

---
Document version: 2.0 (Redesigned Inscription Spec)