/** Example usage of schemaRegistry (placeholder until formal tests added) */
import { schemaRegistry } from './schema-registry';

schemaRegistry.register({
  id: 'example-user',
  version: '1.0.0',
  name: 'Example User Schema',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }
});

const fetched = schemaRegistry.get('example-user');
if (fetched) {
  // eslint-disable-next-line no-console
  console.log('Fetched schema name:', fetched.name);
}
