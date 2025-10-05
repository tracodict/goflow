# File Store API Documentation

This document describes the comprehensive file management and data source APIs implemented in Go Petri Flow. The system provides both low-level file tools for workflow integration and high-level REST APIs for direct client access.

## Overview

The Go Petri Flow file management system consists of three main components:

1. **File Management Tools** - Low-level tools integrated with the Eino architecture for workflow operations
2. **File Management REST APIs** - High-level HTTP endpoints for direct file operations
3. **Data Source & Query APIs** - Configuration and management of external data sources

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   REST APIs     │    │   Internal Tools │    │  Storage Layer  │
│                 │    │                  │    │                 │
│ • File Ops      │────│ • FileUploadTool │────│ • GCS           │
│ • Data Sources  │    │ • FileDownloadTool│   │ • S3            │
│ • Queries       │    │ • FileSearchTool │    │ • Local FS      │
│ • DS-File Ops   │    │ • FileMoveTool   │    │ • MongoDB       │
└─────────────────┘    │ • FileDeleteTool │    └─────────────────┘
                       └──────────────────┘
                                │
                       ┌──────────────────┐
                       │ File-DataSource  │
                       │   Relationships  │
                       │                  │
                       │ • File → DS      │
                       │ • File → Query   │
                       │ • Validation     │
                       └──────────────────┘
```

### Key Relationships

- **Files ↔ Data Sources**: Files can be associated with specific data sources, indicating their origin or intended storage location
- **Files ↔ Queries**: Files can be linked to query definitions that created or retrieved them
- **Validation**: All file operations validate datasource and query references to ensure data integrity

## File Management Tools (Internal)

### Available Tools

The following file management tools are available for workflow integration:

#### 1. FileDownloadTool
Downloads and inspects file content by file ID.

**Configuration:**
```json
{
  "name": "file_download",
  "config": {"tool_name": "download_report"}
}
```

**Parameters:**
- `file_id` (string, required): Unique identifier of the file
- `include_content` (boolean): Whether to include file content in response
- `max_content_size` (integer): Maximum content size to include (default: 1MB)

**Response:**
```json
{
  "file_id": "file_123",
  "name": "report.pdf",
  "size": 1024,
  "content_type": "application/pdf",
  "checksum": "sha256:...",
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T00:00:00Z",
  "tags": ["report", "monthly"],
  "properties": {"source": "system"},
  "content": "base64-encoded-content",
  "content_encoding": "base64"
}
```

#### 2. FileUploadTool
Uploads file content with metadata and tags.

**Configuration:**
```json
{
  "name": "file_upload",
  "config": {"tool_name": "save_processed_file"}
}
```

**Parameters:**
- `content` (string, required): File content (text or base64-encoded binary)
- `filename` (string, required): Name of the file
- `content_type` (string, required): MIME type of the file
- `content_encoding` (string): "text" or "base64" for binary content
- `tags` (array): List of tags for categorization
- `properties` (object): Additional metadata key-value pairs

**Response:**
```json
{
  "file_id": "file_456",
  "name": "processed_data.json",
  "size": 2048,
  "content_type": "application/json",
  "storage_path": "files/processed_data.json",
  "created_at": "2025-01-01T00:00:00Z"
}
```

#### 3. FileSearchTool
Searches files by query, tags, content type, and other criteria.

**Configuration:**
```json
{
  "name": "file_search",
  "config": {"tool_name": "find_documents"}
}
```

**Parameters:**
- `query` (string): Text search query
- `tags` (array): Filter by tags
- `content_type` (string): Filter by MIME type
- `limit` (integer): Maximum number of results (default: 50)

**Response:**
```json
{
  "results": [
    {
      "file_id": "file_789",
      "name": "document.pdf",
      "size": 5120,
      "content_type": "application/pdf",
      "tags": ["document", "important"],
      "created_at": "2025-01-01T00:00:00Z"
    }
  ],
  "total_count": 1
}
```

#### 4. FileMoveTool
Moves file to new location by file ID.

**Parameters:**
- `file_id` (string, required): File to move
- `destination_path` (string, required): New file path

#### 5. FileDeleteTool
Deletes file by file ID.

**Parameters:**
- `file_id` (string, required): File to delete

### Tool Usage in Workflows

```go
// Example workflow transition using file tools
func ProcessDocuments(ctx context.Context, tools map[string]tool.InvokableTool) error {
    // 1. Search for input files
    searchTool := tools["file_search"]
    searchArgs := `{"tags": ["input", "pending"], "limit": 10}`
    searchResult, err := searchTool.InvokableRun(ctx, searchArgs)
    
    // 2. Download and process each file
    downloadTool := tools["file_download"]
    uploadTool := tools["file_upload"]
    
    // Process files...
    
    return nil
}
```

## File Management REST APIs

### Base URL
All file management endpoints are prefixed with `/api/files`

### Authentication
All endpoints require authentication via the standard Go Petri Flow auth middleware.

### Endpoints

#### Upload File
Upload a new file with metadata.

**Request:**
```http
POST /api/files/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>

