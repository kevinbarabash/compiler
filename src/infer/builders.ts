import * as t from "./types";
import { getId } from "./core";

const lBool = (value: boolean): t.LBool => {
  return { t: "LBool", value };
};

const lNum = (value: number): t.LNum => {
  return { t: "LNum", value };
};

const lStr = (value: string): t.LStr => {
  return { t: "LStr", value };
};

const tLit = (literal: t.Literal): t.TLiteral => {
  return { t: "TLit", literal };
};

export const tBool = (value: boolean): t.TLiteral => {
  return tLit(lBool(value));
};

export const tNum = (value: number): t.TLiteral => {
  return tLit(lNum(value));
};

export const tStr = (value: string): t.TLiteral => {
  return tLit(lStr(value));
};

export const tVar = (): t.TVar => {
  return { t: "TVar", id: getId() };
};

export const tCon = (
  name: string,
  typeArgs: readonly t.Type[] = []
): t.TCon => {
  return { t: "TCon", name, typeArgs };
};

export const tFun = (
  paramTypes: readonly t.TParam[],
  retType: t.Type
): t.TFun => {
  return { t: "TFun", paramTypes, retType };
};

export const tRec = (...properties: readonly t.TProp[]): t.TRec => {
  return { t: "TRec", properties };
};

export const tProp = (
  name: string,
  type: t.Type,
  optional = false // TODO: make this an enum instead
): t.TProp => {
  return { t: "TProp", name, type, optional };
};

export const tParam = (
  name: string,
  type: t.Type,
  optional = false
): t.TParam => {
  return { t: "TParam", name, type, optional };
};

export const tTuple = (...types: readonly t.Type[]): t.TTuple => {
  return { t: "TTuple", types };
};

export const tUnion = (...types: readonly t.Type[]): t.TUnion => {
  return { t: "TUnion", types };
};
