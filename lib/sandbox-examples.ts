/**
 * Example Scripts and Sandbox Testing Utilities
 * 
 * Collection of example user scripts and utilities for testing
 * the JavaScript sandbox system.
 */

import { globalSandbox, SandboxManager } from './script-sandbox'
import type { EventHandlerContext, InteractionEventPayload } from './component-interface'

/**
 * Example user scripts for testing
 */
export const ExampleScripts = {
  /**
   * Simple button click handler that shows loading state
   */
  buttonClickWithLoading: `
    // Show loading state immediately
    const loadingAction = createAction('SET_COMPONENT_LOADING', { 
      componentId: component.id, 
      loading: true 
    });
    
    // Set component loading state
    await component.callAction('setLoading', { loading: true, message: 'Processing...' });
    
    // Show notification
    app.showNotification('Button clicked! Processing...', 'info');
    
    // Log the event
    log('Button click processed', 'info');
    
    // Return actions to dispatch
    const result = {
      actions: [loadingAction],
      componentUpdates: {
        [component.id]: { loading: true }
      }
    };
  `,

  /**
   * Form validation script
   */
  formValidation: `
    // Get form data from event payload
    const formData = eventPayload.formData || {};
    const errors = [];
    
    // Validate required fields
    if (!formData.name || formData.name.trim() === '') {
      errors.push('Name is required');
    }
    
    if (!formData.email || !formData.email.includes('@')) {
      errors.push('Valid email is required');
    }
    
    // Show validation results
    if (errors.length > 0) {
      app.showNotification('Please fix validation errors', 'error');
      await component.callAction('setValidation', { 
        isValid: false, 
        errors,
        showErrors: true
      });
    } else {
      app.showNotification('Form is valid!', 'success');
      await component.callAction('setValidation', { 
        isValid: true, 
        errors: [],
        showErrors: false 
      });
    }
    
    const result = {
      actions: [{
        type: 'FORM_VALIDATION_COMPLETE',
        payload: { isValid: errors.length === 0, errors }
      }]
    };
  `,

  /**
   * Data fetching and display script
   */
  dataFetch: `
    try {
      // Show loading state
      await component.callAction('setLoading', { loading: true });
      
      // Fetch data
      const queryResult = await data.query('user-list');
      
      if (queryResult.error) {
        app.showNotification('Failed to load data: ' + queryResult.error, 'error');
        return;
      }
      
      // Update page state with data
      page.setState({
        users: queryResult.data,
        lastUpdated: now()
      });
      
      app.showNotification(\`Loaded \${queryResult.data.length} users\`, 'success');
      
      const result = {
        actions: [{
          type: 'DATA_LOADED',
          payload: { 
            data: queryResult.data,
            timestamp: now()
          }
        }]
      };
      
    } catch (error) {
      app.showNotification('Error: ' + error.message, 'error');
      log('Data fetch error: ' + error.message, 'error');
    } finally {
      await component.callAction('setLoading', { loading: false });
    }
  `,

  /**
   * Workflow trigger script
   */
  workflowTrigger: `
    // Prepare workflow payload
    const workflowPayload = {
      eventData: eventPayload,
      componentId: component.id,
      timestamp: now(),
      userInput: getProps().value || ''
    };
    
    try {
      // Show processing state
      await component.callAction('setLoading', { loading: true });
      app.showNotification('Triggering workflow...', 'info');
      
      // Call backend workflow
      const workflowResult = await app.callWorkflow('process-user-input', workflowPayload);
      
      if (workflowResult.success) {
        app.showNotification('Workflow completed successfully!', 'success');
        
        // Update UI with workflow results
        if (workflowResult.data) {
          page.setState({ workflowResult: workflowResult.data });
        }
      } else {
        app.showNotification('Workflow failed: ' + workflowResult.error, 'error');
      }
      
      const result = {
        actions: [{
          type: 'WORKFLOW_COMPLETED',
          payload: workflowResult
        }]
      };
      
    } catch (error) {
      app.showNotification('Workflow error: ' + error.message, 'error');
      log('Workflow error: ' + error.message, 'error');
    } finally {
      await component.callAction('setLoading', { loading: false });
    }
  `,

  /**
   * Navigation script
   */
  navigation: `
    // Get navigation target from component props or event
    const targetPath = getProps().navigationPath || eventPayload.path || '/dashboard';
    
    // Confirm navigation if needed
    const shouldNavigate = getProps().confirmNavigation ? 
      confirm('Are you sure you want to navigate?') : true;
    
    if (shouldNavigate) {
      // Log navigation
      log(\`Navigating to: \${targetPath}\`, 'info');
      
      // Show navigation feedback
      app.showNotification(\`Navigating to \${targetPath}...\`, 'info');
      
      // Perform navigation
      page.navigate(targetPath);
      
      const result = {
        actions: [{
          type: 'NAVIGATION_TRIGGERED',
          payload: { path: targetPath, timestamp: now() }
        }]
      };
    }
  `,

  /**
   * Complex state management script
   */
  stateManagement: `
    // Get current page state
    const currentState = page.getState();
    
    // Update counter or initialize
    const newCount = (currentState.clickCount || 0) + 1;
    
    // Update component appearance based on count
    if (newCount % 5 === 0) {
      await component.callAction('setStyle', {
        styles: { backgroundColor: 'gold', color: 'black' },
        merge: true
      });
      app.showNotification(\`Milestone reached: \${newCount} clicks!\`, 'success');
    } else {
      await component.callAction('setStyle', {
        styles: { backgroundColor: '', color: '' },
        merge: true
      });
    }
    
    // Update page state
    page.setState({
      ...currentState,
      clickCount: newCount,
      lastClick: now(),
      clickHistory: [...(currentState.clickHistory || []), {
        timestamp: now(),
        componentId: component.id
      }]
    });
    
    const result = {
      actions: [{
        type: 'CLICK_COUNTED',
        payload: { count: newCount, componentId: component.id }
      }]
    };
  `
}

