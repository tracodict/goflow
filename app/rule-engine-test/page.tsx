/**
 * Test page for rule engine integration with DynamicForm
 */
'use client';

import React from 'react';
import { PageBuilderDynamicForm } from '@/vComponents/DynamicForm/PageBuilderDynamicForm';
import { schemaRegistry } from '@/lib/schema-registry';
import { testFormSchema, testFormRules } from '@/examples/rule-engine-examples';

export default function RuleEngineTestPage() {
  // Register test schema
  React.useEffect(() => {
    schemaRegistry.register({
      id: 'test-rule-form',
      version: '1.0',
      name: 'Test Rule Form',
      description: 'Test form for rule engine functionality',
      schema: testFormSchema,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }, []);

  const [formData, setFormData] = React.useState<any>({});

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Rule Engine Test Form</h1>
      
      <div className="mb-4 p-4 bg-blue-50 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Test Rules:</h2>
        <ul className="text-sm space-y-1">
          <li>• Check "Show Advanced Options" to reveal/hide the advanced field</li>
          <li>• Select "Custom" in Value Type to enable the custom value input</li>
          <li>• Change Country to see different city options (US/Canada)</li>
          <li>• Uncheck "Shipping same as billing" and check "Requires shipping" to show shipping address</li>
          <li>• Change User Role to see different discount percentage ranges</li>
        </ul>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-lg font-semibold mb-4">Form with Rules</h2>
          <PageBuilderDynamicForm
            data-schema-id="test-rule-form"
            data-rules={JSON.stringify(testFormRules)}
            data-initial-value={JSON.stringify(formData)}
            onChange={setFormData}
            onSubmit={(data) => {
              console.log('Form submitted:', data);
              alert('Form submitted! Check console for data.');
            }}
            style={{ border: '1px solid #e5e7eb', padding: '1rem', borderRadius: '0.5rem' }}
          />
        </div>
        
        <div>
          <h2 className="text-lg font-semibold mb-4">Current Form Data</h2>
          <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-auto max-h-96">
            {JSON.stringify(formData, null, 2)}
          </pre>
          
          <div className="mt-4">
            <h3 className="text-md font-semibold mb-2">Rule Conditions Status</h3>
            <div className="text-sm space-y-1 bg-gray-50 p-3 rounded">
              <div>Show Advanced: {formData.showAdvanced ? '✅ True' : '❌ False'}</div>
              <div>Value Type: {formData.valueType || 'preset1'}</div>
              <div>Country: {formData.country || 'US'}</div>
              <div>Same as Billing: {formData.sameAsBilling !== false ? '✅ True' : '❌ False'}</div>
              <div>Requires Shipping: {formData.requiresShipping !== false ? '✅ True' : '❌ False'}</div>
              <div>User Role: {formData.userRole || 'user'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}