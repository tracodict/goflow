// Quick debug script to test localStorage persistence
console.log('=== Testing localStorage persistence ===');

// Test saved queries
const savedQueriesKey = 'goflow.savedQueries';
const queryStateKey = 'gf.queryState';

console.log('Saved queries:', localStorage.getItem(savedQueriesKey));
console.log('Query state:', localStorage.getItem(queryStateKey));

// Clear all
localStorage.removeItem(savedQueriesKey);
localStorage.removeItem(queryStateKey);

console.log('After clearing:');
console.log('Saved queries:', localStorage.getItem(savedQueriesKey));
console.log('Query state:', localStorage.getItem(queryStateKey));

// Test setting some data
const testQuery = {
  id: 'test-123',
  name: 'Test Query',
  type: 'mongo',
  datasourceId: 'ds-1',
  content: '[{"$limit": 10}]',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const testState = {
  mongoInput: '[{"$limit": 5}]',
  sqlInput: 'SELECT * FROM users LIMIT 5',
  history: [{
    id: 'hist-1',
    datasourceId: 'ds-1', 
    engine: 'mongo',
    input: '[{"$limit": 5}]',
    started: Date.now(),
    durationMs: 100
  }],
  collection: 'users',
  table: 'users'
};

localStorage.setItem(savedQueriesKey, JSON.stringify([testQuery]));
localStorage.setItem(queryStateKey, JSON.stringify(testState));

console.log('After setting test data:');
console.log('Saved queries:', localStorage.getItem(savedQueriesKey));
console.log('Query state:', localStorage.getItem(queryStateKey));