# Go Scripting Integration Design for go-petri-flow

## 1. Objectives
- Enable Go as a first-class scripting language for workflow logic, alongside Lua.
- Unify schema/color/type, global variable, and function declaration management for both Go and Lua.
- Support round-trip editing: generate, sync, and update Go script files from workflow models and vice versa.
- Provide APIs for introspection and runtime access to declarations and global state.

## 2. Design Overview

### 2.1. Script File Generation and Management
- For each workflow, generate a Go file (e.g., `workflow_{id}_script.go`) containing:
    - Global variable declarations (state, constants, etc.)
    - Schema/type/color definitions (structs, type aliases, enums)
    - Transition and arc functions (named by convention, e.g., `T_{transition_id}_action`, `A_{arc_id}_expr`)
- The Go file is the single source of truth for workflow logic; edits in the file are reflected in the workflow model and vice versa.
- Use Go's parser/AST to extract and update declarations, ensuring safe merges and round-trip edits.

### 2.2. Naming Conventions
- Transition action functions: `T_{transition_id}_action(args...)`
- Arc expression functions: `A_{arc_id}_expr(args...)`
- Global variables: `G_{varname}`
- Schema/types/colors: `C_{typename}`
- All names are unique per workflow and discoverable via API.

### 2.3. API Endpoints
- `/api/cpn/scripts/go/{workflow_id}`: Get/set the Go script file for a workflow.
- `/api/cpn/scripts/go/{workflow_id}/declarations`: List all global variables, types, colors, and functions.
- `/api/cpn/scripts/go/{workflow_id}/instances`: Get/set current values of global variables and schema instances.
- `/api/cpn/transitions/actions`: List all transition action functions and their signatures.
- `/api/cpn/arcs/expressions`: List all arc expression functions and their signatures.

### 2.4. Runtime Integration
- On workflow execution, compile the Go script file as a plugin (`-buildmode=plugin`) or as a subprocess (see GoNB/Yaegi notes).
- Bind transition/arc inscriptions to the corresponding Go functions by name.
- For global variables and schema instances, provide runtime APIs to get/set values (using plugin symbol lookup or IPC for subprocesses).
- Support hot-reload: recompile and reload plugin on script file changes.

### 2.5. Schema/Color/Type Management
- All schema/type/color definitions are written as Go types (structs, enums, etc.) in the script file, using the `C_{typename}` convention.
- The workflow builder UI and API can generate/update these definitions, and user edits are merged back.
- Color set expressions in the workflow model are mapped to Go types in the script file.

### 2.6. Global Variable Management
- Global variables are declared in the script file with `G_{varname}`.
- API `/api/cpn/scripts/go/{workflow_id}/instances` allows reading/writing these at runtime.
- For stateful workflows, global variables can be used for counters, accumulators, etc.

### 2.7. Synchronization and Round-Trip Editing
- Changes in the workflow model (e.g., adding a transition) auto-generate a stub function in the Go script file.
- Edits in the Go script file (e.g., new function or type) are parsed and reflected in the workflow model.
- Use Go AST diff/merge to avoid clobbering user code.

## 3. Execution Plan

### 3.1. Coding
1. Implement Go script file generator and parser (using `go/parser`, `go/ast`).
2. Add naming convention enforcement and stub generation for transitions/arcs.
3. Build API endpoints for script file CRUD, declaration listing, and instance access.
4. Integrate Go plugin compilation and loading (with fallback to subprocess/Yaegi for platforms where plugins are not available).
5. Implement runtime symbol lookup and invocation for transition/arc functions.
6. Add global variable and schema instance get/set APIs.
7. Implement UI sync: workflow builder updates script file, and script file edits update workflow model.

### 3.2. Testing
1. Unit tests for Go script parsing, stub generation, and AST merge.
2. Integration tests for plugin compilation, loading, and function invocation.
3. API tests for declaration and instance endpoints.
4. End-to-end tests: edit workflow, sync script, run workflow, update script, hot-reload, and verify behavior.
5. Fuzz tests for script file merge and error handling.

## 4. Detailed Component Specifications

### 4.1. Script File Structure

Each workflow generates a Go file with this canonical structure:

```go
// Auto-generated: workflow_{workflow_id}_script.go
// Workflow: {workflow_name}
// DO NOT remove the package declaration or the markers below

package workflow_{workflow_id}

import (
    "encoding/json"
    "time"
    // Auto-managed imports
)

// === COLOR/TYPE DECLARATIONS (Auto-generated stubs, user-editable) ===

// C_{colorname} represents the {colorname} color set
type C_INT int
type C_STRING string
type C_UNIT struct{}

type C_OrderStatus struct {
    OrderID   string    `json:"orderId"`
    Status    string    `json:"status"`
    Timestamp time.Time `json:"timestamp"`
}

// === GLOBAL VARIABLES (Auto-generated stubs, user-editable) ===

// G_{varname} global state variables
var G_counter int = 0
var G_orderCache map[string]*C_OrderStatus

// === TRANSITION ACTION FUNCTIONS (Auto-generated stubs, user-editable) ===

// T_{transition_id}_action is the action function for transition {transition_id}
// Input parameters match the input arc variable bindings
// Return values match the actionFunctionOutput declaration
func T_process_order_action(order C_OrderStatus, priority C_INT) (C_OrderStatus, C_STRING) {
    // User implementation here
    order.Status = "processed"
    message := "Order processed successfully"
    return order, C_STRING(message)
}

func T_validate_action(input C_INT) C_INT {
    // User implementation
    return input * 2
}

// === ARC EXPRESSION FUNCTIONS (Auto-generated stubs, user-editable) ===

// A_{arc_id}_expr evaluates the arc inscription expression
// Returns the token value(s) or multiset for the arc
func A_arc_input_1_expr(token interface{}) interface{} {
    // Simple binding case - return token as-is
    return token
}

func A_arc_output_1_expr(bindings map[string]interface{}) interface{} {
    // Complex output expression using action results
    sum := bindings["sum"].(C_INT)
    return sum + 1
}

// === GUARD FUNCTIONS (Auto-generated stubs, user-editable) ===

// G_{transition_id}_guard evaluates the guard condition
func G_validate_guard(input C_INT) bool {
    return input > 0
}

// === HELPER FUNCTIONS (User-defined, preserved during sync) ===

// User can add custom helper functions below this line
func calculateTotal(items []C_INT) C_INT {
    var sum C_INT = 0
    for _, item := range items {
        sum += item
    }
    return sum
}
```

### 4.2. Naming Convention Details

#### Function Naming Pattern
- **Transition Actions**: `T_{transition_id}_action`
  - Parameters: ordered list matching input arc variable names
  - Returns: tuple matching `actionFunctionOutput` field
  - Example: `func T_proc_action(x C_INT, y C_INT) (C_INT, C_INT)`

- **Arc Expressions**: `A_{arc_id}_expr`
  - For input arcs: `func A_{arc_id}_expr(token interface{}) interface{}`
  - For output arcs: `func A_{arc_id}_expr(bindings map[string]interface{}) interface{}`
  - Complex multiset: return `[]struct{Value interface{}; Count int}`

- **Guards**: `G_{transition_id}_guard`
  - Parameters: same as transition action
  - Returns: `bool`
  - Example: `func G_proc_guard(x C_INT) bool`

#### Type/Color Naming
- **Color Sets**: `C_{colorname}` (uppercase first letter of color name)
  - `C_INT`, `C_STRING`, `C_UNIT`, `C_OrderStatus`
  - Maps to JSON-serializable Go types

#### Global Variable Naming
- **Globals**: `G_{varname}` (uppercase first letter)
  - `G_counter`, `G_orderCache`, `G_config`
  - Package-level variables accessible to all functions

### 4.3. AST Parser and Generator

#### Parser Component (`internal/script/go/parser.go`)