file: <binary file data>
tags: "document,important"
properties: {"source": "web_upload", "category": "reports"}
datasource_id: "ds_gcs_123456789_123456"
query_id: "query_gcs_123456789_123456"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "file_123",
    "name": "report.pdf",
    "size": 1048576,
    "content_type": "application/pdf",
    "storage_path": "files/report.pdf",
    "tags": ["document", "important"],
    "properties": {"source": "web_upload", "category": "reports"},
    "datasource_id": "ds_gcs_123456789_123456",
    "query_id": "query_gcs_123456789_123456",
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  },
  "message": "File uploaded successfully"
}
```

#### Get File Information
Retrieve file metadata and optionally content.

**Request:**
```http
GET /api/files/{fileId}?include_content=true&max_size=1048576
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "file_123",
    "name": "report.pdf",
    "size": 1048576,
    "content_type": "application/pdf",
    "tags": ["document", "important"],
    "properties": {"source": "web_upload"},
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z",
    "content": "Binary content (1048576 bytes) - use download endpoint",
    "content_encoding": "binary"
  },
  "message": "File retrieved successfully"
}
```

#### Download File
Stream file content for download.

**Request:**
```http
GET /api/files/{fileId}/download
Authorization: Bearer <token>
```

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Length: 1048576
Content-Disposition: attachment; filename="report.pdf"

<binary file content>
```

#### Search Files
Search for files based on criteria.

**Request:**
```http
POST /api/files/search
Content-Type: application/json
Authorization: Bearer <token>

{
  "query": "monthly report",
  "tags": ["document", "report"],
  "content_type": "application/pdf",
  "datasource_id": "ds_gcs_123456789_123456",
  "query_id": "query_gcs_123456789_123456",
  "min_size": 1024,
  "max_size": 10485760,
  "created_after": "2025-01-01T00:00:00Z",
  "limit": 50,
  "offset": 0
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "id": "file_123",
        "name": "monthly_report.pdf",
        "size": 2048576,
        "content_type": "application/pdf",
        "tags": ["document", "report", "monthly"],
        "created_at": "2025-01-01T00:00:00Z"
      }
    ],
    "total_count": 1,
    "limit": 50,
    "offset": 0
  },
  "message": "Search completed successfully"
}
```

#### Move File
Move a file to a new location.

**Request:**
```http
PUT /api/files/{fileId}/move
Content-Type: application/json
Authorization: Bearer <token>

{
  "destination_path": "archive/old_report.pdf"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "file_123",
    "name": "old_report.pdf",
    "storage_path": "archive/old_report.pdf",
    "updated_at": "2025-01-01T00:00:00Z"
  },
  "message": "File moved successfully"
}
```

#### Delete File
Delete a file permanently.

**Request:**
```http
DELETE /api/files/{fileId}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "file_id": "file_123"
  },
  "message": "File deleted successfully"
}
```

### Datasource-Aware File Operations

These endpoints operate within the context of specific datasources and queries, providing better organization and validation.

#### Upload File to DataSource
Upload a file directly associated with a specific datasource.

**Request:**
```http
POST /api/datasources/{datasourceId}/files/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>

file: <binary file data>
tags: "document,processed"
properties: {"processing_stage": "input", "batch_id": "batch_001"}
query_id: "query_gcs_123456789_123456"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "file_456",
    "name": "processed_document.pdf",
    "size": 2048576,
    "content_type": "application/pdf",
    "storage_path": "datasource/processed_document.pdf",
    "tags": ["document", "processed"],
    "properties": {"processing_stage": "input", "batch_id": "batch_001"},
    "datasource_id": "ds_gcs_123456789_123456",
    "query_id": "query_gcs_123456789_123456",
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  },
  "message": "File uploaded successfully to datasource"
}
```

