/**
 * Custom errors
 */

export class InferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InferenceError";
  }

  toString(): string {
    return `${this.name}: ${this.message}`;
  }
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }

  toString(): string {
    return `${this.name}: ${this.message}`;
  }
}
