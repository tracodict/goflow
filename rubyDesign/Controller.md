# Controller APIs and Sequence Diagrams

## API Endpoints

Note: The following is a hypothetical list of API endpoints. Actual endpoints should be determined by scanning the controller implementation codes.

1. GET /workflows - List all workflows
2. POST /workflows - Create a new workflow
3. GET /workflows/:id - Get details of a specific workflow
4. PUT /workflows/:id - Update a specific workflow
5. DELETE /workflows/:id - Delete a specific workflow
6. POST /workflows/:id/start - Start a workflow instance
7. GET /cases - List all cases
8. GET /cases/:id - Get details of a specific case
9. PUT /cases/:id - Update a specific case
10. POST /cases/:id/complete - Complete a case

## Sample Sequence Diagram

The following sequence diagram illustrates the process of creating and starting a new workflow:

\`\`\`mermaid
sequenceDiagram
    participant Client
    participant WorkflowsController
    participant WorkflowEngine
    participant CaseManagement
    participant Database

    Client->>WorkflowsController: POST /workflows
    WorkflowsController->>Database: Create new workflow
    Database-->>WorkflowsController: Workflow created
    WorkflowsController-->>Client: Workflow details

    Client->>WorkflowsController: POST /workflows/:id/start
    WorkflowsController->>WorkflowEngine: Start workflow
    WorkflowEngine->>CaseManagement: Create new case
    CaseManagement->>Database: Save case
    Database-->>CaseManagement: Case saved
    CaseManagement-->>WorkflowEngine: Case created
    WorkflowEngine-->>WorkflowsController: Workflow started
    WorkflowsController-->>Client: Case details
\`\`\`

I apologize for the misunderstanding. I'll provide the content as a single copiable block as requested. Here's the markdown content for the "Data Schema for Sequence Diagram Steps" section:


## Data Schema for Sequence Diagram Steps

This section describes the hypothetical data schema for each step in the sequence diagram. Note that these are simplified examples and may not reflect the full complexity of the actual system.

1. Client -> WorkflowsController: POST /workflows
   \`\`\`json
   {
     "name": "New Workflow",
     "description": "Description of the new workflow",
     "steps": [
       {
         "name": "Step 1",
         "type": "task",
         "assignee": "user_id"
       },
       // ... more steps
     ]
   }
   \`\`\`

2. WorkflowsController -> Database: Create new workflow
   \`\`\`ruby
   Workflow.create(
     name: params[:name],
     description: params[:description],
     steps: params[:steps]
   )
   \`\`\`

3. Database -> WorkflowsController: Workflow created
   \`\`\`ruby
   workflow = Workflow.find(created_workflow_id)
   \`\`\`

4. WorkflowsController -> Client: Workflow details
   \`\`\`json
   {
     "id": 1,
     "name": "New Workflow",
     "description": "Description of the new workflow",
     "steps": [
       {
         "id": 1,
         "name": "Step 1",
         "type": "task",
         "assignee": "user_id"
       },
       // ... more steps
     ],
     "created_at": "2025-08-09T00:50:41Z",
     "updated_at": "2025-08-09T00:50:41Z"
   }
   \`\`\`

5. Client -> WorkflowsController: POST /workflows/:id/start
   \`\`\`json
   {
     "workflow_id": 1,
     "initiator": "user_id"
   }
   \`\`\`

6. WorkflowsController -> WorkflowEngine: Start workflow
   \`\`\`ruby
   WorkflowEngine.start_workflow(workflow_id: params[:workflow_id], initiator: params[:initiator])
   \`\`\`

7. WorkflowEngine -> CaseManagement: Create new case
   \`\`\`ruby
   CaseManagement.create_case(workflow_id: workflow_id, initiator: initiator)
   \`\`\`

8. CaseManagement -> Database: Save case
   \`\`\`ruby
   Case.create(
     workflow_id: workflow_id,
     initiator: initiator,
     status: 'active',
     current_step: 1
   )
   \`\`\`

9. Database -> CaseManagement: Case saved
   \`\`\`ruby
   case = Case.find(created_case_id)
   \`\`\`

10. CaseManagement -> WorkflowEngine: Case created
    \`\`\`ruby
    { case_id: case.id, status: case.status, current_step: case.current_step }
    \`\`\`

11. WorkflowEngine -> WorkflowsController: Workflow started
    \`\`\`ruby
    { workflow_id: workflow_id, case_id: case_id, status: 'active' }
    \`\`\`

12. WorkflowsController -> Client: Case details
    \`\`\`json
    {
      "case_id": 1,
      "workflow_id": 1,
      "status": "active",
      "current_step": 1,
      "initiator": "user_id",
      "created_at": "2025-08-09T00:50:41Z",
      "updated_at": "2025-08-09T00:50:41Z"
    }
    \`\`\`

This data schema provides a simplified view of the data being transferred at each step of the sequence diagram. In a real-world scenario, these schemas would likely be more complex and include additional fields and validations.
