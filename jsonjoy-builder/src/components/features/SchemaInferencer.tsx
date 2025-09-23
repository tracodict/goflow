import CodeMirror from "@uiw/react-codemirror";
import { json as jsonLang } from "@codemirror/lang-json";
import { useState } from "react";
import { Button } from "../../components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog.tsx";
import { createSchemaFromJson } from "../../lib/schema-inference.ts";
import type { JSONSchema } from "../../types/jsonSchema.ts";
import { useTranslation } from "../../hooks/use-translation.ts";

/** @public */
export interface SchemaInferencerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSchemaInferred: (schema: JSONSchema) => void;
}

/** @public */
export function SchemaInferencer({
  open,
  onOpenChange,
  onSchemaInferred,
}: SchemaInferencerProps) {
  const t = useTranslation();
  const [jsonInput, setJsonInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const handleEditorChange = (val: string) => setJsonInput(val);

  const inferSchemaFromJson = () => {
    try {
      const jsonObject = JSON.parse(jsonInput);
      setError(null);

      // Use the schema inference service to create a schema
      const inferredSchema = createSchemaFromJson(jsonObject);

      onSchemaInferred(inferredSchema);
      onOpenChange(false);
    } catch (error) {
      console.error("Invalid JSON input:", error);
      setError(t.inferrerErrorInvalidJson);
    }
  };

  const handleClose = () => {
    setJsonInput("");
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col jsonjoy">
        <DialogHeader>
          <DialogTitle>{t.inferrerTitle}</DialogTitle>
          <DialogDescription>{t.inferrerDescription}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 py-4 flex flex-col">
          <div className="border rounded-md flex-1 overflow-hidden h-full">
            <CodeMirror
              value={jsonInput}
              height="450px"
              extensions={[jsonLang()]}
              onChange={(val)=> handleEditorChange(val)}
              basicSetup={{ lineNumbers: true, foldGutter: true }}
            />
          </div>
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            {t.inferrerCancel}
          </Button>
          <Button type="button" onClick={inferSchemaFromJson}>{t.inferrerGenerate}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
