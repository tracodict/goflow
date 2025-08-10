# Case Management

Case Management is a crucial component of the Petri Flow Engine, responsible for handling individual workflow instances (cases). This document outlines the main APIs exposed by Case Management, illustrates the sequence of operations triggered by these APIs, and describes the data schema used.

## Exposed APIs

1. `create_case(workflow_id, initial_data)`
   - Creates a new case for a given workflow with initial data.

2. `get_case(case_id)`
   - Retrieves the details of a specific case.

3. `update_case_status(case_id, status)`
   - Updates the status of a case.

4. `update_case_data(case_id, data)`
   - Updates the data associated with a case.

5. `list_cases(workflow_id, filters)`
   - Lists cases for a given workflow, with optional filters.

6. `archive_case(case_id)`
   - Archives a completed or terminated case.

## Sequence Diagram

\`\`\`mermaid
sequenceDiagram
    participant C as Controller
    participant CM as Case Management
    participant WE as Workflow Engine
    participant TM as Token Management
    participant M as Model

    C->>CM: create_case(workflow_id, initial_data)
    CM->>WE: validate_workflow(workflow_id)
    WE-->>CM: validation_result
    CM->>TM: create_initial_tokens()
    TM->>M: save_tokens()
    CM->>M: save_case()
    CM-->>C: case_id

    C->>CM: get_case(case_id)
    CM->>M: fetch_case(case_id)
    M-->>CM: case_data
    CM-->>C: case_details

    C->>CM: update_case_status(case_id, status)
    CM->>M: update_case(case_id, status)
    M-->>CM: update_result
    CM-->>C: success/failure

    C->>CM: list_cases(workflow_id, filters)
    CM->>M: query_cases(workflow_id, filters)
    M-->>CM: matching_cases
    CM-->>C: case_list
\`\`\`

## Entity Diagram

\`\`\`mermaid
erDiagram
    WORKFLOW ||--o{ CASE : "has many"
    CASE ||--|{ TOKEN : "contains"
    CASE ||--o{ CASE_DATA : "has"
    USER ||--o{ CASE : "initiates"

    WORKFLOW {
        int id
        string name
        json definition
        datetime created_at
        datetime updated_at
    }

    CASE {
        int id
        int workflow_id
        int user_id
        string status
        datetime created_at
        datetime updated_at
        datetime archived_at
    }

    TOKEN {
        int id
        int case_id
        int place_id
        json data
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

    USER {
        int id
        string name
        string email
        datetime created_at
        datetime updated_at
    }
\`\`\`

This entity diagram represents the core data schema used by the Case Management component:

- WORKFLOW: Represents the workflow definition.
- CASE: Represents an instance of a workflow (a case).
- TOKEN: Represents tokens within a case, corresponding to the Petri net concept.
- CASE_DATA: Stores additional data associated with a case.
- USER: Represents users who can initiate and interact with cases.

The relationships between these entities are as follows:
- A WORKFLOW can have multiple CASEs.
- A CASE contains multiple TOKENs.
- A CASE can have multiple CASE_DATA entries.
- A USER can initiate multiple CASEs.

This schema allows for efficient management of workflow instances, tracking of token movements, and storage of case-specific data, all while maintaining relationships with users and workflow definitions.
