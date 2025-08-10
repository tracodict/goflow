# Component Views

## Ruby's Component Description

### Rails Application
The core of the Petri Flow system, built on Ruby on Rails.

1. Controllers: Handle incoming requests and manage the flow of data.
2. Models: Represent data structures and business logic.
3. Views: Present data to users and handle user interface.
5. Helpers: Provide utility functions for views.
6. Jobs: Handle background processing tasks.

### Petri Flow Engine

The core workflow engine implementing Petri net concepts.


1. Workflow Engine: Manages the overall workflow process.
2. Case Management: Handles individual workflow instances (cases).
2. Token Management: Manages tokens within the Petri net structure.
4. Guard Evaluation: Evaluates conditions for transitions and arcs.

### External Systems:

1. Database: Stores all persistent data for the application.
2. User System: Manages user authentication and authorization.
3. Organizational Structure: Integrates with external systems for roles, groups, positions, or departments.

### Key Interactions
The Controllers interact with Models to retrieve and persist data, and with Views to present information to users.
The Workflow Engine is central to the Petri Flow system, interacting with various components of the Rails application.
Case Management, Token Management, and Guard Evaluation components interact with Models to persist and retrieve workflow-related data.
Jobs can interact with the Workflow Engine for background processing of workflow-related tasks.
The system integrates with external User Systems and Organizational Structures for authentication and role management.
This component diagram provides a high-level overview of the Petri Flow system's architecture, showing the main components and their interactions. It demonstrates how the Petri net concepts are implemented within a Ruby on Rails framework, and how the system integrates with external components for user and organizational management.
\`\`\`mermaid
graph TB
    subgraph Rails Application
        Controller[Controllers]
        Model[Models]
        View[Views]
        Helper[Helpers]
        Job[Jobs]
    end

    subgraph Petri Flow Engine
        Workflow[Workflow Engine]
        CaseManagement[Case Management]
        TokenManagement[Token Management]
        GuardEvaluation[Guard Evaluation]
    end

    subgraph External Systems
        Database[(Database)]
        UserSystem[User System]
        OrgStructure[Organizational Structure]
    end

    Controller --> Model
    Controller --> View
    Model --> Database
    View --> Helper
    Controller --> Workflow
    Workflow --> CaseManagement
    Workflow --> TokenManagement
    Workflow --> GuardEvaluation
    CaseManagement --> Model
    TokenManagement --> Model
    GuardEvaluation --> Model
    Job --> Workflow
    UserSystem --> Controller
    OrgStructure --> Controller
\`\`\`
