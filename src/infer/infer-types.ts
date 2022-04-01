import * as tt from "./type-types";

export type InferResult<T extends tt.Type = tt.Type> = readonly [
  T,
  readonly tt.Constraint[]
];