#### List DataSource Files
List all files associated with a specific datasource.

**Request:**
```http
GET /api/datasources/{datasourceId}/files?limit=50&offset=0
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "id": "file_456",
        "name": "processed_document.pdf",
        "size": 2048576,
        "content_type": "application/pdf",
        "tags": ["document", "processed"],
        "datasource_id": "ds_gcs_123456789_123456",
        "query_id": "query_gcs_123456789_123456",
        "created_at": "2025-01-01T00:00:00Z"
      }
    ],
    "total_count": 1,
    "limit": 50,
    "offset": 0
  },
  "message": "Files retrieved successfully"
}
```

#### List Query Files
List all files associated with a specific query definition.

**Request:**
```http
GET /api/queries/{queryId}/files?limit=50&offset=0
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "id": "file_789",
        "name": "query_result.json",
        "size": 1024,
        "content_type": "application/json",
        "tags": ["result", "automated"],
        "datasource_id": "ds_gcs_123456789_123456",
        "query_id": "query_gcs_123456789_123456",
        "created_at": "2025-01-01T00:00:00Z"
      }
    ],
    "total_count": 1,
    "limit": 50,
    "offset": 0
  },
  "message": "Files retrieved successfully"
}
```

## Data Source Management APIs

Data sources represent external systems that can be queried for data (GCS, S3, databases, etc.).

### Base URL
All data source endpoints are prefixed with `/api/datasources`

### Endpoints

#### Create Data Source
Create a new data source configuration.

**Request:**
```http
POST /api/datasources
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Production GCS Bucket",
  "type": "gcs",
  "description": "Main storage bucket for production files",
  "config": {
    "bucketName": "my-production-bucket",
    "project": "my-gcp-project",
    "region": "us-central1"
  },
  "credentials": {
    "apiKey": "{\"type\":\"service_account\",...}"
  },
  "enabled": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "ds_gcs_123456789_123456",
    "name": "Production GCS Bucket",
    "type": "gcs",
    "description": "Main storage bucket for production files",
    "config": {
      "bucketName": "my-production-bucket",
      "project": "my-gcp-project",
      "region": "us-central1"
    },
    "enabled": true,
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  },
  "message": "Data source created successfully"
}
```

#### Get Data Source
Retrieve a specific data source by ID.

**Request:**
```http
GET /api/datasources/{id}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "ds_gcs_123456789_123456",
    "name": "Production GCS Bucket",
    "type": "gcs",
    "description": "Main storage bucket for production files",
    "config": {
      "bucketName": "my-production-bucket",
      "project": "my-gcp-project",
      "region": "us-central1"
    },
    "enabled": true,
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  },
  "message": "Data source retrieved successfully"
}
```

#### Update Data Source
Update an existing data source.

**Request:**
```http
PUT /api/datasources/{id}
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Updated Production GCS Bucket",
  "description": "Updated description",
  "enabled": false
}
```

#### Delete Data Source
Delete a data source.

**Request:**
```http
DELETE /api/datasources/{id}
Authorization: Bearer <token>
```

#### List Data Sources
List all data sources with optional filtering.

**Request:**
```http
GET /api/datasources?type=gcs&enabled=true&limit=50&offset=0
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "data_sources": [
      {
        "id": "ds_gcs_123456789_123456",
        "name": "Production GCS Bucket",
        "type": "gcs",
        "enabled": true,
        "created_at": "2025-01-01T00:00:00Z"
      }
    ],
    "total_count": 1,
    "limit": 50,
    "offset": 0
  },
  "message": "Data sources retrieved successfully"
}
```

#### Test Data Source
Test connectivity to a data source.

**Request:**
```http
POST /api/datasources/{id}/test
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "data_source_id": "ds_gcs_123456789_123456",
    "type": "gcs",
    "status": "success",
    "message": "Data source configuration is valid",
    "tested_at": "2025-01-01T00:00:00Z"
  },
  "message": "Data source test completed"
}
```

## Query Definition APIs

Query definitions specify how to query data sources for specific information.

### Base URL
All query endpoints are prefixed with `/api/queries`

