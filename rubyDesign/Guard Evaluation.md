# Guard Evaluation

Guard Evaluation is a crucial component of the Petri Flow Engine, responsible for evaluating conditions for transitions and arcs in the Petri net structure. This document outlines the main APIs exposed by Guard Evaluation, illustrates the sequence of operations triggered by these APIs, and describes the data schema used.

## Exposed APIs

1. `evaluate_transition_guard(transition_id, case_data)`
   - Evaluates the guard condition for a specific transition using the current case data.

2. `evaluate_arc_guard(arc_id, token_data)`
   - Evaluates the guard condition for a specific arc using the token data.

3. `register_custom_function(function_name, function_implementation)`
   - Registers a custom function that can be used in guard expressions.

4. `update_guard_expression(element_id, new_expression)`
   - Updates the guard expression for a transition or arc.

5. `get_enabled_transitions(case_id)`
   - Retrieves all transitions that are currently enabled for a given case.

## Sequence Diagram

```mermaid
sequenceDiagram
    participant WE as Workflow Engine
    participant GE as Guard Evaluation
    participant CM as Case Management
    participant TM as Token Management
    participant M as Model

    WE->>GE: evaluate_transition_guard(transition_id, case_data)
    GE->>M: get_transition_guard(transition_id)
    M-->>GE: guard_expression
    GE->>GE: evaluate_expression(guard_expression, case_data)
    GE-->>WE: evaluation_result

    WE->>GE: evaluate_arc_guard(arc_id, token_data)
    GE->>M: get_arc_guard(arc_id)
    M-->>GE: guard_expression
    GE->>GE: evaluate_expression(guard_expression, token_data)
    GE-->>WE: evaluation_result

    WE->>GE: register_custom_function(function_name, function_implementation)
    GE->>GE: store_custom_function(function_name, function_implementation)
    GE-->>WE: registration_result

    WE->>GE: update_guard_expression(element_id, new_expression)
    GE->>M: update_guard(element_id, new_expression)
    M-->>GE: update_result
    GE-->>WE: update_confirmation

    WE->>GE: get_enabled_transitions(case_id)
    GE->>CM: get_case_data(case_id)
    CM-->>GE: case_data
    GE->>TM: get_case_tokens(case_id)
    TM-->>GE: token_data
    GE->>M: get_case_transitions(case_id)
    M-->>GE: transitions
    GE->>GE: evaluate_transitions(transitions, case_data, token_data)
    GE-->>WE: enabled_transitions
```

## Entity Diagram

```mermaid
erDiagram
    WORKFLOW ||--|{ TRANSITION : "contains"
    WORKFLOW ||--|{ ARC : "contains"
    TRANSITION ||--o{ GUARD : "has"
    ARC ||--o{ GUARD : "has"
    CASE ||--|{ CASE_DATA : "has"
    CASE ||--|{ TOKEN : "contains"

    WORKFLOW {
        int id
        string name
        json definition
        datetime created_at
        datetime updated_at
    }

    TRANSITION {
        int id
        int workflow_id
        string name
        datetime created_at
        datetime updated_at
    }

    ARC {
        int id
        int workflow_id
        int source_id
        int target_id
        string arc_type
        datetime created_at
        datetime updated_at
    }

    GUARD {
        int id
        int element_id
        string element_type
        text expression
        datetime created_at
        datetime updated_at
    }

    CASE {
        int id
        int workflow_id
        string status
        datetime created_at
        datetime updated_at
    }

    CASE_DATA {
        int id
        int case_id
        string key
        json value
        datetime created_at
        datetime updated_at
    }

    TOKEN {
        int id
        int case_id
        int place_id
        json data
        datetime created_at
        datetime updated_at
    }
```

This entity diagram represents the core data schema used by the Guard Evaluation component:

- WORKFLOW: Represents the overall workflow definition.
- TRANSITION: Represents transitions in the Petri net.
- ARC: Represents arcs connecting places and transitions.
- GUARD: Stores guard expressions for transitions and arcs.
- CASE: Represents an instance of a workflow.
- CASE_DATA: Stores data associated with a specific case.
- TOKEN: Represents individual tokens within a case.

The relationships between these entities are as follows:
- A WORKFLOW contains multiple TRANSITIONs and ARCs.
- TRANSITIONs and ARCs can have GUARDs.
- A CASE is associated with a WORKFLOW and contains CASE_DATA and TOKENs.

This schema allows for efficient storage and retrieval of guard expressions, as well as the necessary data to evaluate these guards in the context of specific cases and tokens. The Guard Evaluation component can use this structure to perform its core functions of evaluating transition and arc guards, managing custom functions, and determining enabled transitions for workflow execution.
