# Token Management

Token Management is a crucial component of the Petri Flow Engine, responsible for managing tokens within the Petri net structure. This document outlines the main APIs exposed by Token Management, illustrates the sequence of operations triggered by these APIs, and describes the data schema used.

## Exposed APIs

1. `create_initial_tokens(case_id, workflow_definition)`
   - Creates initial tokens for a new case based on the workflow definition.

2. `get_tokens(case_id)`
   - Retrieves all tokens for a specific case.

3. `consume_input_tokens(case_id, transition_id)`
   - Consumes input tokens for a given transition in a case.

4. `produce_output_tokens(case_id, transition_id, data)`
   - Produces output tokens for a given transition in a case.

5. `move_token(token_id, from_place_id, to_place_id)`
   - Moves a token from one place to another within a case.

6. `update_token_data(token_id, data)`
   - Updates the data associated with a specific token.

## Sequence Diagram

\`\`\`mermaid
sequenceDiagram
    participant WE as Workflow Engine
    participant TM as Token Management
    participant CM as Case Management
    participant M as Model

    WE->>TM: create_initial_tokens(case_id, workflow_definition)
    TM->>CM: get_case(case_id)
    CM-->>TM: case_details
    TM->>M: save_tokens()
    M-->>TM: save_result
    TM-->>WE: initial_tokens

    WE->>TM: get_tokens(case_id)
    TM->>M: fetch_tokens(case_id)
    M-->>TM: tokens_data
    TM-->>WE: case_tokens

    WE->>TM: consume_input_tokens(case_id, transition_id)
    TM->>M: fetch_input_tokens(case_id, transition_id)
    M-->>TM: input_tokens
    TM->>M: remove_tokens(input_tokens)
    M-->>TM: remove_result
    TM-->>WE: consumed_tokens

    WE->>TM: produce_output_tokens(case_id, transition_id, data)
    TM->>M: create_output_tokens(case_id, transition_id, data)
    M-->>TM: create_result
    TM-->>WE: new_tokens

    WE->>TM: move_token(token_id, from_place_id, to_place_id)
    TM->>M: update_token_place(token_id, to_place_id)
    M-->>TM: update_result
    TM-->>WE: moved_token
\`\`\`

## Entity Diagram

\`\`\`mermaid
erDiagram
    CASE ||--|{ TOKEN : "contains"
    PLACE ||--o{ TOKEN : "holds"
    WORKFLOW ||--|{ PLACE : "defines"
    TRANSITION ||--o{ TOKEN : "consumes/produces"

    CASE {
        int id
        int workflow_id
        string status
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

    PLACE {
        int id
        int workflow_id
        string name
        string type
        int capacity
        datetime created_at
        datetime updated_at
    }

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
        json guard_expression
        datetime created_at
        datetime updated_at
    }
\`\`\`

This entity diagram represents the core data schema used by the Token Management component:

- CASE: Represents an instance of a workflow.
- TOKEN: Represents individual tokens within a case.
- PLACE: Represents places in the Petri net where tokens can reside.
- WORKFLOW: Represents the overall workflow definition.
- TRANSITION: Represents transitions in the Petri net that consume and produce tokens.

The relationships between these entities are as follows:
- A CASE contains multiple TOKENs.
- A PLACE can hold multiple TOKENs.
- A WORKFLOW defines multiple PLACEs and TRANSITIONs.
- TRANSITIONs consume and produce TOKENs.

This schema allows for efficient management of tokens within the Petri net structure, tracking their movements between places, and associating them with specific cases and workflows. It also provides the necessary structure to implement the token-based execution model of Petri nets within the Workflow Engine.
