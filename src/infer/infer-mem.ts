import { Context } from "./context";
import { InferResult } from "./infer-types";
import * as tt from "./type-types";
import * as st from "./syntax-types";
import * as tb from "./type-builders";
import * as util from "./util";

export const inferMem = (
  infer: (expr: st.Expr, ctx: Context) => InferResult,
  expr: st.EMem,
  ctx: Context
): InferResult => {
  const { object, property } = expr;

  const [obj_type, obj_cs] = infer(object, ctx);
  const [prop_type, prop_cs] = typeOfPropertyOnType(obj_type, property, ctx);

  return [unwrapMem(prop_type), [...obj_cs, ...prop_cs]];
};

const typeOfPropertyOnType = (
  type: tt.Type,
  property: st.EIdent | st.ELit<st.LNum> | st.ELit<st.LStr>,
  ctx: Context
): InferResult => {
  switch (type.__type) {
    case "TVar": {
      const tobj = util.fresh(ctx);
      const tMem1 = tb.tmem(tobj, unwrapProperty(property), ctx);
      const tMem2 = tb.tmem(type, unwrapProperty(property), ctx);

      // This is sufficient since inferTMem() will unify `tobj` with `type`.
      return [tMem2, [{ types: [tMem1, tMem2], subtype: false }]];
    }
    case "TRec": {
      if (!isIdent(property)) {
        throw new Error(
          "property must be an identifier when accessing a member on a record"
        );
      }

      const tobj = util.fresh(ctx);
      const tMem1 = tb.tmem(tobj, unwrapProperty(property), ctx);
      const tMem2 = tb.tmem(type, unwrapProperty(property), ctx);
      const prop = type.properties.find((prop) => property.name === prop.name);

      if (!prop) {
        throw new Error(
          `Record literal doesn't contain property '${property.name}'`
        );
      }

      return [tMem2, [{ types: [tMem1, tMem2], subtype: false }]];
    }
    case "TTuple": {
      // TODO: Get the type of the property, e.g. is a String/StrLit vs.
      // Number/NumLit.  This is necessary when using expressions as properties.
      if (isIdent(property)) {
        const aliasedScheme = ctx.env.get("Array");
        // TODO: determine what the type parameter should be for Array<T>
        // So that we can handle things like .map and .filter properly.
        // It would be really nice if .map could maintain the length of
        // the tuple.

        if (!aliasedScheme) {
          throw new Error("Couldn't find definition for 'Array'");
        }

        if (!tt.isTRec(aliasedScheme.type)) {
          throw new Error("Array type definition should be a record");
        }

        // Removes redundant types from the union
        const typeArg = util.simplifyUnion(tb.tunion(type.types, ctx), ctx);
        const aliasedType = util.replaceQualifiers(aliasedScheme, [typeArg], ctx);

        try {
          return typeOfPropertyOnType(aliasedType, property, ctx);
        } catch (e) {
          throw new Error(`Couldn't find ${property.name} on array`);
        }
      } else if (isNumLit(property)) {
        const tobj = util.fresh(ctx);
        const tMem1 = tb.tmem(tobj, unwrapProperty(property), ctx);
        const tMem2 = tb.tmem(type, unwrapProperty(property), ctx);

        if (property.value.value >= type.types.length) {
          throw new Error("index is greater than the size of the tuple");
        }

        return [tMem2, [{ types: [tMem1, tMem2], subtype: false }]];
      } else {
        throw new Error(
          "property must be a number when accessing an index on a tuple"
        );
      }
    }
    case "TPrim":
    case "TLit": {
      const primName = getPrimName(type);
      const newType = util.lookupEnv(primName, ctx);

      // TODO: write some tests where like "hello"[0] to see what happens.
      try {
        return typeOfPropertyOnType(newType, property, ctx);
      } catch (e) {
        throw new Error(
          `${unwrapProperty(property)} property doesn't exist on ${primName}`
        );
      }
    }
    case "TGen": {
      const aliasedScheme = ctx.env.get(type.name);
      if (!aliasedScheme) {
        throw new Error(`No type named ${type.name} in environment`);
      }

      if (aliasedScheme.qualifiers.length !== type.params.length) {
        throw new Error(
          `${type.name} was given the wrong number of type params`
        );
      }

      // If we're trying to access an element on an Array it's possible that
      // an element doesn't exist at the desired index.  To reflect this, we
      // extend the type to be `T | undefined`.
      if (type.name === "Array" && isNumLit(property)) {
        const resultType = util.simplifyUnion(
          tb.tunion(
            [type.params[0], tb.tlit({ __type: "LUndefined" }, ctx)],
            ctx
          ),
          ctx
        );
        return [resultType, []];
      }

      const aliasedType = util.replaceQualifiers(aliasedScheme, type.params, ctx);

      return typeOfPropertyOnType(aliasedType, property, ctx);
    }
    case "TFun": {
      // This is to handle things like .toString() on functions.  Not sure if
      // this will help with callables or not.
      // TODO: handle (() => {}).toString() by looking up the scheme for Function
      throw new Error("TODO: handle member access on function");
    }
    case "TMem": {
      // It looks like we're handling this already, look at constraint-solver
      // for clues.  It would be nice to have member access on all types handled
      // in the same place.
      throw new Error("TODO: handle member access on a member access");
    }
    case "TUnion": {
      // Get the type of the property on each member of the union.  If
      // the property doesn't exist then the type should be undefined.
      // We should do the same for TRec.  We can track the error will
      // still allowing type inference to continue.
      throw new Error("TODO: handle member access on a union");
    }
    default:
      util.assertUnreachable(type);
  }
};

const unwrapMem = (type: tt.Type): tt.Type => {
  if (tt.isTMem(type)) {
    if (tt.isTRec(type.object)) {
      const prop = type.object.properties.find((p) => p.name === type.property);
      if (prop) {
        return unwrapMem(prop.type);
      }
    } else if (tt.isTTuple(type.object)) {
      const elemType = type.object.types.find(
        (p, index) => index === type.property
      );
      if (elemType) {
        return unwrapMem(elemType);
      }
    }
  }

  return type;
};

const unwrapProperty = (
  property: st.EIdent | st.ELit<st.LNum> | st.ELit<st.LStr>
): number | string => {
  if (isIdent(property)) {
    return property.name;
  } else if (isStrLit(property)) {
    return property.value.value;
  } else {
    return property.value.value;
  }
};

const isNumLit = (e: st.Expr): e is st.ELit<st.LNum> =>
  e.__type === "ELit" && e.value.__type === "LNum";
const isStrLit = (e: st.Expr): e is st.ELit<st.LStr> =>
  e.__type === "ELit" && e.value.__type === "LStr";
const isIdent = (e: st.Expr): e is st.EIdent => e.__type === "EIdent";

const getPrimName = (type: tt.TPrim | tt.TLit): tt.PrimName => {
  if (tt.isTPrim(type)) {
    return type.name;
  } else {
    switch (type.value.__type) {
      case "LNum":
        return "number";
      case "LStr":
        return "string";
      case "LBool":
        return "boolean";
      case "LNull":
        return "null";
      case "LUndefined":
        return "undefined";
    }
  }
};
