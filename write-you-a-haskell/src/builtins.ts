import { Context } from "./context";
import { Scheme, scheme, freeze } from "./type-types";
import * as tb from "./type-builders";

export const createArrayScheme = (ctx: Context): Scheme => {
    const tVar = tb.tvar("T", ctx);
    const uVar = tb.tvar("U", ctx);
    const sc = scheme(
      [tVar],
      tb.trec(
        [
          tb.tprop("length", tb.tprim("number", ctx)),
          tb.tprop(
            "map",
            // TODO: properties need to be able to accept Schemes
            // as well as types.
            tb.tfun(
              [
                tb.tfun(
                  [
                    tVar,
                    tb.tprim("number", ctx),
                    // TODO: how do we handle record types that
                    // reference themselves.
                    tb.tcon("Array", [tVar], ctx),
                  ],
                  uVar,
                  ctx,
                  // TODO: come up with better 'src' names
                  // perhaps 'use' is better than 'src'
                  // This could maybe be 'Param' or 'Arg'
                  "App", // why does this use "App"?
                ),
              ],
              tb.tcon("Array", [uVar], ctx),
              ctx,
              "Lam",
            )
          ),
        ],
        ctx
      )
    );
    freeze(sc.type);
    return sc;
  };
  