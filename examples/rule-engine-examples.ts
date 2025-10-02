/**
 * Example rules for testing the dynamic form rule engine
 */

import type { FieldRule } from '@/lib/rule-engine';

// Example 1: Show/hide field based on checkbox
export const conditionalVisibilityRules: FieldRule[] = [
  {
    id: 'show-advanced-options',
    description: 'Show advanced options when checkbox is checked',
    condition: {
      type: 'equals',
      field: 'showAdvanced',
      value: true
    },
    action: {
      type: 'visibility',
      field: 'advancedOptions',
      visible: true
    }
  },
  {
    id: 'hide-advanced-options',
    description: 'Hide advanced options when checkbox is unchecked',
    condition: {
      type: 'equals',
      field: 'showAdvanced',
      value: false
    },
    action: {
      type: 'visibility',
      field: 'advancedOptions',
      visible: false
    }
  }
];

// Example 2: Enable/disable field based on selection
export const conditionalEnableRules: FieldRule[] = [
  {
    id: 'enable-custom-value',
    description: 'Enable custom value input when "custom" is selected',
    condition: {
      type: 'equals',
      field: 'valueType',
      value: 'custom'
    },
    action: {
      type: 'enabled',
      field: 'customValue',
      enabled: true
    }
  },
  {
    id: 'disable-custom-value',
    description: 'Disable custom value input when preset is selected',
    condition: {
      type: 'or',
      conditions: [
        { type: 'equals', field: 'valueType', value: 'preset1' },
        { type: 'equals', field: 'valueType', value: 'preset2' },
        { type: 'equals', field: 'valueType', value: 'preset3' }
      ]
    },
    action: {
      type: 'enabled',
      field: 'customValue',
      enabled: false
    }
  }
];

// Example 3: Dynamic schema modification - change enum options
export const dynamicSchemaRules: FieldRule[] = [
  {
    id: 'country-city-options-us',
    description: 'Update city options based on selected country (US)',
    condition: {
      type: 'equals',
      field: 'country',
      value: 'US'
    },
    action: {
      type: 'schema',
      field: 'city',
      schemaUpdates: {
        enum: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix']
      }
    }
  },
  {
    id: 'country-city-options-canada',
    description: 'Update city options for Canada',
    condition: {
      type: 'equals',
      field: 'country',
      value: 'CA'
    },
    action: {
      type: 'schema',
      field: 'city',
      schemaUpdates: {
        enum: ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa']
      }
    }
  }
];

// Example 4: Complex multi-condition rules
export const complexRules: FieldRule[] = [
  {
    id: 'shipping-address-visibility',
    description: 'Show shipping address when different from billing and shipping required',
    condition: {
      type: 'and',
      conditions: [
        { type: 'equals', field: 'sameAsBilling', value: false },
        { type: 'equals', field: 'requiresShipping', value: true }
      ]
    },
    action: {
      type: 'visibility',
      field: 'shippingAddress',
      visible: true
    }
  },
  {
    id: 'shipping-address-required',
    description: 'Make shipping address required when different from billing',
    condition: {
      type: 'and',
      conditions: [
        { type: 'equals', field: 'sameAsBilling', value: false },
        { type: 'equals', field: 'requiresShipping', value: true }
      ]
    },
    action: {
      type: 'schema',
      field: 'shippingAddress',
      schemaUpdates: {
        required: true
      }
    }
  }
];

// Example 5: Numeric range rules
export const numericRangeRules: FieldRule[] = [
  {
    id: 'discount-percentage-range-manager',
    description: 'Set discount percentage range based on user role (manager)',
    condition: {
      type: 'equals',
      field: 'userRole',
      value: 'manager'
    },
    action: {
      type: 'schema',
      field: 'discountPercentage',
      schemaUpdates: {
        minimum: 0,
        maximum: 50
      }
    }
  },
  {
    id: 'discount-percentage-range-admin',
    description: 'Set higher discount range for admin',
    condition: {
      type: 'equals',
      field: 'userRole',
      value: 'admin'
    },
    action: {
      type: 'schema',
      field: 'discountPercentage',
      schemaUpdates: {
        minimum: 0,
        maximum: 100
      }
    }
  }
];

// Combined example for testing
export const testFormRules: FieldRule[] = [
  ...conditionalVisibilityRules,
  ...conditionalEnableRules,
  ...dynamicSchemaRules,
  ...complexRules,  
  ...numericRangeRules
];

// Example schema to use with the test rules
export const testFormSchema = {
  type: 'object',
  properties: {
    showAdvanced: {
      type: 'boolean',
      title: 'Show Advanced Options',
      default: false
    },
    advancedOptions: {
      type: 'string',
      title: 'Advanced Configuration',
      description: 'This field is shown/hidden based on the checkbox above'
    },
    valueType: {
      type: 'string',
      title: 'Value Type',
      enum: ['preset1', 'preset2', 'preset3', 'custom'],
      default: 'preset1'
    },
    customValue: {
      type: 'string',
      title: 'Custom Value',
      description: 'This field is enabled only when Custom is selected'
    },
    country: {
      type: 'string',
      title: 'Country',
      enum: ['US', 'CA', 'UK', 'AU'],
      default: 'US'
    },
    city: {
      type: 'string',
      title: 'City',
      enum: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'] // Default US cities
    },
    sameAsBilling: {
      type: 'boolean',
      title: 'Shipping same as billing address',
      default: true
    },
    requiresShipping: {
      type: 'boolean',
      title: 'Requires shipping',
      default: true
    },
    shippingAddress: {
      type: 'string',
      title: 'Shipping Address',
      description: 'Required when different from billing'
    },
    userRole: {
      type: 'string',
      title: 'User Role',
      enum: ['user', 'manager', 'admin'],
      default: 'user'
    },
    discountPercentage: {
      type: 'number',
      title: 'Discount Percentage',
      minimum: 0,
      maximum: 10, // Default range for regular users
      description: 'Range changes based on user role'
    }
  },
  required: ['country', 'valueType', 'userRole']
};