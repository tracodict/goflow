# Design Prompts

## Reverse Engineering

### ER Diagram

Read docs at @/README.md  and those markdown in @/doc/petri-flow, then scan the project of ruby rail implementation to generate ER diagram using mermaid @/doc/design/PetriWorkflow\ ER.md to depict relationships among:
1. workflow
2. place
3. transition
4. arc (link place and transition)
5. token
6. case 
7. workitem/task

### Component Diagram

Read docs at @/README.md  and those markdown in @/doc/petri-flow, then scan the project of ruby rail implementation to generate component diagram using mermaid. Write the diagram and description markdown to @/doc/design/Component.md 

### Controller

Based on @/doc/design/Component.md, scan controllers implementation codes. List APIs exposed by controllers. Draw mermaid sequence diagram to depict the sequence triggered from main APIs. Write the generated markdown documents to @/doc/design/Controller.md

### Model

1. Based on @/doc/design/Component.md, scan Models implementation codes. List Models defined and their detailed schema. Write the generated markdown documents to @/doc/design/Model.md
2. Generate markdown doc for Workflow/Case/Token's `t.jsonb :data` part, to describe schema for the json data. Make the markdown single code block to copy.

### Views

Based on @/doc/design/Component.md, scan Views implementation codes. List Views defined and their detailed schema. Write the generated markdown documents to @/doc/design/Views.md

### Workflow Engine

Based on @/doc/design/Component.md, scan Component of `Workflow Engine` implementation codes. List APIs exposed by `Workflow Engine`. Draw mermaid sequence diagram to depict the sequence triggered from main APIs. Write the generated markdown documents to `@/doc/design/Workflow Engine.md`

### Case Management

Based on @/doc/design/Component.md, scan Component of `Case Management` implementation codes. List APIs exposed by `Case Management`. Draw mermaid sequence diagram to depict the sequence triggered from main APIs. Draw Entity diagram to describe data schema used. Generate all above document in a single markdown code block to be copied in one shot.

### Token Management

Based on @/doc/design/Component.md, scan Component of `Token Management` implementation codes. List APIs exposed by `Token Management`. Draw mermaid sequence diagram to depict the sequence triggered from main APIs. Draw Entity diagram to describe data schema used. Generate all above document in a single markdown code block to be copied in one shot.

### Guard Evaluation

Based on @/doc/design/Component.md, scan Component of `Guard Evaluation` implementation codes. List APIs exposed by `Guard Evaluation. Draw mermaid sequence diagram to depict the sequence triggered from main APIs. Draw Entity diagram to describe data schema used. Generate all above document in a single markdown code block to be copied in one shot.

### Overall Architecture

Based on design gathered at @/doc , generate markdown document to introduce overview of petri net based workflow engine and overall architecture design. Make generated markdown into a single code block to copy

## Re-Design

### Data Store

#### Round 1
Is it a good use case for MongoDB time series petri net workflow data store mentioned in @/doc/design/ModelToBe.md  to implement functionalites:
1. Store json definition of workflows
2. Store effects of CRUD operations of cases, tokens and working items to the time series 
3. query latest states of workflow efficiently, i.e., get info of current working items, tokens and cases

If so, give detailed description and design of MongoDB and GoLang, using markdown and make the markdown generated in a code block to be copied in one shot.

#### Round 2

Update @/doc/re-design/Model.md based on database migration defined in @/db/migrate so that all required fields in current db migration design will be captured. Define exact MongoDB+GoLang based migration solution.

#### Architecture

Refer to @/doc/design/Architecture.md, as a experienced GoLang architect, re-design the architecture based on GoLang best practice. Include as many details as possible to make the design self-explained and self-contained to make execution plan for next SDLC steps. Generate the architecture design document at @/doc/re-design/Achitecture.md . Also generate the markdown in a single code block that can be copied in one shot.

#### Execution Plan

Generate execution plan to implement according to @/doc/re-design/Achitecture.md . The plan arranage implementation of components in agile method and organize the tasks into epic and user stories and test cases. The test cases would prefer to be auto unit test or automation. Also put all markdown generated in a single code block to copy.

#### Add go-memdb

Update @/doc/re-design/Achitecture.md to include go-memdb in tech stack. When MongoDB connection url is not configured, go-memdb would be used to run the whole service in a single application. Refer to @/doc/re-design/Model.md , an abstract API layer would be defined to seamless switch between MongoDB and memdb. Generate memdb based design into @/doc/re-design/Model-memdb.md . Update @/doc/re-design/Plan.md to inlude memdb based on implementation at very beginning.

## Execution

### Epic 1

1. Generate markdown design document for `Epic 1: Core Engine Implementation` at @/doc/re-design/Plan.md , make the markdown generated into a single code block to copy
2. create a golang project at @/go-petri-flow following above design, generate README.md at @/go-petri-flow


