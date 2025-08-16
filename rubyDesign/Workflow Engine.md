# Workflow Engine

The Workflow Engine is a core component of the Petri Flow system, responsible for managing the overall workflow process. This document outlines the main APIs exposed by the Workflow Engine and illustrates the sequence of operations triggered by these APIs.

## Exposed APIs

1. `create_workflow(definition)`
   - Creates a new workflow based on the provided definition.

2. `start_case(workflow_id, initial_data)`
   - Starts a new case for a given workflow with initial data.

3. `execute_transition(case_id, transition_id, data)`
   - Executes a specific transition for a given case.

4. `get_case_status(case_id)`
   - Retrieves the current status of a case.

5. `get_enabled_transitions(case_id)`
   - Returns a list of currently enabled transitions for a case.

6. `update_case_data(case_id, data)`
   - Updates the data associated with a case.

## Sequence Diagrams

### Creating and Starting a Workflow

```mermaid
sequenceDiagram
    participant C as Controller
    participant WE as Workflow Engine
    participant CM as Case Management
    participant TM as Token Management
    participant GE as Guard Evaluation
    participant M as Model

    C->>WE: create_workflow(definition)
    WE->>M: save_workflow(definition)
    M-->>WE: workflow_id
    WE-->>C: workflow_id

    C->>WE: start_case(workflow_id, initial_data)
    WE->>CM: create_case(workflow_id, initial_data)
    CM->>TM: create_initial_tokens()
    TM->>M: save_tokens()
    CM->>M: save_case()
    CM-->>WE: case_id
    WE-->>C: case_id
```

### Executing a Transition

```mermaid
sequenceDiagram
    participant C as Controller
    participant WE as Workflow Engine
    participant CM as Case Management
    participant TM as Token Management
    participant GE as Guard Evaluation
    participant M as Model

    C->>WE: execute_transition(case_id, transition_id, data)
    WE->>CM: get_case(case_id)
    CM-->>WE: case
    WE->>GE: evaluate_guards(case, transition_id)
    GE-->>WE: is_enabled
    alt is_enabled
        WE->>TM: consume_input_tokens(case, transition_id)
        TM->>M: update_tokens()
        WE->>TM: produce_output_tokens(case, transition_id)
        TM->>M: save_new_tokens()
        WE->>CM: update_case_status(case_id)
        CM->>M: save_case()
        WE-->>C: success
    else not enabled
        WE-->>C: error (transition not enabled)
    end
```

These sequence diagrams illustrate the main interactions between the Workflow Engine and other components of the Petri Flow system when creating a workflow, starting a case, and executing a transition. The Workflow Engine coordinates with Case Management, Token Management, and Guard Evaluation to ensure proper execution of the workflow process.

The APIs and sequences presented here provide a high-level overview of the Workflow Engine's functionality. Actual implementation may include additional error handling, logging, and more complex interactions depending on the specific requirements of the Petri Flow system.