```go
type ScriptParser struct {
    fset *token.FileSet
}

type ParsedScript struct {
    PackageName   string
    Imports       []ImportDecl
    ColorSets     []ColorSetDecl
    GlobalVars    []GlobalVarDecl
    Transitions   []TransitionFunc
    ArcExprs      []ArcExprFunc
    Guards        []GuardFunc
    HelperFuncs   []HelperFunc
}

type ColorSetDecl struct {
    Name       string // e.g., "C_INT"
    ColorName  string // e.g., "INT"
    GoType     string // e.g., "int"
    Definition string // Full source code
    Position   token.Position
}

type GlobalVarDecl struct {
    Name        string // e.g., "G_counter"
    VarName     string // e.g., "counter"
    GoType      string
    InitValue   string
    Definition  string
    Position    token.Position
}

type TransitionFunc struct {
    Name           string // e.g., "T_proc_action"
    TransitionID   string // e.g., "proc"
    Parameters     []FuncParam
    Returns        []FuncReturn
    Body           string
    Position       token.Position
}

type ArcExprFunc struct {
    Name       string
    ArcID      string
    Direction  string // "IN" or "OUT"
    Parameters []FuncParam
    Returns    []FuncReturn
    Body       string
    Position   token.Position
}

type GuardFunc struct {
    Name         string
    TransitionID string
    Parameters   []FuncParam
    Body         string
    Position     token.Position
}

func (p *ScriptParser) Parse(source []byte) (*ParsedScript, error) {
    // Parse Go source using go/parser
    // Walk AST to extract declarations by naming convention
    // Return structured ParsedScript
}

func (p *ScriptParser) ExtractFunctionSignature(fd *ast.FuncDecl) ([]FuncParam, []FuncReturn, error) {
    // Extract parameter names and types
    // Extract return types
}
```

#### Generator Component (`internal/script/go/generator.go`)

```go
type ScriptGenerator struct {
    workflow *models.ColoredPetriNet
}

func (g *ScriptGenerator) GenerateScript() ([]byte, error) {
    // Generate complete Go file from workflow model
    // Include package declaration, imports
    // Generate color set type declarations
    // Generate global variable declarations
    // Generate transition action stubs
    // Generate arc expression stubs
    // Generate guard stubs
}

func (g *ScriptGenerator) GenerateColorSetDecl(cs *models.ColorSet) string {
    // Map CPN color set to Go type
    // Handle primitives: int, string, unit
    // Handle structs: JSON-tagged struct definitions
    // Handle enums: type alias with const declarations
}

func (g *ScriptGenerator) GenerateTransitionStub(t *models.Transition) string {
    // Generate function signature from transition
    // Extract input parameters from input arcs
    // Extract return types from actionFunctionOutput
    // Generate stub body with TODO comment
}

func (g *ScriptGenerator) MergeUserCode(existing, generated *ParsedScript) (*ParsedScript, error) {
    // Intelligent merge:
    // - Keep user-modified function bodies
    // - Update signatures if model changed
    // - Add new stubs for new transitions/arcs
    // - Remove stubs for deleted elements
    // - Preserve helper functions
}
```

### 4.4. Plugin Compilation and Loading

#### Compiler Component (`internal/script/go/compiler.go`)

```go
type PluginCompiler struct {
    workDir   string
    goPath    string
    buildMode string // "plugin" or "exe"
}

func (c *PluginCompiler) Compile(scriptPath string, workflowID string) (*CompiledPlugin, error) {
    // Create temporary build directory
    // Copy script file
    // Run go mod init if needed
    // Run go mod tidy
    // Compile with -buildmode=plugin (Linux/macOS) or fallback
    // Return path to .so file or executable
}

type CompiledPlugin struct {
    Path       string
    WorkflowID string
    BuildTime  time.Time
    Hash       string // SHA256 of source
}

func (c *PluginCompiler) CompileToPlugin(scriptPath, outputPath string) error {
    cmd := exec.Command("go", "build",
        "-buildmode=plugin",
        "-o", outputPath,
        scriptPath)
    // Handle compilation errors
    // Map errors back to source lines
}

func (c *PluginCompiler) CompileToExecutable(scriptPath, outputPath string) error {
    // Fallback for platforms without plugin support
    // Add main() wrapper that accepts JSON RPC calls
}
```

#### Plugin Loader (`internal/script/go/loader.go`)

```go
type PluginLoader struct {
    loadedPlugins map[string]*LoadedPlugin
    mu            sync.RWMutex
}

type LoadedPlugin struct {
    Plugin     *plugin.Plugin
    WorkflowID string
    Functions  map[string]interface{} // Function name -> function pointer
    Globals    map[string]interface{} // Global name -> pointer
    LoadTime   time.Time
}

func (l *PluginLoader) Load(pluginPath, workflowID string) (*LoadedPlugin, error) {
    p, err := plugin.Open(pluginPath)
    if err != nil {
        return nil, err
    }
    
    lp := &LoadedPlugin{
        Plugin:     p,
        WorkflowID: workflowID,
        Functions:  make(map[string]interface{}),
        Globals:    make(map[string]interface{}),
        LoadTime:   time.Now(),
    }
    
    // Discover and cache all exported symbols
    // Use reflection to find functions/variables by naming convention
    
    return lp, nil
}

func (l *PluginLoader) LookupTransitionAction(workflowID, transitionID string) (interface{}, error) {
    // Lookup T_{transition_id}_action function
    lp := l.loadedPlugins[workflowID]
    funcName := fmt.Sprintf("T_%s_action", transitionID)
    fn, exists := lp.Functions[funcName]
    if !exists {
        // Try to lookup from plugin
        sym, err := lp.Plugin.Lookup(funcName)
        if err != nil {
            return nil, err
        }
        lp.Functions[funcName] = sym
        return sym, nil
    }
    return fn, nil
}

func (l *PluginLoader) LookupGlobalVar(workflowID, varName string) (interface{}, error) {
    // Lookup G_{varname} variable
    lp := l.loadedPlugins[workflowID]
    globalName := fmt.Sprintf("G_%s", varName)
    return lp.Plugin.Lookup(globalName)
}

func (l *PluginLoader) Reload(workflowID string, newPluginPath string) error {
    // Hot-reload: unload old, load new
    // Note: Go plugins cannot be truly unloaded, so we track versions
    l.mu.Lock()
    defer l.mu.Unlock()
    delete(l.loadedPlugins, workflowID)
    return l.Load(newPluginPath, workflowID)
}
```

### 4.5. Runtime Invocation Bridge

#### Function Invoker (`internal/script/go/invoker.go`)

```go
type FunctionInvoker struct {
    loader *PluginLoader
}

// InvokeTransitionAction calls the Go transition action function
func (i *FunctionInvoker) InvokeTransitionAction(
    workflowID, transitionID string,
    inputBindings map[string]interface{},
) ([]interface{}, error) {
    // Lookup function
    fnSym, err := i.loader.LookupTransitionAction(workflowID, transitionID)
    if err != nil {
        return nil, err
    }
    
    // Use reflection to build argument list from inputBindings
    fnVal := reflect.ValueOf(fnSym)
    fnType := fnVal.Type()
    
    args := make([]reflect.Value, fnType.NumIn())
    for idx := 0; idx < fnType.NumIn(); idx++ {
        paramName := getParamNameByIndex(transitionID, idx) // From metadata
        argValue := inputBindings[paramName]
        args[idx] = reflect.ValueOf(argValue).Convert(fnType.In(idx))
    }
    
    // Invoke
    results := fnVal.Call(args)
    
    // Extract return values
    outputs := make([]interface{}, len(results))
    for idx, res := range results {
        outputs[idx] = res.Interface()
    }
    
    return outputs, nil
}

// InvokeGuard calls the Go guard function
func (i *FunctionInvoker) InvokeGuard(
    workflowID, transitionID string,
    inputBindings map[string]interface{},
) (bool, error) {
    // Similar to InvokeTransitionAction but returns bool
}

// InvokeArcExpression calls the Go arc expression function
func (i *FunctionInvoker) InvokeArcExpression(
    workflowID, arcID string,
    context map[string]interface{},
) (interface{}, error) {
    // Lookup A_{arc_id}_expr
    // Invoke with context (token or bindings)
    // Return evaluated value/multiset
}
```

#### Global Variable Accessor (`internal/script/go/globals.go`)

```go
type GlobalAccessor struct {
    loader *PluginLoader
}

func (g *GlobalAccessor) GetGlobal(workflowID, varName string) (interface{}, error) {
    sym, err := g.loader.LookupGlobalVar(workflowID, varName)
    if err != nil {
        return nil, err
    }
    
    // Dereference pointer to get value
    val := reflect.ValueOf(sym)
    if val.Kind() == reflect.Ptr {
        return val.Elem().Interface(), nil
    }
    return val.Interface(), nil
}

func (g *GlobalAccessor) SetGlobal(workflowID, varName string, value interface{}) error {
    sym, err := g.loader.LookupGlobalVar(workflowID, varName)
    if err != nil {
        return err
    }
    
    // Set value via reflection
    val := reflect.ValueOf(sym)
    if val.Kind() != reflect.Ptr {
        return fmt.Errorf("global %s is not a pointer", varName)
    }
    
    val.Elem().Set(reflect.ValueOf(value))
    return nil
}

func (g *GlobalAccessor) ListGlobals(workflowID string) (map[string]interface{}, error) {
    // Return all G_{varname} variables and their current values
}
```

