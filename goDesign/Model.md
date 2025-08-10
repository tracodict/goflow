# Petri Net Workflow Data Store: MongoDB and go-memdb Implementation

## Overview

This design outlines the use of both MongoDB time series collections and go-memdb to implement a Petri net workflow data store. The system will support storing JSON definitions of workflows, recording CRUD operations on cases, tokens, and workitems, and efficiently querying the latest states of workflows. It also provides the ability to switch between MongoDB and go-memdb as the backend storage.

## Data Models

\`\`\`go
type Workflow struct {
    ID          string    `bson:"_id,omitempty" memdb:"id"`
    WorkflowID  string    `bson:"workflowId" memdb:"workflow_id"`
    Version     int       `bson:"version" memdb:"version"`
    Name        string    `bson:"name" memdb:"name"`
    Description string    `bson:"description" memdb:"description"`
    IsValid     bool      `bson:"isValid" memdb:"is_valid"`
    CreatorID   string    `bson:"creatorId" memdb:"creator_id"`
    ErrorMsg    string    `bson:"errorMsg" memdb:"error_msg"`
    Definition  string    `bson:"definition" memdb:"definition"` // JSON string
    CreatedAt   time.Time `bson:"createdAt" memdb:"created_at"`
    UpdatedAt   time.Time `bson:"updatedAt" memdb:"updated_at"`
}

type TimeSeriesEvent struct {
    ID        string      `bson:"_id,omitempty" memdb:"id"`
    Metadata  interface{} `bson:"metadata" memdb:"metadata"`
    Timestamp time.Time   `bson:"timestamp" memdb:"timestamp"`
    Operation string      `bson:"operation" memdb:"operation"`
    Data      string      `bson:"data" memdb:"data"` // JSON string
}

type Form struct {
    ID          string    `bson:"_id,omitempty" memdb:"id"`
    FormID      string    `bson:"formId" memdb:"form_id"`
    Name        string    `bson:"name" memdb:"name"`
    Description string    `bson:"description" memdb:"description"`
    Fields      string    `bson:"fields" memdb:"fields"` // JSON string
    CreatedAt   time.Time `bson:"createdAt" memdb:"created_at"`
    UpdatedAt   time.Time `bson:"updatedAt" memdb:"updated_at"`
}

type Transition struct {
    ID                   string    `bson:"_id,omitempty" memdb:"id"`
    TransitionID         string    `bson:"transitionId" memdb:"transition_id"`
    WorkflowID           string    `bson:"workflowId" memdb:"workflow_id"`
    Name                 string    `bson:"name" memdb:"name"`
    Description          string    `bson:"description" memdb:"description"`
    SortOrder            int       `bson:"sortOrder" memdb:"sort_order"`
    TriggerLimit         int       `bson:"triggerLimit" memdb:"trigger_limit"`
    TriggerType          string    `bson:"triggerType" memdb:"trigger_type"`
    FormID               string    `bson:"formId" memdb:"form_id"`
    FormType             string    `bson:"formType" memdb:"form_type"`
    EnableCallback       string    `bson:"enableCallback" memdb:"enable_callback"`
    FireCallback         string    `bson:"fireCallback" memdb:"fire_callback"`
    NotificationCallback string    `bson:"notificationCallback" memdb:"notification_callback"`
    TimeCallback         string    `bson:"timeCallback" memdb:"time_callback"`
    DeadlineCallback     string    `bson:"deadlineCallback" memdb:"deadline_callback"`
    HoldTimeoutCallback  string    `bson:"holdTimeoutCallback" memdb:"hold_timeout_callback"`
    AssignmentCallback   string    `bson:"assignmentCallback" memdb:"assignment_callback"`
    UnassignmentCallback string    `bson:"unassignmentCallback" memdb:"unassignment_callback"`
    SubWorkflowID        string    `bson:"subWorkflowId" memdb:"sub_workflow_id"`
    MultipleInstance     bool      `bson:"multipleInstance" memdb:"multiple_instance"`
    FinishCondition      string    `bson:"finishCondition" memdb:"finish_condition"`
    DynamicAssignByID    string    `bson:"dynamicAssignById" memdb:"dynamic_assign_by_id"`
    CreatedAt            time.Time `bson:"createdAt" memdb:"created_at"`
    UpdatedAt            time.Time `bson:"updatedAt" memdb:"updated_at"`
}
\`\`\`

## Storage Interface

\`\`\`go
type StorageEngine interface {
    StoreWorkflow(workflow Workflow) error
    GetWorkflow(workflowID string, version int) (Workflow, error)
    StoreEvent(collectionName string, event TimeSeriesEvent) error
    GetLatestState(collectionName, entityID string) (TimeSeriesEvent, error)
    StoreForm(form Form) error
    GetForm(formID string) (Form, error)
    StoreTransition(transition Transition) error
    GetTransition(transitionID string) (Transition, error)
}
\`\`\`

## MongoDB Implementation

\`\`\`go
type MongoDBStorage struct {
    client             *mongo.Client
    db                 *mongo.Database
    workflowCollection *mongo.Collection
    casesCollection    *mongo.Collection
    tokensCollection   *mongo.Collection
    workitemsCollection *mongo.Collection
    entriesCollection  *mongo.Collection
    formsCollection    *mongo.Collection
    transitionsCollection *mongo.Collection
}

func NewMongoDBStorage(connectionString, dbName string) (*MongoDBStorage, error) {
    // Initialize MongoDB client and collections
    // ...
}

// Implement StorageEngine interface methods
// ...
\`\`\`

## go-memdb Implementation

\`\`\`go
type MemDBStorage struct {
    db *memdb.MemDB
}

func NewMemDBStorage() (*MemDBStorage, error) {
    schema := &memdb.DBSchema{
        Tables: map[string]*memdb.TableSchema{
            "workflows": {
                Name: "workflows",
                Indexes: map[string]*memdb.IndexSchema{
                    "id": {
                        Name:    "id",
                        Unique:  true,
                        Indexer: &memdb.StringFieldIndex{Field: "ID"},
                    },
                    "workflow_id": {
                        Name:    "workflow_id",
                        Unique:  false,
                        Indexer: &memdb.StringFieldIndex{Field: "WorkflowID"},
                    },
                    // Add more indexes as needed
                },
            },
            "events": {
                Name: "events",
                Indexes: map[string]*memdb.IndexSchema{
                    "id": {
                        Name:    "id",
                        Unique:  true,
                        Indexer: &memdb.StringFieldIndex{Field: "ID"},
                    },
                    "timestamp": {
                        Name:    "timestamp",
                        Unique:  false,
                        Indexer: &memdb.TimeFieldIndex{Field: "Timestamp"},
                    },
                    // Add more indexes as needed
                },
            },
            // Define schemas for forms and transitions
        },
    }

    db, err := memdb.NewMemDB(schema)
    if err != nil {
        return nil, err
    }

    return &MemDBStorage{db: db}, nil
}

// Implement StorageEngine interface methods
// ...
\`\`\`

## Storage Factory

\`\`\`go
type StorageFactory struct{}

func (f *StorageFactory) GetStorage(storageType string) (StorageEngine, error) {
    switch storageType {
    case "mongodb":
        return NewMongoDBStorage("mongodb://localhost:27017", "workflow_db")
    case "memdb":
        return NewMemDBStorage()
    default:
        return nil, fmt.Errorf("unsupported storage type: %s", storageType)
    }
}
\`\`\`

## Usage Example

\`\`\`go
func main() {
    factory := &StorageFactory{}

    // Choose storage type based on configuration or environment variable
    storageType := os.Getenv("STORAGE_TYPE")
    if storageType == "" {
        storageType = "mongodb" // Default to MongoDB
    }

    storage, err := factory.GetStorage(storageType)
    if err != nil {
        log.Fatal(err)
    }

    // Store workflow definition
    workflow := Workflow{
        WorkflowID:  "workflow1",
        Version:     1,
        Name:        "Sample Workflow",
        Description: "A sample workflow for demonstration",
        IsValid:     true,
        CreatorID:   "user123",
        Definition:  `{"nodes": [...], "edges": [...]}`, // JSON string
        CreatedAt:   time.Now(),
        UpdatedAt:   time.Now(),
    }
    err = storage.StoreWorkflow(workflow)
    if err != nil {
        log.Fatal(err)
    }

    // Store case event
    caseEvent := TimeSeriesEvent{
        Metadata: map[string]interface{}{
            "caseId":     "case1",
            "workflowId": "workflow1",
            "status":     "ACTIVE",
        },
        Timestamp: time.Now(),
        Operation: "CREATE",
        Data:      `{"key": "value"}`, // JSON string
    }
    err = storage.StoreEvent("cases", caseEvent)
    if err != nil {
        log.Fatal(err)
    }

    // Query latest state
    latestState, err := storage.GetLatestState("cases", "case1")
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Latest state: %+v\n", latestState)
}
\`\`\`

This design provides a flexible and efficient solution for storing and querying Petri net workflow data using either MongoDB's time series collections or go-memdb as the backend storage. It supports the storage of workflow definitions, recording of CRUD operations, and efficient querying of the latest states. The ability to switch between storage backends allows for easy development, testing, and deployment in various environments.

Key changes and additions:

1. Updated data models to work with both MongoDB and go-memdb.
2. Introduced a common `StorageEngine` interface.
3. Implemented MongoDB and go-memdb storage engines.
4. Added a `StorageFactory` to create the appropriate storage engine.
5. Updated the usage example to demonstrate how to switch between storage backends.

This design allows for easy switching between MongoDB and go-memdb, providing flexibility for different use cases and environments.
