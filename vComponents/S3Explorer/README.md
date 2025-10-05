# S3Explorer Component (GCS FileStore Integration)

The S3Explorer component has been revamped to work with the new FileStore API for GCS (Google Cloud Storage) queries. It supports both saved query execution and ad-hoc folder queries.

## Features

- **FileStore API Integration**: Uses the new `/api/queries/:id/run` and `/api/query/execute` endpoints
- **Dual Query Modes**: Supports both saved queries and direct datasource queries  
- **Interactive Navigation**: Click folders to navigate, parent folder navigation
- **File Type Support**: Displays file icons, sizes, extensions, and modification dates
- **Event System**: Full script integration support for PageBuilder
- **Responsive UI**: Modern interface with loading states and error handling

## Usage Examples

### 1. Using Saved Query (Recommended)

```tsx
<S3Explorer
  queryId="gcs-query-123"
  initialPath="/documents/"
  recursive={true}
  showHidden={false}
  maxFileSize={10485760}
  allowedExtensions={[".pdf", ".txt", ".json", ".md"]}
/>
```

### 2. Using Direct Datasource (Legacy)

```tsx
<S3Explorer
  datasourceId="gcs-datasource-456"
  initialPath="/uploads/"
  recursive={true}
  showHidden={false}
/>
```

### 3. PageBuilder Integration

```html
<div data-component="s3-explorer"
     data-query-id="my-gcs-query"
     data-initial-path="/folder/"
     data-recursive="true"
     data-max-file-size="5242880"
     data-allowed-extensions=".pdf,.txt,.json"
     data-script-file-select="console.log('File selected:', payload.fileName)">
</div>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `queryId` | `string` | - | ID of saved query to execute (recommended) |
| `datasourceId` | `string` | - | Direct datasource ID (legacy compatibility) |
| `initialPath` | `string` | `"/"` | Starting folder path |
| `recursive` | `boolean` | `true` | Include subfolders in listing |
| `showHidden` | `boolean` | `false` | Show hidden files/folders |
| `maxFileSize` | `number` | `10485760` | Maximum file size filter (bytes) |
| `allowedExtensions` | `string[]` | `[".md", ".txt", ...]` | File extension whitelist |

## Events

The component emits these events for script integration:

- `fileSelect`: User clicks a file
- `folderToggle`: User navigates into a folder  
- `error`: Query execution fails
- `mount`/`unmount`: Component lifecycle

## API Integration

The component uses these FileStore API endpoints:

1. **Saved Query Execution**: `POST /api/queries/:id/run`
   ```json
   {
     "params": {
       "folderPath": "/documents/",
       "recursive": true,
       "includeMetadata": true
     }
   }
   ```

2. **Ad-hoc Query Execution**: `POST /api/query/execute`
   ```json
   {
     "ast": {
       "type": "folder",
       "datasourceId": "gcs-ds-123",
       "parameters": {
         "folderPath": "/uploads/",
         "recursive": true,
         "maxFileSize": 10485760,
         "allowedExtensions": [".pdf", ".txt"]
       }
     },
     "params": { "folderPath": "/uploads/" }
   }
   ```

## Migration from Old S3Explorer

1. **Update Query Setup**: Create saved queries in the Data tab instead of direct datasource references
2. **Update Props**: Replace `datasourceId` with `queryId` for new queries
3. **Test Integration**: Verify FileStore API endpoints are working with your GCS configuration

## Configuration Requirements

1. **System Settings**: Ensure `flowServiceUrl` is configured in system settings
2. **GCS Datasource**: Set up GCS datasource with proper credentials and bucket configuration  
3. **Query Definition**: Create folder-type queries with appropriate parameters and filters
4. **Server Setup**: Ensure FileStore API endpoints are available and GCS integration is working

## Troubleshooting

- **Empty Results**: Check GCS credentials and bucket permissions
- **API Errors**: Verify `flowServiceUrl` and server connectivity
- **Mock Data**: If seeing placeholder results, server-side query execution may not be fully implemented
- **Permission Issues**: Ensure GCS service account has appropriate bucket access

The revamped S3Explorer provides a modern, efficient way to browse GCS storage with full integration into the FileStore API architecture.