### 4.6. API Endpoints Implementation

#### Handler Structure (`internal/api/script_go_handler.go`)

```go
type ScriptGoHandler struct {
    parser     *ScriptParser
    generator  *ScriptGenerator
    compiler   *PluginCompiler
    loader     *PluginLoader
    invoker    *FunctionInvoker
    globalAcc  *GlobalAccessor
    storage    ScriptStorage // Persist script files
}

// GET /api/cpn/scripts/go/{workflow_id}
func (h *ScriptGoHandler) GetScript(c *gin.Context) {
    workflowID := c.Param("workflow_id")
    script, err := h.storage.LoadScript(workflowID)
    if err != nil {
        c.JSON(404, gin.H{"error": "script not found"})
        return
    }
    c.JSON(200, gin.H{
        "workflowId": workflowID,
        "source":     string(script),
        "language":   "go",
    })
}

// POST /api/cpn/scripts/go/{workflow_id}
func (h *ScriptGoHandler) UpdateScript(c *gin.Context) {
    workflowID := c.Param("workflow_id")
    var req struct {
        Source string `json:"source"`
    }
    if err := c.BindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    // Parse and validate
    parsed, err := h.parser.Parse([]byte(req.Source))
    if err != nil {
        c.JSON(400, gin.H{"error": "parse error", "details": err.Error()})
        return
    }
    
    // Save
    if err := h.storage.SaveScript(workflowID, []byte(req.Source)); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    // Recompile and reload
    if err := h.compileAndReload(workflowID); err != nil {
        c.JSON(500, gin.H{"error": "compile error", "details": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{"message": "script updated successfully"})
}

// POST /api/cpn/scripts/go/{workflow_id}/generate
func (h *ScriptGoHandler) GenerateScript(c *gin.Context) {
    workflowID := c.Param("workflow_id")
    
    // Load workflow model
    workflow, err := h.loadWorkflow(workflowID)
    if err != nil {
        c.JSON(404, gin.H{"error": "workflow not found"})
        return
    }
    
    // Check if script already exists
    existingScript, _ := h.storage.LoadScript(workflowID)
    
    // Generate new script
    h.generator.workflow = workflow
    newScript, err := h.generator.GenerateScript()
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    // Merge with existing if present
    if existingScript != nil {
        existing, _ := h.parser.Parse(existingScript)
        generated, _ := h.parser.Parse(newScript)
        merged, err := h.generator.MergeUserCode(existing, generated)
        if err != nil {
            c.JSON(500, gin.H{"error": "merge error", "details": err.Error()})
            return
        }
        newScript = []byte(merged.Render())
    }
    
    // Save
    h.storage.SaveScript(workflowID, newScript)
    
    c.JSON(200, gin.H{
        "message": "script generated",
        "source":  string(newScript),
    })
}

// GET /api/cpn/scripts/go/{workflow_id}/declarations
func (h *ScriptGoHandler) GetDeclarations(c *gin.Context) {
    workflowID := c.Param("workflow_id")
    script, err := h.storage.LoadScript(workflowID)
    if err != nil {
        c.JSON(404, gin.H{"error": "script not found"})
        return
    }
    
    parsed, err := h.parser.Parse(script)
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{
        "workflowId":  workflowID,
        "colorSets":   parsed.ColorSets,
        "globalVars":  parsed.GlobalVars,
        "transitions": parsed.Transitions,
        "arcExprs":    parsed.ArcExprs,
        "guards":      parsed.Guards,
    })
}

// GET /api/cpn/scripts/go/{workflow_id}/instances
func (h *ScriptGoHandler) GetGlobalInstances(c *gin.Context) {
    workflowID := c.Param("workflow_id")
    
    globals, err := h.globalAcc.ListGlobals(workflowID)
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{
        "workflowId": workflowID,
        "globals":    globals,
    })
}

// PUT /api/cpn/scripts/go/{workflow_id}/instances/{var_name}
func (h *ScriptGoHandler) SetGlobalInstance(c *gin.Context) {
    workflowID := c.Param("workflow_id")
    varName := c.Param("var_name")
    
    var req struct {
        Value interface{} `json:"value"`
    }
    if err := c.BindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    if err := h.globalAcc.SetGlobal(workflowID, varName, req.Value); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{"message": "global variable updated"})
}
```

### 4.7. Engine Integration

#### Modified Firing Logic (`internal/engine/engine.go`)

```go
func (e *Engine) fireTransition(t *Transition, bindings map[string]interface{}) error {
    // Check if transition uses Go script
    if t.ScriptLanguage == "go" {
        return e.fireGoTransition(t, bindings)
    }
    // Existing Lua logic
    return e.fireLuaTransition(t, bindings)
}

func (e *Engine) fireGoTransition(t *Transition, bindings map[string]interface{}) error {
    // Invoke guard if present
    if t.GuardFunction != "" {
        guardOK, err := e.goInvoker.InvokeGuard(e.workflowID, t.ID, bindings)
        if err != nil {
            return fmt.Errorf("guard error: %w", err)
        }
        if !guardOK {
            return ErrGuardFailed
        }
    }
    
    // Invoke action function
    outputs, err := e.goInvoker.InvokeTransitionAction(e.workflowID, t.ID, bindings)
    if err != nil {
        return fmt.Errorf("action error: %w", err)
    }
    
    // Bind outputs to actionFunctionOutput names
    outputBindings := make(map[string]interface{})
    for idx, name := range t.ActionFunctionOutput {
        if idx < len(outputs) {
            outputBindings[name] = outputs[idx]
        }
    }
    
    // Merge with input bindings for output arc evaluation
    allBindings := mergeMaps(bindings, outputBindings)
    
    // Evaluate output arcs
    for _, arc := range t.OutputArcs {
        if arc.ScriptLanguage == "go" {
            value, err := e.goInvoker.InvokeArcExpression(e.workflowID, arc.ID, allBindings)
            if err != nil {
                return fmt.Errorf("output arc %s error: %w", arc.ID, err)
            }
            // Add token to target place
            e.addToken(arc.TargetPlace, value)
        } else {
            // Existing Lua arc logic
        }
    }
    
    return nil
}
```

### 4.8. Workflow Model Extensions

Add to `models/cpn.go`:

```go
type Transition struct {
    // ... existing fields ...
    ScriptLanguage       string   `json:"scriptLanguage"`       // "lua" or "go"
    ActionFunction       string   `json:"actionFunction"`       // Full Go function source
    ActionFunctionOutput []string `json:"actionFunctionOutput"` // Output variable names
    GuardFunction        string   `json:"guardFunction"`        // Full Go guard source
}

type Arc struct {
    // ... existing fields ...
    ScriptLanguage string `json:"scriptLanguage"` // "lua" or "go"
    ExprFunction   string `json:"exprFunction"`   // Full Go function source for complex arcs
}

type ColorSet struct {
    // ... existing fields ...
    GoTypeDefinition string `json:"goTypeDefinition"` // Full Go type source
}
```

### 4.9. Synchronization Strategy

#### Workflow → Script Sync

```go
func (s *Synchronizer) SyncWorkflowToScript(workflowID string) error {
    workflow, err := s.loadWorkflow(workflowID)
    if err != nil {
        return err
    }
    
    existingScript, _ := s.storage.LoadScript(workflowID)
    var existing *ParsedScript
    if existingScript != nil {
        existing, _ = s.parser.Parse(existingScript)
    }
    
    // Generate fresh script from workflow model
    s.generator.workflow = workflow
    freshScript, err := s.generator.GenerateScript()
    if err != nil {
        return err
    }
    fresh, _ := s.parser.Parse(freshScript)
    
    // Merge: preserve user code bodies, update signatures
    merged, err := s.generator.MergeUserCode(existing, fresh)
    if err != nil {
        return err
    }
    
    // Save merged script
    return s.storage.SaveScript(workflowID, []byte(merged.Render()))
}
```

#### Script → Workflow Sync

