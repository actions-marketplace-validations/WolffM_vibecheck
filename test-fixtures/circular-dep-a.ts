/**
 * Circular Dependency - Module A
 * Creates a circular dependency with circular-dep-b.ts
 */

import { functionB, valueB } from './circular-dep-b.js';

export const valueA = 'Value from module A';

export function functionA(): string {
  // Uses something from B, which imports from A
  return `A says: ${functionB()} and valueB is ${valueB}`;
}

// Immediately invoke to trigger the circular dep
console.log('Module A loaded');
