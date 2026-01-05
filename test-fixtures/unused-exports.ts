/**
 * Unused Exports - Knip Detection
 * These exports are never imported anywhere
 */

// Unused exported function
export function neverUsedFunction(): string {
  return 'I am exported but never imported anywhere';
}

// Unused exported class
export class NeverUsedClass {
  private value: number;

  constructor(value: number) {
    this.value = value;
  }

  getValue(): number {
    return this.value;
  }
}

// Unused exported constant
export const NEVER_USED_CONSTANT = 42;

// Unused exported type
export type NeverUsedType = {
  id: string;
  name: string;
  unused: boolean;
};

// Unused exported interface
export interface NeverUsedInterface {
  property1: string;
  property2: number;
}

// Unused exported enum
export enum NeverUsedEnum {
  OPTION_A = 'a',
  OPTION_B = 'b',
  OPTION_C = 'c',
}