```go
func (s *Synchronizer) SyncScriptToWorkflow(workflowID string) error {
    script, err := s.storage.LoadScript(workflowID)
    if err != nil {
        return err
    }
    
    parsed, err := s.parser.Parse(script)
    if err != nil {
        return err
    }
    
    workflow, err := s.loadWorkflow(workflowID)
    if err != nil {
        return err
    }
    
    // Update workflow model from parsed script
    // - Update color sets from C_{name} declarations
    // - Update transition action signatures from T_{id}_action
    // - Update arc expressions from A_{id}_expr
    // - Update guards from G_{id}_guard
    
    for _, cs := range parsed.ColorSets {
        // Find or create color set in workflow
        colorSet := workflow.FindColorSet(cs.ColorName)
        if colorSet == nil {
            colorSet = &models.ColorSet{Name: cs.ColorName}
            workflow.ColorSets = append(workflow.ColorSets, colorSet)
        }
        colorSet.GoTypeDefinition = cs.Definition
    }
    
    for _, tf := range parsed.Transitions {
        transition := workflow.FindTransition(tf.TransitionID)
        if transition != nil {
            transition.ScriptLanguage = "go"
            transition.ActionFunction = tf.Body
            transition.ActionFunctionOutput = extractOutputNames(tf.Returns)
        }
    }
    
    // Save updated workflow
    return s.saveWorkflow(workflow)
}
```

### 4.10. Color Set Mapping

```go
// Map CPN color set declarations to Go types
func mapColorSetToGoType(cs *models.ColorSet) string {
    switch cs.Type {
    case "int":
        return "type C_" + cs.Name + " int"
    case "string":
        return "type C_" + cs.Name + " string"
    case "unit":
        return "type C_" + cs.Name + " struct{}"
    case "struct":
        // Generate struct with JSON tags
        var sb strings.Builder
        sb.WriteString(fmt.Sprintf("type C_%s struct {\n", cs.Name))
        for _, field := range cs.Fields {
            sb.WriteString(fmt.Sprintf("\t%s %s `json:\"%s\"`\n",
                field.Name,
                mapFieldType(field.Type),
                jsonName(field.Name)))
        }
        sb.WriteString("}")
        return sb.String()
    case "enum":
        // Generate type alias and const block
        var sb strings.Builder
        sb.WriteString(fmt.Sprintf("type C_%s string\n\n", cs.Name))
        sb.WriteString("const (\n")
        for _, val := range cs.Values {
            sb.WriteString(fmt.Sprintf("\tC_%s_%s C_%s = \"%s\"\n",
                cs.Name, val, cs.Name, val))
        }
        sb.WriteString(")")
        return sb.String()
    default:
        return fmt.Sprintf("type C_%s interface{}", cs.Name)
    }
}
```

## 5. Execution Plan (Detailed)

### Phase 1: Core Infrastructure (Week 1-2)

#### Tasks:
1. **Create package structure**
   - `internal/script/go/parser.go` - AST parser
   - `internal/script/go/generator.go` - Script generator
   - `internal/script/go/compiler.go` - Plugin compiler
   - `internal/script/go/loader.go` - Plugin loader
   - `internal/script/go/invoker.go` - Function invoker
   - `internal/script/go/globals.go` - Global accessor
   - `internal/script/go/storage.go` - File storage

2. **Implement ScriptParser**
   - Parse Go source with `go/parser`
   - Walk AST to identify declarations by naming convention
   - Extract function signatures, types, variables
   - Unit tests: parse various valid/invalid scripts

3. **Implement ScriptGenerator**
   - Generate canonical script structure
   - Color set to Go type mapping
   - Transition/arc function stub generation
   - Merge algorithm for user code preservation
   - Unit tests: generate scripts from workflow models

#### Deliverables:
- Working parser that extracts all declaration types
- Working generator that creates valid Go files
- Test suite with >80% coverage

### Phase 2: Compilation and Loading (Week 2-3)

#### Tasks:
1. **Implement PluginCompiler**
   - Detect platform (Linux/macOS for plugins, else fallback)
   - Compile to plugin with error handling
   - Map compiler errors to source lines
   - Implement executable fallback for non-plugin platforms
   - Unit tests: compile valid/invalid scripts

2. **Implement PluginLoader**
   - Load .so files via plugin.Open
   - Cache loaded plugins
   - Discover exported symbols
   - Implement hot-reload logic
   - Unit tests: load and lookup symbols

3. **Implement FunctionInvoker**
   - Reflection-based function invocation
   - Type conversion and validation
   - Error handling and reporting
   - Integration tests: invoke actual plugin functions

#### Deliverables:
- Scripts can be compiled to plugins
- Plugins can be loaded and functions invoked
- Test workflows with Go transitions execute correctly

### Phase 3: API Implementation (Week 3-4)

#### Tasks:
1. **Implement API handlers**
   - GET/POST `/api/cpn/scripts/go/{workflow_id}`
   - POST `/api/cpn/scripts/go/{workflow_id}/generate`
   - GET `/api/cpn/scripts/go/{workflow_id}/declarations`
   - GET/PUT `/api/cpn/scripts/go/{workflow_id}/instances/{var_name}`
   - API tests: test all endpoints

2. **Implement GlobalAccessor**
   - Get/set global variables via reflection
   - List all globals with values
   - Type-safe value updates
   - Unit tests: manipulate globals

3. **Wire into router**
   - Register routes in `internal/api/router.go`
   - Add middleware for validation
   - Integration tests: end-to-end API flows

#### Deliverables:
- All API endpoints working
- API documentation updated
- Postman/curl examples

### Phase 4: Engine Integration (Week 4-5)

#### Tasks:
1. **Extend Transition model**
   - Add `scriptLanguage`, `actionFunction`, `actionFunctionOutput`, `guardFunction` fields
   - Update JSON serialization
   - Migration for existing workflows

2. **Extend Arc model**
   - Add `scriptLanguage`, `exprFunction` fields
   - Update JSON serialization

3. **Modify firing logic**
   - Detect script language (Go vs Lua)
   - Route to appropriate invoker
   - Handle errors consistently
   - Integration tests: mixed Lua/Go workflows

4. **Implement synchronization**
   - Workflow → Script sync
   - Script → Workflow sync
   - Conflict detection and resolution
   - Integration tests: round-trip sync

#### Deliverables:
- Engine executes Go transitions correctly
- Mixed Lua/Go workflows work
- Sync keeps workflow and script in sync

### Phase 5: Testing and Hardening (Week 5-6)

#### Tasks:
1. **Integration test suite**
   - Simple Go transition workflow
   - Complex multi-step Go workflow
   - Mixed Lua/Go workflow
   - Guard and arc expression functions
   - Global variable manipulation
   - Hot-reload scenarios

2. **Error handling tests**
   - Compilation errors
   - Runtime errors in actions
   - Type mismatch errors
   - Missing function errors
   - Concurrent access tests

3. **Performance tests**
   - Plugin loading time
   - Function invocation overhead vs Lua
   - Memory usage with many plugins
   - Hot-reload impact

4. **Documentation**
   - User guide for Go scripting
   - API reference
   - Migration guide from Lua
   - Best practices
   - Examples and tutorials

#### Deliverables:
- Comprehensive test suite with >85% coverage
- Performance benchmarks
- Complete documentation
- Example workflows

### Phase 6: Advanced Features (Week 6+)

#### Tasks:
1. **IDE integration**
   - Generate Go modules for IDE autocomplete
   - LSP support for inline editing
   - Syntax highlighting in UI

2. **Debugging support**
   - Attach debugger to plugin
   - Breakpoint support
   - Variable inspection

3. **Optimization**
   - Compile caching
   - Incremental compilation
   - Parallel plugin loading

4. **Cross-language support**
   - Call Lua from Go and vice versa
   - Shared global state
   - Type conversion bridge

#### Deliverables:
- Enhanced developer experience
- Production-ready performance
- Advanced debugging tools

## 6. Testing Strategy

### 6.1. Unit Tests

```go
// parser_test.go
func TestParseSimpleScript(t *testing.T) {
    source := `
    package workflow_test
    type C_INT int
    var G_counter int = 0
    func T_proc_action(x C_INT) C_INT {
        return x * 2
    }
    `
    parser := NewScriptParser()
    parsed, err := parser.Parse([]byte(source))
    assert.NoError(t, err)
    assert.Len(t, parsed.ColorSets, 1)
    assert.Len(t, parsed.GlobalVars, 1)
    assert.Len(t, parsed.Transitions, 1)
}

// generator_test.go
func TestGenerateFromWorkflow(t *testing.T) {
    workflow := &models.ColoredPetriNet{
        ID: "test",
        ColorSets: []*models.ColorSet{
            {Name: "INT", Type: "int"},
        },
        Transitions: []*models.Transition{
            {ID: "proc", Name: "Process"},
        },
    }
    gen := NewScriptGenerator(workflow)
    script, err := gen.GenerateScript()
    assert.NoError(t, err)
    assert.Contains(t, string(script), "type C_INT int")
    assert.Contains(t, string(script), "func T_proc_action")
}

