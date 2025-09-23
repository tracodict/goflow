import assert from "node:assert";
import { describe, test } from "node:test";
import metaschema from "../metaschema.schema.json" with { type: "json" };
import {
  isBooleanSchema,
  isObjectSchema,
  jsonSchemaType,
} from "../src/types/jsonSchema.ts";

describe("JSON Schema", () => {
  test("should successfully parse the JSON Schema metaschema", () => {
    const result = jsonSchemaType.safeParse(metaschema);
    if (!result.success) {
      console.error("Validation error:", result.error);
    }
    assert.strictEqual(result.success, true);
  });

  test("schema type checker functions should work correctly", () => {
    const objectSchema = { type: "object", properties: {} };
    const booleanSchema = true;

    assert.strictEqual(isObjectSchema(objectSchema), true);
    assert.strictEqual(isBooleanSchema(objectSchema), false);

    assert.strictEqual(isObjectSchema(booleanSchema), false);
    assert.strictEqual(isBooleanSchema(booleanSchema), true);
  });
});