/**
 * Mock event context for testing
 */
export function createMockEventContext(overrides?: Partial<EventHandlerContext>): EventHandlerContext {
  const mockContext: EventHandlerContext = {
    component: {
      id: 'test-component',
      type: 'button',
      getProps: () => ({ variant: 'default', children: 'Test Button' }),
      setProps: (props) => console.log('setProps:', props),
      emit: (event, payload) => console.log('emit:', event, payload),
      callAction: async (action, params) => {
        console.log('callAction:', action, params)
        return { success: true }
      }
    },
    data: {
      query: async (queryId) => {
        console.log('query:', queryId)
        return { data: [{ id: 1, name: 'Test User' }], loading: false }
      },
      mutate: async (mutation) => {
        console.log('mutate:', mutation)
        return { success: true }
      },
      subscribe: (callback) => {
        console.log('subscribe:', callback)
        return () => console.log('unsubscribe')
      }
    },
    page: {
      navigate: (path) => console.log('navigate:', path),
      getState: () => ({ test: true }),
      setState: (state) => console.log('setState:', state),
      dispatch: (action) => console.log('dispatch:', action)
    },
    app: {
      getGlobalState: () => ({ global: true }),
      setGlobalState: (state) => console.log('setGlobalState:', state),
      showNotification: (message, type) => console.log('notification:', message, type),
      callWorkflow: async (workflowId, payload) => {
        console.log('callWorkflow:', workflowId, payload)
        return { success: true, data: { result: 'test' } }
      }
    },
    utils: {
      formatDate: (date) => new Date(date).toISOString(),
      validateSchema: () => ({ valid: true }),
      debounce: (fn, delay) => fn,
      throttle: (fn, delay) => fn,
      log: (message, level) => console.log(`[${level}]`, message)
    },
    ...overrides
  }
  
  return mockContext
}

/**
 * Test runner for sandbox scripts
 */
export class SandboxTester {
  private sandbox: SandboxManager
  
  constructor(sandbox: SandboxManager = globalSandbox) {
    this.sandbox = sandbox
  }
  
  /**
   * Run a test script and return detailed results
   */
  async runTest(
    testName: string,
    script: string,
    eventPayload: any = {},
    contextOverrides?: Partial<EventHandlerContext>
  ) {
    console.group(`🧪 Testing: ${testName}`)
    
    const startTime = Date.now()
    const context = createMockEventContext(contextOverrides)
    
    try {
      // First validate syntax
      const validation = this.sandbox.validateScript(script)
      if (!validation.valid) {
        console.error('❌ Syntax Error:', validation.error)
        return { success: false, error: validation.error, executionTime: 0 }
      }
      
      console.log('✅ Syntax validation passed')
      
      // Execute script
      const result = await this.sandbox.executeScript(
        `test-${testName}`,
        script,
        context,
        eventPayload
      )
      
      const executionTime = Date.now() - startTime
      
      if (result.success) {
        console.log('✅ Execution successful')
        console.log('📊 Results:', result)
        console.log(`⏱️ Execution time: ${executionTime}ms`)
        
        if (result.logs && result.logs.length > 0) {
          console.log('📝 Script logs:')
          result.logs.forEach(log => {
            const emoji = { debug: '🐛', info: 'ℹ️', warn: '⚠️', error: '❌' }[log.level]
            console.log(`  ${emoji} ${log.message}`)
          })
        }
      } else {
        console.error('❌ Execution failed:', result.error)
        console.log(`⏱️ Failed after: ${executionTime}ms`)
      }
      
      return { ...result, executionTime }
    } catch (error) {
      const executionTime = Date.now() - startTime
      console.error('💥 Test crashed:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        executionTime 
      }
    } finally {
      console.groupEnd()
    }
  }
  
  /**
   * Run all example scripts as tests
   */
  async runAllTests() {
    console.log('🚀 Running all sandbox tests...')
    
    const results = []
    
    for (const [name, script] of Object.entries(ExampleScripts)) {
      const result = await this.runTest(name, script)
      results.push({ name, ...result })
    }
    
    console.group('📋 Test Summary')
    const passed = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length
    
    console.log(`✅ Passed: ${passed}`)
    console.log(`❌ Failed: ${failed}`)
    console.log(`📈 Success rate: ${Math.round((passed / results.length) * 100)}%`)
    
    const avgExecutionTime = results.reduce((acc, r) => acc + r.executionTime, 0) / results.length
    console.log(`⏱️ Average execution time: ${avgExecutionTime.toFixed(2)}ms`)
    
    console.groupEnd()
    
    return results
  }
}

/**
 * Development utility to test sandbox
 */
export function testSandbox() {
  const tester = new SandboxTester()
  return tester.runAllTests()
}

/**
 * Quick test function for individual scripts
 */
export async function quickTest(scriptName: keyof typeof ExampleScripts, eventPayload?: any) {
  const tester = new SandboxTester()
  const script = ExampleScripts[scriptName]
  return await tester.runTest(scriptName, script, eventPayload)
}