// compiler_test.go
func TestCompileValidScript(t *testing.T) {
    compiler := NewPluginCompiler()
    tmpDir := t.TempDir()
    scriptPath := filepath.Join(tmpDir, "test.go")
    os.WriteFile(scriptPath, []byte(validScript), 0644)
    
    compiled, err := compiler.Compile(scriptPath, "test")
    assert.NoError(t, err)
    assert.FileExists(t, compiled.Path)
}
```

### 6.2. Integration Tests

```go
// integration_test.go
func TestEndToEndGoWorkflow(t *testing.T) {
    // 1. Create workflow
    workflow := createTestWorkflow()
    
    // 2. Generate script
    handler := setupScriptHandler()
    script, err := handler.GenerateScript(workflow.ID)
    assert.NoError(t, err)
    
    // 3. Compile and load
    compiled, err := handler.compiler.Compile(script, workflow.ID)
    assert.NoError(t, err)
    loaded, err := handler.loader.Load(compiled.Path, workflow.ID)
    assert.NoError(t, err)
    
    // 4. Execute transition
    engine := setupEngine(workflow, loaded)
    err = engine.Step()
    assert.NoError(t, err)
    
    // 5. Verify output
    marking := engine.GetMarking()
    assert.Equal(t, expectedMarking, marking)
}

func TestHotReload(t *testing.T) {
    // 1. Load initial script
    handler := setupScriptHandler()
    handler.LoadScript("test", initialScript)
    
    // 2. Execute workflow
    result1 := executeWorkflow("test")
    
    // 3. Update script
    handler.UpdateScript("test", modifiedScript)
    
    // 4. Execute again
    result2 := executeWorkflow("test")
    
    // 5. Verify changed behavior
    assert.NotEqual(t, result1, result2)
}

// Variable Scope Tests (adapted from TEST-varscope.md)
func TestGoVariableScopeLocalInArc(t *testing.T) {
    // Test local variables in arc expressions (should not persist)
    // Equivalent to TEST-varscope.md example 1
    workflow := createWorkflowWithLocalArcVar()
    executeAndVerifyScope(t, workflow, expectedLocalScope)
}

func TestGoVariableScopeGlobalAcrossFirings(t *testing.T) {
    // Test global variables persisting across firings
    // Equivalent to TEST-varscope.md example 2
    workflow := createWorkflowWithGlobalArcVar()
    executeMultipleStepsAndVerifyAccumulation(t, workflow)
}

func TestGoActionGlobalForOutputArc(t *testing.T) {
    // Test action setting global for output arc use
    // Equivalent to TEST-varscope.md example 3
    workflow := createWorkflowWithActionGlobal()
    executeAndVerifyActionGlobal(t, workflow)
}

func TestGoAdjacencyScoping(t *testing.T) {
    // Test place-ID, arc-ID, transition-ID aliases
    // Equivalent to TEST-varscope.md examples 7-9
    workflow := createWorkflowWithAdjacencyAliases()
    executeAndVerifyAdjacency(t, workflow)
}

// Action Expression Tests (adapted from TEST-auto.md)
func TestGoActionComputingDerivedOutput(t *testing.T) {
    // Test action computing intermediate results for output arcs
    // Equivalent to TEST-auto.md example 1
    workflow := createWorkflowWithActionDerivedOutput()
    executeAndVerifyDerivedOutput(t, workflow)
}

func TestGoActionWithTransitionDelay(t *testing.T) {
    // Test action executed after delay, referencing timestamps
    // Equivalent to TEST-auto.md example 2
    workflow := createWorkflowWithDelayedAction()
    executeWithDelayAndVerify(t, workflow)
}

func TestGoActionCombiningMultipleInputs(t *testing.T) {
    // Test action combining multiple input variables
    // Equivalent to TEST-auto.md example 3
    workflow := createWorkflowWithMultiInputAction()
    executeAndVerifyMultiInput(t, workflow)
}
```

### 6.3. API Tests

These API tests demonstrate that Go scripting covers the same variable scoping and action expression behaviors as Lua scripting, as documented in `TEST-varscope.md` and `TEST-auto.md`. Each test includes:

1. Loading a workflow with Go script transitions/arcs
2. Generating/updating the Go script via API
3. Simulating execution and verifying results

```bash
export FLOW_SVC=http://localhost:8082
```

#### Basic API Functionality Tests

```bash
# Test script generation for a workflow with Go transitions
curl -X POST ${FLOW_SVC}/api/cpn/scripts/go/test_workflow/generate

# Test script retrieval
curl -X GET ${FLOW_SVC}/api/cpn/scripts/go/test_workflow

# Test script update with custom Go code
curl -X POST ${FLOW_SVC}/api/cpn/scripts/go/test_workflow \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "package workflow_test\n\ntype C_INT int\n\nvar G_tmp int\n\nfunc T_proc_action(x C_INT) C_INT {\n    return x * 2\n}\n"
  }'

# Test declarations extraction
curl -X GET ${FLOW_SVC}/api/cpn/scripts/go/test_workflow/declarations

# Test global variable access
curl -X GET ${FLOW_SVC}/api/cpn/scripts/go/test_workflow/instances
curl -X PUT ${FLOW_SVC}/api/cpn/scripts/go/test_workflow/instances/counter \
  -H 'Content-Type: application/json' \
  -d '{"value": 42}'
```

#### Variable Scope API Tests (Equivalent to TEST-varscope.md)

##### 1. Local Variable Inside Output Arc (Go Equivalent of Example 1)
```bash
# Load workflow with Go script for local arc variable
curl -X POST ${FLOW_SVC}/api/cpn/load \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "go-scope-arc-local",
    "name": "Go Arc Local",
    "description": "Local var inside Go arc expression",
    "colorSets": [{"name": "INT", "type": "int"}],
    "places": [
      {"id": "p_in", "name": "In", "colorSet": "INT"},
      {"id": "p_out", "name": "Out", "colorSet": "INT"}
    ],
    "transitions": [
      {
        "id": "t1",
        "name": "T1",
        "kind": "Auto",
        "scriptLanguage": "go",
        "actionFunction": "func T_t1_action(x C_INT) C_INT {\n    return x\n}"
      }
    ],
    "arcs": [
      {"id": "a_in", "sourceId": "p_in", "targetId": "t1", "expression": "x", "direction": "IN", "scriptLanguage": "go"},
      {"id": "a_out", "sourceId": "t1", "targetId": "p_out", "expression": "func A_a_out_expr() C_INT {\n    tmp := x * 5\n    return tmp + 2\n}", "direction": "OUT", "scriptLanguage": "go"}
    ],
    "initialMarking": {"In": [{"value": 4, "timestamp": 0}]}
  }'

# Generate Go script
curl -X POST ${FLOW_SVC}/api/cpn/scripts/go/go-scope-arc-local/generate

# Simulate step
curl -X POST "${FLOW_SVC}/api/simulation/step?id=go-scope-arc-local"

# Verify output (expect Out value 22)
curl -X GET "${FLOW_SVC}/api/marking/get?id=go-scope-arc-local"
```

##### 2. Global Variable Via Output Arc (Go Equivalent of Example 2)
```bash
# Load workflow with global accumulation
curl -X POST ${FLOW_SVC}/api/cpn/load \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "go-scope-arc-global",
    "name": "Go Arc Global",
    "description": "Global variable reuse across Go firings",
    "colorSets": [{"name": "INT", "type": "int"}],
    "places": [
      {"id": "p_src", "name": "Src", "colorSet": "INT"},
      {"id": "p_mid", "name": "Mid", "colorSet": "INT"}
    ],
    "transitions": [
      {
        "id": "t_incr",
        "name": "Incr",
        "kind": "Auto",
        "scriptLanguage": "go",
        "actionFunction": "func T_t_incr_action(x C_INT) C_INT {\n    return x\n}"
      }
    ],
    "arcs": [
      {"id": "a_in", "sourceId": "p_src", "targetId": "t_incr", "expression": "x", "direction": "IN", "scriptLanguage": "go"},
      {"id": "a_out", "sourceId": "t_incr", "targetId": "p_mid", "expression": "func A_a_out_expr() C_INT {\n    if G_g == 0 {\n        G_g = x\n    } else {\n        G_g = G_g + x\n    }\n    return G_g\n}", "direction": "OUT", "scriptLanguage": "go"}
    ],
    "initialMarking": {"Src": [{"value": 3, "timestamp": 0}, {"value": 4, "timestamp": 0}]}
  }'

