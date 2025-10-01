/** In-memory schema registry (Phase 0) */
import { SchemaRegistryApi, StoredSchema, StoredSchemaMeta, CompiledValidator } from './schema-types';

class InMemorySchemaRegistry implements SchemaRegistryApi {
  private schemas: Map<string, StoredSchema[]> = new Map(); // key: id → versions array

  register(schema: StoredSchema): void {
    const list = this.schemas.get(schema.id) || [];
    // replace if same version exists
    const idx = list.findIndex(s => s.version === schema.version);
    if (idx >= 0) list[idx] = schema; else list.push(schema);
    // sort versions newest first (semver compare simplified: lex fallback)
    list.sort((a,b) => b.version.localeCompare(a.version, undefined, { numeric: true, sensitivity: 'case' }));
    this.schemas.set(schema.id, list);
  }

  get(id: string, version?: string): StoredSchema | undefined {
    const list = this.schemas.get(id);
    if (!list || list.length === 0) return undefined;
    if (!version) return list[0];
    return list.find(s => s.version === version);
  }

  list(): StoredSchemaMeta[] {
    const metas: StoredSchemaMeta[] = [];
    for (const versions of this.schemas.values()) {
      for (const s of versions) {
        const { id, version, name, description, tags, createdAt, updatedAt } = s;
        metas.push({ id, version, name, description, tags, createdAt, updatedAt });
      }
    }
    return metas;
  }

  // Phase 2: integrate AJV compile & cache; stub returns undefined for now
  ensureValidator(_id: string, _version?: string): CompiledValidator | undefined {
    return undefined;
  }
}

export const schemaRegistry: SchemaRegistryApi = new InMemorySchemaRegistry();