### Endpoints

#### Create Query Definition
Create a new query definition.

**Request:**
```http
POST /api/queries
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "List Production Files",
  "description": "Query to list all files in production bucket",
  "data_source_id": "ds_gcs_123456789_123456",
  "query_type": "folder",
  "parameters": {
    "folderPath": "production/files",
    "recursive": true,
    "includeMetadata": true
  },
  "filters": {
    "maxFileSize": 10485760,
    "allowedExtensions": [".pdf", ".json", ".txt"]
  },
  "enabled": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "query_gcs_123456789_123456",
    "name": "List Production Files",
    "description": "Query to list all files in production bucket",
    "data_source_id": "ds_gcs_123456789_123456",
    "query_type": "folder",
    "parameters": {
      "folderPath": "production/files",
      "recursive": true,
      "includeMetadata": true
    },
    "filters": {
      "maxFileSize": 10485760,
      "allowedExtensions": [".pdf", ".json", ".txt"]
    },
    "enabled": true,
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  },
  "message": "Query definition created successfully"
}
```

#### Execute Query
Execute a query definition.

**Request:**
```http
POST /api/queries/{id}/execute
Content-Type: application/json
Authorization: Bearer <token>

{
  "parameters": {
    "folderPath": "production/files/2025"
  },
  "limit": 100,
  "offset": 0
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "query_id": "query_gcs_123456789_123456",
    "results": [
      {
        "id": "result_1",
        "name": "Sample Result 1",
        "type": "mock",
        "created_at": "2025-01-01T00:00:00Z"
      }
    ],
    "total_count": 1,
    "executed_at": "2025-01-01T00:00:00Z",
    "execution_ms": 150
  },
  "message": "Query executed successfully"
}
```

#### Validate Query
Validate a query definition without executing it.

**Request:**
```http
POST /api/queries/validate
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Test Query",
  "data_source_id": "ds_gcs_123456789_123456",
  "query_type": "folder",
  "parameters": {
    "folderPath": "test"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "errors": [],
    "validated_at": "2025-01-01T00:00:00Z"
  },
  "message": "Query definition is valid"
}
```

#### List Query Definitions
List all query definitions with optional filtering.

**Request:**
```http
GET /api/queries?data_source_id=ds_gcs_123456789_123456&query_type=folder&enabled=true&limit=50&offset=0
Authorization: Bearer <token>
```

## Error Handling

All APIs use consistent error response format:

```json
{
  "success": false,
  "error": {
    "code": "file_not_found",
    "message": "The specified file was not found"
  }
}
```

### Common Error Codes

#### File Management
- `missing_file` - No file provided in upload
- `file_not_found` - File ID does not exist
- `upload_failed` - File upload operation failed
- `content_read_error` - Failed to read file content
- `search_failed` - File search operation failed
- `move_failed` - File move operation failed
- `delete_failed` - File delete operation failed
- `invalid_datasource` - Referenced datasource is invalid, not found, or disabled
- `invalid_query` - Referenced query is invalid, not found, or disabled

#### Data Sources
- `missing_name` - Data source name is required
- `missing_type` - Data source type is required
- `invalid_data_source` - Referenced data source not found
- `insert_failed` - Failed to create data source
- `update_failed` - Failed to update data source
- `delete_failed` - Failed to delete data source

#### Queries
- `missing_data_source_id` - Data source ID is required
- `missing_query_type` - Query type is required
- `query_disabled` - Query definition is disabled
- `invalid_json` - Request body is not valid JSON

## Usage Examples

### Complete File Workflow

