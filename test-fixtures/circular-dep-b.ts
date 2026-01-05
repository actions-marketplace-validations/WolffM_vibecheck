/**
 * Circular Dependency - Module B
 * Creates a circular dependency with circular-dep-a.ts
 */

import { functionA, valueA } from './circular-dep-a.js';

export const valueB = 'Value from module B';

export function functionB(): string {
  // Uses something from A, which imports from B
  return `B says: ${functionA()} and valueA is ${valueA}`;
}

// Immediately invoke to trigger the circular dep
console.log('Module B loaded');
