import * as tb from "./type-builders";
import { Context } from "./context";
import { Expr, Literal } from "./syntax-types";
import * as t from "./type-types";
import { inferExpr } from "./infer";

export class Engine {
  ctx: Context;

  constructor() {
    this.ctx = tb.createCtx();
  }

  inferExpr(expr: Expr): t.Scheme {
    return inferExpr(this.ctx.env, expr, this.ctx.state);
  }

  inferDecl(name: string, expr: Expr): t.Scheme {
    const result = inferExpr(this.ctx.env, expr, this.ctx.state);
    this.ctx.env = this.ctx.env.set(name, result);
    return result;
  }

  defScheme(name: string, scheme: t.Scheme) {
    t.freeze(scheme.type);
    this.ctx.env = this.ctx.env.set(name, scheme);
  }

  defType(name: string, type: t.Type) {
    this.defScheme(name, t.scheme([], type));
  }

  tvar(name: string) {
    return tb.tvar(name, this.ctx);
  }

  tgen(name: string, params: readonly t.Type[]) {
    return tb.tgen(name, params, this.ctx);
  }

  tfun(args: readonly t.Type[], ret: t.Type, vardiaic?: boolean) {
    return tb.tfun(args, ret, this.ctx, vardiaic);
  }

  tunion(types: readonly t.Type[]) {
    return tb.tunion(types, this.ctx);
  }

  ttuple(types: readonly t.Type[]) {
    return tb.ttuple(types, this.ctx);
  }

  trec(properties: readonly t.TProp[]) {
    return tb.trec(properties, this.ctx);
  }

  tprop(name: string, type: t.Type) {
    return tb.tprop(name, type);
  }

  tmem(object: t.Type, property: string | number) {
    return tb.tmem(object, property, this.ctx);
  }

  tprim(name: t.PrimName) {
    return tb.tprim(name, this.ctx);
  }

  tNum() {
    return tb.tNum(this.ctx);
  }

  tStr() {
    return tb.tStr(this.ctx);
  }

  tBool() {
    return tb.tBool(this.ctx);
  }

  tlit(lit: Literal) {
    return tb.tlit(lit, this.ctx);
  }
}