# Generate and update script with global var
curl -X POST ${FLOW_SVC}/api/cpn/scripts/go/go-scope-arc-global/generate
curl -X POST ${FLOW_SVC}/api/cpn/scripts/go/go-scope-arc-global \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "package workflow_test\n\ntype C_INT int\n\nvar G_g int\n\nfunc T_t_incr_action(x C_INT) C_INT {\n    return x\n}\n\nfunc A_a_out_expr() C_INT {\n    G_g = G_g + x\n    return G_g\n}\n"
  }'

# Simulate first firing
curl -X POST "${FLOW_SVC}/api/simulation/step?id=go-scope-arc-global"
# Simulate second firing
curl -X POST "${FLOW_SVC}/api/simulation/step?id=go-scope-arc-global"

# Verify accumulation (expect Mid tokens [3, 7])
curl -X GET "${FLOW_SVC}/api/marking/get?id=go-scope-arc-global"
```

##### 3. Action Expression Producing Global for Output Arc (Go Equivalent of Example 3)
```bash
# Load workflow with action setting global
curl -X POST ${FLOW_SVC}/api/cpn/load \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "go-scope-action-global",
    "name": "Go Action Global",
    "description": "Go action sets global for arc",
    "colorSets": [{"name": "INT", "type": "int"}],
    "places": [
      {"id": "p_in", "name": "In", "colorSet": "INT"},
      {"id": "p_out", "name": "Out", "colorSet": "INT"}
    ],
    "transitions": [
      {
        "id": "t_proc",
        "name": "Proc",
        "kind": "Auto",
        "scriptLanguage": "go",
        "actionFunction": "func T_t_proc_action(x C_INT) {\n    G_tmp = x * 10\n}"
      }
    ],
    "arcs": [
      {"id": "a_in", "sourceId": "p_in", "targetId": "t_proc", "expression": "x", "direction": "IN", "scriptLanguage": "go"},
      {"id": "a_out", "sourceId": "t_proc", "targetId": "p_out", "expression": "func A_a_out_expr() C_INT {\n    return G_tmp + 1\n}", "direction": "OUT", "scriptLanguage": "go"}
    ],
    "initialMarking": {"In": [{"value": 2, "timestamp": 0}]}
  }'

# Generate and update script
curl -X POST ${FLOW_SVC}/api/cpn/scripts/go/go-scope-action-global/generate
curl -X POST ${FLOW_SVC}/api/cpn/scripts/go/go-scope-action-global \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "package workflow_test\n\ntype C_INT int\n\nvar G_tmp int\n\nfunc T_t_proc_action(x C_INT) {\n    G_tmp = x * 10\n}\n\nfunc A_a_out_expr() C_INT {\n    return G_tmp + 1\n}\n"
  }'

# Simulate and verify (expect Out value 21)
curl -X POST "${FLOW_SVC}/api/simulation/step?id=go-scope-action-global"
curl -X GET "${FLOW_SVC}/api/marking/get?id=go-scope-action-global"
```

##### 4. Local in Action Not Visible to Arc (Go Equivalent of Example 4)
```bash
# Load workflow showing local action vars not visible to arcs
curl -X POST ${FLOW_SVC}/api/cpn/load \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "go-scope-action-local",
    "name": "Go Action Local Hidden",
    "description": "Local in Go action not visible to arc",
    "colorSets": [{"name": "INT", "type": "int"}],
    "places": [
      {"id": "p_in", "name": "In", "colorSet": "INT"},
      {"id": "p_out", "name": "Out", "colorSet": "INT"}
    ],
    "transitions": [
      {
        "id": "t_proc",
        "name": "Proc",
        "kind": "Auto",
        "scriptLanguage": "go",
        "actionFunction": "func T_t_proc_action(x C_INT) {\n    tmp2 := x * 3\n}"
      }
    ],
    "arcs": [
      {"id": "a_in", "sourceId": "p_in", "targetId": "t_proc", "expression": "x", "direction": "IN", "scriptLanguage": "go"},
      {"id": "a_out", "sourceId": "t_proc", "targetId": "p_out", "expression": "func A_a_out_expr() C_INT {\n    if G_tmp2 == 0 {\n        return -1\n    }\n    return G_tmp2\n}", "direction": "OUT", "scriptLanguage": "go"}
    ],
    "initialMarking": {"In": [{"value": 5, "timestamp": 0}]}
  }'

# Generate and update script (note: tmp2 is local, so not accessible)
curl -X POST ${FLOW_SVC}/api/cpn/scripts/go/go-scope-action-local/generate
curl -X POST ${FLOW_SVC}/api/cpn/scripts/go/go-scope-action-local \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "package workflow_test\n\ntype C_INT int\n\nvar G_tmp2 int\n\nfunc T_t_proc_action(x C_INT) {\n    tmp2 := x * 3  // local, not global\n}\n\nfunc A_a_out_expr() C_INT {\n    return G_tmp2  // will be 0 since tmp2 is local\n}\n"
  }'

# Simulate and verify (expect Out value 0, showing local not visible)
curl -X POST "${FLOW_SVC}/api/simulation/step?id=go-scope-action-local"
curl -X GET "${FLOW_SVC}/api/marking/get?id=go-scope-action-local"
```

##### 5. Guard Using Globals (Go Equivalent of Example 5)
```bash
# Load workflow with guard checking accumulated global
curl -X POST ${FLOW_SVC}/api/cpn/load \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "go-scope-guard-global",
    "name": "Go Guard Global",
    "description": "Go guard references global updated by output arc",
    "colorSets": [{"name": "INT", "type": "int"}],
    "places": [
      {"id": "p_src", "name": "Src", "colorSet": "INT"},
      {"id": "p_out", "name": "Out", "colorSet": "INT"}
    ],
    "transitions": [
      {
        "id": "t_guard",
        "name": "TGuard",
        "kind": "Auto",
        "scriptLanguage": "go",
        "guardFunction": "func G_t_guard_guard() bool {\n    return G_g < 10\n}",
        "actionFunction": "func T_t_guard_action(x C_INT) C_INT {\n    return x\n}"
      }
    ],
    "arcs": [
      {"id": "a_in", "sourceId": "p_src", "targetId": "t_guard", "expression": "x", "direction": "IN", "scriptLanguage": "go"},
      {"id": "a_out", "sourceId": "t_guard", "targetId": "p_out", "expression": "func A_a_out_expr() C_INT {\n    G_g = G_g + x\n    return G_g\n}", "direction": "OUT", "scriptLanguage": "go"}
    ],
    "initialMarking": {"Src": [{"value": 6, "timestamp": 0}, {"value": 7, "timestamp": 0}]}
  }'

# Generate and update script
curl -X POST ${FLOW_SVC}/api/cpn/scripts/go/go-scope-guard-global/generate
curl -X POST ${FLOW_SVC}/api/cpn/scripts/go/go-scope-guard-global \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "package workflow_test\n\ntype C_INT int\n\nvar G_g int\n\nfunc G_t_guard_guard() bool {\n    return G_g < 10\n}\n\nfunc T_t_guard_action(x C_INT) C_INT {\n    return x\n}\n\nfunc A_a_out_expr() C_INT {\n    G_g = G_g + x\n    return G_g\n}\n"
  }'

# Simulate first firing (should succeed)
curl -X POST "${FLOW_SVC}/api/simulation/step?id=go-scope-guard-global"
# Simulate second firing (should be blocked if g >= 10)
curl -X POST "${FLOW_SVC}/api/simulation/step?id=go-scope-guard-global"
curl -X GET "${FLOW_SVC}/api/marking/get?id=go-scope-guard-global"
```

##### 6. Input Arc Local Binding (Go Equivalent of Example 6)
```bash
# Load workflow with local binding in input arc
curl -X POST ${FLOW_SVC}/api/cpn/load \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "go-scope-input-local",
    "name": "Go Input Local",
    "description": "Local binding of Go input token",
    "colorSets": [{"name": "INT", "type": "int"}, {"name": "UNIT", "type": "unit"}],
    "places": [
      {"id": "p_in", "name": "In", "colorSet": "INT"},
      {"id": "p_mid", "name": "Mid", "colorSet": "UNIT"},
      {"id": "p_out", "name": "Out", "colorSet": "INT"}
    ],
    "transitions": [
      {"id": "t_local", "name": "LocalUse", "kind": "Auto", "scriptLanguage": "go"},
      {"id": "t_use", "name": "UseV", "kind": "Auto", "scriptLanguage": "go", "guardFunction": "func G_t_use_guard() bool {\n    return G_v == 0\n}"}
    ],
    "arcs": [
      {"id": "a_in", "sourceId": "p_in", "targetId": "t_local", "expression": "func A_a_in_expr(token interface{}) bool {\n    v := token.(C_INT)\n    return true\n}", "direction": "IN", "scriptLanguage": "go"},
      {"id": "a_mid", "sourceId": "t_local", "targetId": "p_mid", "expression": "func A_a_mid_expr() interface{} {\n    return struct{}{}\n}", "direction": "OUT", "scriptLanguage": "go"},
      {"id": "a_out_in", "sourceId": "p_mid", "targetId": "t_use", "expression": "func A_a_out_in_expr(token interface{}) bool {\n    return true\n}", "direction": "IN", "scriptLanguage": "go"},
      {"id": "a_out", "sourceId": "t_use", "targetId": "p_out", "expression": "func A_a_out_expr() C_INT {\n    return 0\n}", "direction": "OUT", "scriptLanguage": "go"}
    ],
    "initialMarking": {"In": [{"value": 42, "timestamp": 0}]}
  }'

