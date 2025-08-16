# Models

This document describes the Models defined in the Petri Flow system and their detailed schema.

## Workflow

Represents a workflow definition.

```ruby
class Workflow < ApplicationRecord
  # Add actual schema here
  # Example:
  # t.string :name
  # t.text :description
  # t.jsonb :definition
  # t.timestamps
end
```

## Case

Represents an instance of a workflow.

```ruby
class Case < ApplicationRecord
  # Add actual schema here
  # Example:
  # t.references :workflow
  # t.string :status
  # t.jsonb :data
  # t.timestamps
end
```

## Token

Represents a token in the Petri net structure.

```ruby
class Token < ApplicationRecord
  # Add actual schema here
  # Example:
  # t.references :case
  # t.string :place
  # t.jsonb :data
  # t.timestamps
end
```

## Transition

Represents a transition in the Petri net structure.

```ruby
class Transition < ApplicationRecord
  # Add actual schema here
  # Example:
  # t.references :workflow
  # t.string :name
  # t.text :guard_expression
  # t.timestamps
end
```

## Arc

Represents an arc connecting places and transitions in the Petri net structure.

```ruby
class Arc < ApplicationRecord
  # Add actual schema here
  # Example:
  # t.references :workflow
  # t.string :source_type
  # t.integer :source_id
  # t.string :target_type
  # t.integer :target_id
  # t.timestamps
end
```

## User

Represents a user in the system.

```ruby
class User < ApplicationRecord
  # Add actual schema here
  # Example:
  # t.string :email
  # t.string :name
  # t.string :role
  # t.timestamps
end
```

## Organization

Represents an organization in the system.

```ruby
class Organization < ApplicationRecord
  # Add actual schema here
  # Example:
  # t.string :name
  # t.text :description
  # t.timestamps
end
```

# JSON Data Schemas for Workflow, Case, and Token Models

This document describes the schema for the JSON data stored in the `data` field of Workflow, Case, and Token models.

## Workflow Data Schema

The `data` field in the Workflow model typically contains the workflow definition and metadata.

```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "version": "string",
  "places": [
    {
      "id": "string",
      "name": "string",
      "type": "string",
      "initialMarking": "integer"
    }
  ],
  "transitions": [
    {
      "id": "string",
      "name": "string",
      "type": "string",
      "guard": "string"
    }
  ],
  "arcs": [
    {
      "id": "string",
      "source": "string",
      "target": "string",
      "type": "string",
      "weight": "integer"
    }
  ],
  "variables": [
    {
      "name": "string",
      "type": "string",
      "defaultValue": "any"
    }
  ],
  "metadata": {
    "createdAt": "datetime",
    "updatedAt": "datetime",
    "createdBy": "string",
    "updatedBy": "string"
  }
}
```

## Case Data Schema

The `data` field in the Case model typically contains instance-specific data and the current state of the workflow.

```json
{
  "id": "string",
  "workflowId": "string",
  "status": "string",
  "variables": {
    "variableName1": "any",
    "variableName2": "any"
  },
  "currentMarking": {
    "placeId1": "integer",
    "placeId2": "integer"
  },
  "history": [
    {
      "timestamp": "datetime",
      "action": "string",
      "details": "object"
    }
  ],
  "metadata": {
    "createdAt": "datetime",
    "updatedAt": "datetime",
    "createdBy": "string",
    "updatedBy": "string"
  }
}
```

## Token Data Schema

The `data` field in the Token model typically contains token-specific data.

```json
{
  "id": "string",
  "caseId": "string",
  "placeId": "string",
  "color": "string",
  "payload": {
    "key1": "any",
    "key2": "any"
  },
  "metadata": {
    "createdAt": "datetime",
    "updatedAt": "datetime"
  }
}
```
