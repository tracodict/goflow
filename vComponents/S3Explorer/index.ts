// S3Explorer vComponent exports

export { S3Explorer } from './S3Explorer'
export { PageBuilderS3Explorer } from './PageBuilderS3Explorer'
export type { S3ExplorerEventPayload } from './interface'

// Register the S3Explorer component for dynamic rendering in PageElement
import { registerComponentRenderer, createComponentRenderer } from '../component-renderer-registry'

registerComponentRenderer(
  createComponentRenderer(
    's3-explorer', // This matches the data-type attribute
    () => require('./PageBuilderS3Explorer').PageBuilderS3Explorer,
    10 // Priority 10 for core components
  )
)

// Component registration information
export const S3ExplorerComponent = {
  name: 'S3Explorer',
  category: 'Data',
  description: 'Interactive GCS/S3 file explorer with FileStore API integration for browsing cloud storage',
  icon: 'FolderTree',
  version: '2.0.0'
}