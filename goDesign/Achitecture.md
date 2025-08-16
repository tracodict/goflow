Here's the updated content for 'doc/re-design/Architecture.md' with go-memdb added to the tech stack and the ability to switch between go-memdb and MongoDB:

```markdown
# Petri Net-Based Workflow Engine: Simplified GoLang Architecture Design

## 1. Introduction

This document outlines a simplified architecture for a Petri net-based workflow engine implemented in GoLang. The system is designed to model, execute, and manage complex business processes using the mathematical foundations of Petri nets, leveraging GoLang's strengths in efficiency and simplicity.

## 2. System Overview

The workflow engine is built as a monolithic microservice, combining all functionalities into a single, cohesive application. This design allows for simplicity in development, deployment, and maintenance while still leveraging GoLang's concurrent programming capabilities. The system supports both in-memory storage using go-memdb and persistent storage using MongoDB, allowing for flexible deployment options.

## 3. Core Components

### 3.1 Workflow Engine

- **Purpose**: Implements core Petri net execution logic
- **Key Functions**:
  - Manage workflow states and transitions
  - Handle token movement and transition firing
  - Implement concurrency control for parallel executions
- **Key Packages**:
  - `engine/core`: Core Petri net logic
  - `engine/state`: State management
  - `engine/transition`: Transition handling

### 3.2 Workflow Definition Manager

- **Purpose**: Manage workflow definitions
- **Key Functions**:
  - Create, read, update, delete (CRUD) workflow models
  - Validate workflow definitions
  - Version control for workflow definitions
- **Key Packages**:
  - `definition/model`: Workflow model structures
  - `definition/validator`: Definition validation logic
  - `definition/version`: Version control management

### 3.3 Case Manager

- **Purpose**: Handle workflow instances (cases)
- **Key Functions**:
  - Manage case lifecycle (creation, execution, completion)
  - Handle case suspension and resumption
  - Provide case history and audit trails
- **Key Packages**:
  - `case/lifecycle`: Case lifecycle management
  - `case/history`: Case history and audit logging
  - `case/state`: Case state management

### 3.4 Workitem Manager

- **Purpose**: Manage individual tasks within workflows
- **Key Functions**:
  - Create, assign, and complete workitems
  - Handle manual and automatic task execution
  - Manage workitem deadlines and timeouts
- **Key Packages**:
  - `workitem/assignment`: Workitem assignment logic
  - `workitem/execution`: Task execution handling
  - `workitem/deadline`: Deadline management

### 3.5 User and Role Manager

- **Purpose**: Handle user authentication and authorization
- **Key Functions**:
  - Manage user accounts and authentication
  - Implement role-based access control (RBAC)
  - Handle user assignments to workitems
- **Key Packages**:
  - `user/auth`: Authentication logic
  - `user/rbac`: Role-based access control
  - `user/assignment`: User-workitem assignment

### 3.6 Form Manager

- **Purpose**: Manage dynamic forms for workflow activities
- **Key Functions**:
  - Create and manage dynamic forms
  - Associate forms with workflow activities
  - Handle form data capture and validation
- **Key Packages**:
  - `form/builder`: Dynamic form creation
  - `form/association`: Form-activity association
  - `form/validation`: Form data validation

### 3.7 API Handler

- **Purpose**: Handle API requests and responses
- **Key Functions**:
  - Process incoming HTTP requests
  - Route requests to appropriate internal components
  - Handle authentication and authorization
  - Implement rate limiting and request validation
- **Key Packages**:
  - `api/handler`: Request handling logic
  - `api/middleware`: Authentication and rate limiting middleware

### 3.8 Storage Manager

- **Purpose**: Manage data storage and retrieval
- **Key Functions**:
  - Abstract storage operations for different backends (go-memdb and MongoDB)
  - Handle data persistence and retrieval
  - Manage data migrations between storage backends
- **Key Packages**:
  - `storage/memdb`: go-memdb storage implementation
  - `storage/mongodb`: MongoDB storage implementation
  - `storage/interface`: Common interface for storage operations

## 4. Data Storage

### 4.1 go-memdb (In-Memory Database)

- **Purpose**: Provide fast, in-memory storage for development and small-scale deployments
- **Key Features**:
  - ACID transactions with snapshot isolation
  - Rich query language
  - Indexes for efficient querying

### 4.2 MongoDB Time Series Collections

- **Purpose**: Store all data for workflow execution and management in production environments
- **Collections**:
  - Workflows
  - Cases
  - Tokens
  - Workitems
  - Users
  - Forms
  - Entries (form data)

## 5. Communication

- RESTful APIs for external integrations
- Internal communication via function calls within the monolith

## 6. Key Features

1. **Concurrent Execution**: Leverage GoLang's goroutines for parallel processing of workflows
2. **Event-Driven Architecture**: Use channels for internal communication between components
3. **Simplified Deployment**: Single binary deployment for the entire application
4. **Observability**: Implement logging and metrics collection within the monolith
5. **Resilience**: Implement retries and circuit breakers for database operations
6. **Flexible Storage**: Support both in-memory (go-memdb) and persistent (MongoDB) storage options

## 7. Technology Stack

- **Language**: Go 1.16+
- **In-Memory Database**: go-memdb
- **Persistent Database**: MongoDB for production data storage, including time-series data
- **API**: Built-in Go HTTP server for RESTful APIs

## 8. Code Structure

```bash
/cmd
  /server
/internal
  /engine
  /definition
  /case
  /workitem
  /user
  /form
  /api
  /storage
    /memdb
    /mongodb
    /interface
/pkg
  /model
  /database
  /logger
  /metrics
  /config
/scripts
/test
  /unit
  /integration
/docs
```

## 9. Deployment

- Build and deploy as a single binary
- Use environment variables for configuration, including storage backend selection

## 10. Observability

- **Logging**: Use structured logging with Go's built-in log package or a simple logging library
- **Metrics**: Implement basic metrics collection using a lightweight library or custom implementation

## 11. Security Considerations

- Implement JWT for user authentication
- Use HTTPS for all API communications
- Implement rate limiting and input validation at the API layer
- Regular security audits and vulnerability scanning
- Ensure proper access controls for in-memory database when used

## 12. Testing Strategy

- Unit tests for individual packages
- Integration tests for component interactions
- End-to-end tests for complete workflows
- Performance testing using Go's built-in testing tools
- Separate test suites for go-memdb and MongoDB backends

## 13. Future Enhancements

- Implement event sourcing for better auditability
- Add support for dynamic workflow modifications
- Implement basic analytics for workflow performance
- Develop a migration tool for moving data between go-memdb and MongoDB

## 14. Conclusion

This simplified, monolithic GoLang-based architecture for the Petri net-based workflow engine provides an efficient and maintainable solution. By leveraging GoLang's strengths and focusing on essential features, the system can handle complex workflows while remaining easy to develop, deploy, and maintain. The addition of go-memdb as an alternative storage option provides flexibility for different deployment scenarios, from development to production environments.
