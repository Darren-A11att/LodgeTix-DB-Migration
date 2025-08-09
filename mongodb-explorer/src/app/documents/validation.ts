export class ValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'ValidationError'; }
}

export function requireString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${field} must be a non-empty string`);
  }
}

export function requireNumber(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new ValidationError(`${field} must be a valid number`);
  }
}

export function requireNonNegativeNumber(value: unknown, field: string): asserts value is number {
  requireNumber(value, field);
  if ((value as number) < 0) throw new ValidationError(`${field} must be >= 0`);
}

export function requireArrayNonEmpty<T>(value: unknown, field: string): asserts value is T[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ValidationError(`${field} must be a non-empty array`);
  }
}