```bash
# 1. Upload a file with datasource association
curl -X POST "https://api.example.com/api/files/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@report.pdf" \
  -F "tags=report,monthly" \
  -F 'properties={"source":"api","department":"finance"}' \
  -F "datasource_id=ds_gcs_123456789_123456" \
  -F "query_id=query_gcs_123456789_123456"

# 2. Search for files with datasource filter
curl -X POST "https://api.example.com/api/files/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tags": ["report"],
    "content_type": "application/pdf",
    "datasource_id": "ds_gcs_123456789_123456",
    "limit": 10
  }'

# 3. Upload file directly to datasource
curl -X POST "https://api.example.com/api/datasources/ds_gcs_123456789_123456/files/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@processed_report.pdf" \
  -F "tags=processed,final" \
  -F "query_id=query_gcs_123456789_123456"

# 4. List all files in a datasource
curl -X GET "https://api.example.com/api/datasources/ds_gcs_123456789_123456/files?limit=20" \
  -H "Authorization: Bearer $TOKEN"

# 5. List files created by specific query
curl -X GET "https://api.example.com/api/queries/query_gcs_123456789_123456/files" \
  -H "Authorization: Bearer $TOKEN"

# 6. Download a file
curl -X GET "https://api.example.com/api/files/file_123/download" \
  -H "Authorization: Bearer $TOKEN" \
  -o downloaded_report.pdf

# 7. Move file to archive
curl -X PUT "https://api.example.com/api/files/file_123/move" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"destination_path": "archive/2025/report.pdf"}'
```

### Data Source Setup

```bash
# 1. Create GCS data source
curl -X POST "https://api.example.com/api/datasources" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Bucket",
    "type": "gcs",
    "config": {
      "bucketName": "my-bucket",
      "project": "my-project"
    },
    "credentials": {
      "apiKey": "{\"type\":\"service_account\",...}"
    },
    "enabled": true
  }'

# 2. Test data source connectivity
curl -X POST "https://api.example.com/api/datasources/ds_gcs_123/test" \
  -H "Authorization: Bearer $TOKEN"

# 3. Create query definition
curl -X POST "https://api.example.com/api/queries" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "List Recent Files",
    "data_source_id": "ds_gcs_123",
    "query_type": "folder",
    "parameters": {
      "folderPath": "recent/",
      "recursive": true
    },
    "enabled": true
  }'

# 4. Execute query
curl -X POST "https://api.example.com/api/queries/query_123/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 20}'
```

## Integration with Go Petri Flow

### Workflow Integration

File tools can be configured in CPN transition specifications:

```json
{
  "id": "process_documents",
  "name": "Process Documents",
  "tools": [
    {
      "name": "file_search",
      "config": {"tool_name": "find_input_files"}
    },
    {
      "name": "file_download", 
      "config": {"tool_name": "download_document"}
    },
    {
      "name": "file_upload",
      "config": {"tool_name": "save_result"}
    }
  ],
  "actionFunction": "processDocuments_action"
}
```

### Case Management Integration

Files can be associated with cases through properties:

```json
{
  "properties": {
    "case_id": "case_12345",
    "workflow_step": "document_review",
    "assigned_user": "user@example.com"
  }
}
```

## Security Considerations

1. **Authentication**: All endpoints require valid authentication tokens
2. **Authorization**: File access should be controlled based on user permissions
3. **Input Validation**: All inputs are validated for security and correctness
4. **File Size Limits**: Upload size limits prevent resource exhaustion
5. **Path Validation**: File paths are validated to prevent directory traversal
6. **Credential Protection**: Data source credentials are stored securely

## Configuration

### Environment Variables

- `MONGO_URI` - MongoDB connection string for data source and query persistence
- `MONGO_DB` - MongoDB database name (default: "go_petri_flow")
- `GCS_API_KEY` - Google Cloud Storage service account key (JSON)
- `AWS_ACCESS_KEY_ID` - AWS access key for S3 storage
- `AWS_SECRET_ACCESS_KEY` - AWS secret key for S3 storage

### File Manager Implementation

The system requires a FileManager implementation to be injected. Available implementations:

- **GCSFileManager** - Google Cloud Storage backend
- **S3FileManager** - Amazon S3 backend  
- **LocalFileManager** - Local filesystem backend
- **TestFileManager** - In-memory backend for testing

## Monitoring and Logging

The system provides comprehensive logging for:

- File upload/download operations
- Search queries and results
- Data source connectivity tests
- Query execution performance
- Authentication and authorization events
- Error conditions and debugging information

## Future Enhancements

Planned improvements include:

1. **Advanced Query Types** - Support for SQL-like queries, full-text search
2. **File Versioning** - Track file versions and changes over time
3. **Bulk Operations** - Upload/download multiple files in single requests
4. **Webhook Integration** - Notify external systems of file events
5. **Advanced Security** - Encryption at rest, access control lists
6. **Performance Optimization** - Caching, streaming improvements
7. **Additional Storage Backends** - Azure Storage, FTP, SFTP support