# Generate and update script (v is local in arc, not global)
curl -X POST ${FLOW_SVC}/api/cpn/scripts/go/go-scope-input-local/generate
curl -X POST ${FLOW_SVC}/api/cpn/scripts/go/go-scope-input-local \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "package workflow_test\n\ntype C_INT int\n\ntype C_UNIT struct{}\n\nvar G_v int\n\nfunc A_a_in_expr(token interface{}) bool {\n    v := int(token.(C_INT))  // local v\n    return true\n}\n\nfunc A_a_mid_expr() interface{} {\n    return C_UNIT{}\n}\n\nfunc G_t_use_guard() bool {\n    return G_v == 0  // no global v set, so guard passes\n}\n\nfunc A_a_out_in_expr(token interface{}) bool {\n    return true\n}\n\nfunc A_a_out_expr() C_INT {\n    return 0\n}\n"
  }'

# Simulate (t_local fires, t_use should fire since no global v)
curl -X POST "${FLOW_SVC}/api/simulation/step?id=go-scope-input-local"
curl -X GET "${FLOW_SVC}/api/marking/get?id=go-scope-input-local"
```

##### 7. Adjacency Scoping: Place-ID and Arc-ID (Go Equivalent of Example 7)
```bash
# Load workflow using place-ID alias and arc-ID in guard
curl -X POST ${FLOW_SVC}/api/cpn/load \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "go-scope-adj-place-arc",
    "name": "Go Adjacency: place+arc",
    "description": "Use Go place-ID alias in IN arc and arc-ID in guard",
    "colorSets": [{"name": "INT", "type": "int"}, {"name": "JS", "type": "struct"}],
    "places": [
      {"id": "p_in", "name": "In", "colorSet": "JS"},
      {"id": "p_out", "name": "Out", "colorSet": "INT"}
    ],
    "transitions": [
      {
        "id": "t1",
        "name": "T1",
        "kind": "Auto",
        "scriptLanguage": "go",
        "guardFunction": "func G_t1_guard() bool {\n    return G_a_in == 7\n}",
        "variables": ["a_in"],
        "actionFunction": "func T_t1_action() C_INT {\n    return 7\n}"
      }
    ],
    "arcs": [
      {"id": "a_in", "sourceId": "p_in", "targetId": "t1", "expression": "func A_a_in_expr() C_INT {\n    return G_p_in.X\n}", "direction": "IN", "scriptLanguage": "go"},
      {"id": "a_out", "sourceId": "t1", "targetId": "p_out", "expression": "func A_a_out_expr() C_INT {\n    return 7\n}", "direction": "OUT", "scriptLanguage": "go"}
    ],
    "initialMarking": {"In": [{"value": {"X": 7}, "timestamp": 0}]}
  }'

# Note: Adjacency aliases need special handling in Go script generation
# The generator should create globals for adjacency access
curl -X POST ${FLOW_SVC}/api/cpn/scripts/go/go-scope-adj-place-arc/generate
# Manually update to include adjacency globals
curl -X POST ${FLOW_SVC}/api/cpn/scripts/go/go-scope-adj-place-arc \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "package workflow_test\n\ntype C_INT int\n\ntype C_JS struct {\n    X int `json:\"x\"`\n}\n\nvar G_a_in C_INT\nvar G_p_in C_JS\n\nfunc A_a_in_expr() C_INT {\n    G_p_in = token.(C_JS)  // place alias available during arc eval\n    G_a_in = G_p_in.X      // arc result stored in global\n    return G_a_in\n}\n\nfunc G_t1_guard() bool {\n    return G_a_in == 7\n}\n\nfunc T_t1_action() C_INT {\n    return 7\n}\n\nfunc A_a_out_expr() C_INT {\n    return 7\n}\n"
  }'

# Simulate and verify
curl -X POST "${FLOW_SVC}/api/simulation/step?id=go-scope-adj-place-arc"
curl -X GET "${FLOW_SVC}/api/marking/get?id=go-scope-adj-place-arc"
```

#### Action Expression API Tests (Equivalent to TEST-auto.md)

##### 1. Action Computing Derived Output (Go Equivalent of Example 1)
```bash
# Load workflow with Go action computing intermediate result
curl -X POST ${FLOW_SVC}/api/cpn/load \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "go-auto-act-1",
    "name": "Go Auto Action Demo",
    "description": "Go auto transition with actionExpression",
    "colorSets": [{"name": "INT", "type": "int"}],
    "places": [
      {"id": "p_in", "name": "In", "colorSet": "INT"},
      {"id": "p_out", "name": "Out", "colorSet": "INT"}
    ],
    "transitions": [
      {
        "id": "t_proc",
        "name": "Proc",
        "kind": "Auto",
        "scriptLanguage": "go",
        "actionFunction": "func T_t_proc_action(x C_INT) {\n    G_tmp = x * 10\n}"
      }
    ],
    "arcs": [
      {"id": "a_in", "sourceId": "p_in", "targetId": "t_proc", "expression": "x", "direction": "IN", "scriptLanguage": "go"},
      {"id": "a_out", "sourceId": "t_proc", "targetId": "p_out", "expression": "func A_a_out_expr() C_INT {\n    return G_tmp + 1\n}", "direction": "OUT", "scriptLanguage": "go"}
    ],
    "initialMarking": {"p_in": [{"value": 3, "timestamp": 0}]}
  }'

# Generate and update script
curl -X POST ${FLOW_SVC}/api/cpn/scripts/go/go-auto-act-1/generate
curl -X POST ${FLOW_SVC}/api/cpn/scripts/go/go-auto-act-1 \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "package workflow_test\n\ntype C_INT int\n\nvar G_tmp int\n\nfunc T_t_proc_action(x C_INT) {\n    G_tmp = x * 10\n}\n\nfunc A_a_out_expr() C_INT {\n    return G_tmp + 1\n}\n"
  }'

# Simulate and verify (expect Out value 31)
curl -X POST "${FLOW_SVC}/api/simulation/step?id=go-auto-act-1"
curl -X GET "${FLOW_SVC}/api/marking/get?id=go-auto-act-1"
```

##### 2. Action With Transition Delay (Go Equivalent of Example 2)
```bash
# Load workflow with delay and action referencing timestamps
curl -X POST ${FLOW_SVC}/api/cpn/load \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "go-auto-act-2",
    "name": "Go Action Delay",
    "description": "Go action executed after delay",
    "colorSets": [{"name": "INT", "type": "int"}],
    "places": [
      {"id": "p_in", "name": "In", "colorSet": "INT"},
      {"id": "p_out", "name": "Out", "colorSet": "INT"}
    ],
    "transitions": [
      {
        "id": "t_wait",
        "name": "WaitAndCompute",
        "kind": "Auto",
        "scriptLanguage": "go",
        "transitionDelay": 4,
        "actionFunction": "func T_t_wait_action(x C_INT, x_timestamp int64) {\n    G_tmp = (int(x) * 2) + int(G_global_clock)\n}"
      }
    ],
    "arcs": [
      {"id": "a_in", "sourceId": "p_in", "targetId": "t_wait", "expression": "x", "direction": "IN", "scriptLanguage": "go"},
      {"id": "a_out", "sourceId": "t_wait", "targetId": "p_out", "expression": "func A_a_out_expr() C_INT {\n    return C_INT(G_tmp)\n}", "direction": "OUT", "scriptLanguage": "go"}
    ],
    "initialMarking": {"p_in": [{"value": 5, "timestamp": 0}]}
  }'

# Generate and update script
curl -X POST ${FLOW_SVC}/api/cpn/scripts/go/go-auto-act-2/generate
curl -X POST ${FLOW_SVC}/api/cpn/scripts/go/go-auto-act-2 \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "package workflow_test\n\nimport \"time\"\n\ntype C_INT int\n\nvar G_tmp int\nvar G_global_clock int64\nvar G_x_timestamp int64\n\nfunc T_t_wait_action(x C_INT, x_timestamp int64) {\n    G_x_timestamp = x_timestamp\n    G_tmp = (int(x) * 2) + int(G_global_clock)\n}\n\nfunc A_a_out_expr() C_INT {\n    return C_INT(G_tmp)\n}\n"
  }'

# Simulate and verify (expect Out value 14 after 4 time units delay)
curl -X POST "${FLOW_SVC}/api/simulation/step?id=go-auto-act-2"
curl -X GET "${FLOW_SVC}/api/marking/get?id=go-auto-act-2"
```

##### 3. Multiple Inputs and Action Combining Them (Go Equivalent of Example 3)
```bash
# Load workflow combining multiple inputs in Go action
curl -X POST ${FLOW_SVC}/api/cpn/load \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "go-auto-act-3",
    "name": "Go Combine",
    "description": "Combine two Go inputs in action",
    "colorSets": [{"name": "INT", "type": "int"}],
    "places": [
      {"id": "p_a", "name": "A", "colorSet": "INT"},
      {"id": "p_b", "name": "B", "colorSet": "INT"},
      {"id": "p_out", "name": "Out", "colorSet": "INT"}
    ],
    "transitions": [
      {
        "id": "t_add",
        "name": "Add",
        "kind": "Auto",
        "scriptLanguage": "go",
        "actionFunction": "func T_t_add_action(a C_INT, b C_INT) {\n    G_sum = int(a) + int(b)\n}"
      }
    ],
    "arcs": [
      {"id": "a_in1", "sourceId": "p_a", "targetId": "t_add", "expression": "a", "direction": "IN", "scriptLanguage": "go"},
      {"id": "a_in2", "sourceId": "p_b", "targetId": "t_add", "expression": "b", "direction": "IN", "scriptLanguage": "go"},
      {"id": "a_out", "sourceId": "t_add", "targetId": "p_out", "expression": "func A_a_out_expr() C_INT {\n    return C_INT(G_sum)\n}", "direction": "OUT", "scriptLanguage": "go"}
    ],
    "initialMarking": {"p_a": [{"value": 2, "timestamp": 0}], "p_b": [{"value": 7, "timestamp": 0}]}
  }'

# Generate and update script
curl -X POST ${FLOW_SVC}/api/cpn/scripts/go/go-auto-act-3/generate
curl -X POST ${FLOW_SVC}/api/cpn/scripts/go/go-auto-act-3 \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "package workflow_test\n\ntype C_INT int\n\nvar G_sum int\n\nfunc T_t_add_action(a C_INT, b C_INT) {\n    G_sum = int(a) + int(b)\n}\n\nfunc A_a_out_expr() C_INT {\n    return C_INT(G_sum)\n}\n"
  }'

# Simulate and verify (expect Out value 9)
curl -X POST "${FLOW_SVC}/api/simulation/step?id=go-auto-act-3"
curl -X GET "${FLOW_SVC}/api/marking/get?id=go-auto-act-3"
```

#### Validation Tests
```bash
# Validate all Go scripting workflows
curl -X GET "${FLOW_SVC}/api/cpn/validate?id=go-scope-arc-local"
curl -X GET "${FLOW_SVC}/api/cpn/validate?id=go-auto-act-1"
# ... validate other test workflows
```

## 7. Migration Path from Lua and Decommissioning Plan

### 7.1. Gradual Migration Strategy

1. **Keep existing Lua transitions**
   - Set `scriptLanguage: "lua"` (default)
   - No changes needed for backward compatibility

2. **Add Go transitions incrementally**
   - Set `scriptLanguage: "go"` on new transitions
   - Generate Go script stubs
   - Implement Go functions
   - Test Go functionality alongside Lua

3. **Mixed workflows during transition**
   - Engine routes to correct interpreter based on `scriptLanguage`
   - Both languages coexist
   - Shared marking/token data via JSON serialization

### 7.2. Lua Decommissioning Plan

Once Go scripting proves stable and feature-complete (target: after Phase 5 testing and 3 months of production use), we will decommission Lua scripting to simplify the codebase and reduce maintenance overhead.

#### Timeline
- **Phase 6 (Week 6+)**: Begin deprecation warnings in logs and API responses for Lua transitions
- **Phase 7 (Month 4)**: Automatic migration tool converts simple Lua transitions to Go equivalents
- **Phase 8 (Month 6)**: Remove Lua runtime dependencies, disable Lua transitions in new workflows
- **Phase 9 (Month 9)**: Full removal of Lua code, update documentation

#### Decommissioning Steps

1. **Deprecation Phase (Months 1-3)**
   - Add deprecation warnings to Lua-related API endpoints
   - Log warnings when Lua transitions fire
   - Update UI to highlight Lua transitions as "legacy"
   - Provide migration guides and tools

2. **Migration Phase (Months 4-6)**
   - Develop automated Lua-to-Go converter for common patterns:
     - Simple arithmetic expressions
     - Basic control flow (if/then/else)
     - Function calls and variable assignments
   - Manual migration for complex Lua scripts
   - Test migrated workflows thoroughly
   - Update existing workflow templates to use Go

3. **Removal Phase (Months 7-9)**
   - Remove Lua runtime (gopher-lua dependency)
   - Delete Lua-related code paths in engine
   - Remove Lua API endpoints
   - Update documentation to remove Lua references
   - Archive Lua test cases for historical reference

#### Automated Migration Tool

```go
// internal/script/migration/lua_to_go.go
type LuaToGoMigrator struct {
    luaParser *lua.Parser
    goGenerator *go.ScriptGenerator
}

func (m *LuaToGoMigrator) MigrateTransition(transition *models.Transition) (*models.Transition, error) {
    // Parse Lua actionExpression
    luaAST, err := m.luaParser.Parse(transition.ActionExpression)
    if err != nil {
        return nil, fmt.Errorf("cannot parse Lua: %w", err)
    }
    
    // Convert to Go equivalent
    goCode, err := m.convertLuaToGo(luaAST)
    if err != nil {
        return nil, fmt.Errorf("conversion failed: %w", err)
    }
    
    // Update transition
    transition.ScriptLanguage = "go"
    transition.ActionFunction = goCode
    // Set other Go-specific fields
    
    return transition, nil
}

func (m *LuaToGoMigrator) convertLuaToGo(luaAST *lua.AST) (string, error) {
    // Implement conversion logic for common patterns:
    // - Variable assignments: x = y -> x = y
    // - Arithmetic: x + y -> x + y
    // - Function calls: math.abs(x) -> math.Abs(x)
    // - Control flow: if x > 0 then return x end -> if x > 0 { return x }
    // Return error for unsupported constructs
}
```

#### Risk Mitigation

- **Data Loss**: Backup all Lua scripts before migration
- **Functionality Gaps**: Ensure Go scripting covers all Lua use cases before decommissioning
- **Performance Regression**: Benchmark Go vs Lua performance during testing
- **User Impact**: Provide clear migration timelines and support
- **Rollback Plan**: Keep Lua code in separate branch for emergency rollback

#### Benefits of Decommissioning

- **Reduced Complexity**: Single scripting language simplifies codebase
- **Better Performance**: Go plugins are faster and more memory-efficient than Lua VM
- **Type Safety**: Compile-time type checking prevents runtime errors
- **Ecosystem**: Leverage Go's rich standard library and tooling
- **Maintainability**: Fewer dependencies and language-specific code paths

#### Success Criteria

- All existing workflows successfully migrated to Go
- No Lua transitions in production for 3 months
- Performance benchmarks show Go >= Lua performance
- Zero Lua-related bugs reported for 6 months
- Developer feedback confirms Go scripting superiority

### 7.3. Lua to Go Converter (Future Enhancement)

For complex migrations, provide a best-effort converter:

```go
func ConvertLuaToGo(luaCode string) (string, error) {
    // Parse Lua AST
    // Map to equivalent Go constructs
    // Generate Go function with warnings for unsupported features
    // Return converted code or error
}
```

## 8. References
- See `docs/goDesign/LUA.md` for Lua integration and inscription conventions.
- See `docs/goDesign/EmbedGoGrok.md` for GoNB-inspired architecture and plugin/AST management.
- See `docs/tests/TEST-varscope.md` and `docs/tests/TEST-auto.md` for variable scope and action semantics.
- Go plugin documentation: https://pkg.go.dev/plugin
- Go AST manipulation: https://pkg.go.dev/go/ast
- Reflection API: https://pkg.go.dev/reflect
