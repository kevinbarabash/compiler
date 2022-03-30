import fs from "fs";
import path from "path";
import { parse } from "@babel/parser";
import * as t from "@babel/types";

import { Engine } from "../infer/engine";
import { Context } from "../infer/context";
import * as tt from "../infer/type-types";
import * as tb from "../infer/type-builders";

export const readTypes = (): Engine => {
  const eng = new Engine();

  const src = fs.readFileSync(
    path.join(__dirname, "../../node_modules/typescript/lib/lib.es5.d.ts"),
    "utf-8"
  );

  const ast = parse(src, {
    plugins: [["typescript", { dts: true }]],
    sourceType: "module",
    strictMode: false,
  });

  for (const stmt of ast.program.body) {
    if (t.isTSInterfaceDeclaration(stmt)) {
      // TODO: handle interface merging
      const {name} = stmt.id;
      if (["String", "Number", "Boolean"].includes(name)) {
        try {
          const type = convert(stmt, eng.ctx);
          eng.defType(name.toLocaleLowerCase(), type);
        } catch (e) {
          // Ignores empty interfaces
          // console.log(e);
        }
      }
    } else if (t.isVariableDeclaration(stmt)) {
      // TODO: handle things like:
      // declare var Promise: PromiseContructor
    }
  }

  return eng;
};

// TODO: update to return a Scheme so that we can handle generic types
const convert = (node: t.Node, ctx: Context): tt.Type => {
  if (t.isTSTypeAnnotation(node)) {
    return convert(node.typeAnnotation, ctx);
  }
  if (t.isTSNumberKeyword(node)) {
    return tb.tprim("number", ctx);
  }
  if (t.isTSStringKeyword(node)) {
    return tb.tprim("string", ctx);
  }
  if (t.isTSNullKeyword(node)) {
    return tb.tprim("null", ctx);
  }
  if (t.isTSUndefinedKeyword(node)) {
    return tb.tprim("undefined", ctx);
  }
  if (t.isTSArrayType(node)) {
    return tb.tgen("Array", [convert(node.elementType, ctx)], ctx);
  }
  if (t.isTSUnionType(node)) {
    return tb.tunion(
      node.types.map((type) => convert(type, ctx)),
      ctx
    );
  }
  if (t.isTSFunctionType(node)) {
    // TODO: handle parametric methods with typeParameters
    let variadic = false;
    const paramTypes = node.parameters.map((param) => {
      if (t.isIdentifier(param)) {
        // @ts-expect-error: typeAnnotation is optional
        return convert(param.typeAnnotation, ctx);
      } else {
        variadic = true;
        // @ts-expect-error: typeAnnotation is optional
        return convert(param.typeAnnotation, ctx);
      }
    });
    return tb.tfun(
      paramTypes,
      // @ts-expect-error: typeAnnotation is optional
      convert(node.typeAnnotation, ctx),
      ctx,
      variadic
    );
  }
  if (t.isTSTypeReference(node)) {
    // @ts-expect-error: typeParameters is optional
    const params = (node.typeParameters ?? []).map((param) =>
      convert(param, ctx)
    );
    if (t.isIdentifier(node.typeName)) {
      return tb.tgen(
        node.typeName.name,
        params,
        ctx
      );
    } else if (t.isTSQualifiedName(node.typeName)) {
      throw new Error("TODO: figure out how to TSQualifiedName as a tt.Type");
      // const {left, right} = node.typeName;
      // return tb.tgen(
      //   // TODO: handle nested qualified type names
      //   // TODO: figure how to represent this as a tt.Type
      //   `${left.name}.${right.name}`,
      //   params,
      //   ctx
      // );
    }
  }
  if (t.isTSAnyKeyword(node)) {
    // TODO: convert this to `unknown`
    return tb.tvar("a", ctx);
  }
  if (t.isTSInterfaceDeclaration(node)) {
    const props: tt.TProp[] = [];
    for (const child of node.body.body) {
      switch (child.type) {
        case "TSCallSignatureDeclaration": {
          // TODO
          break;
        }
        case "TSConstructSignatureDeclaration": {
          // TODO
          break;
        }
        case "TSIndexSignature": {
          // TODO
          break;
        }
        case "TSMethodSignature": {
          if (t.isIdentifier(child.key)) {
            try {
              // TODO: handle parametric methods with typeParameters
              let variadic = false;
              const paramTypes = child.parameters.map((param) => {
                if (t.isIdentifier(param)) {
                  // @ts-expect-error: typeAnnotation is optional
                  return convert(param.typeAnnotation, ctx);
                } else {
                  variadic = true;
                  // @ts-expect-error: typeAnnotation is optional
                  return convert(param.typeAnnotation, ctx);
                }
              });
              const methodType = tb.tfun(
                paramTypes,
                // @ts-expect-error: typeAnnotation is optional
                convert(child.typeAnnotation, ctx),
                ctx,
                variadic
              );
              props.push(tb.tprop(child.key.name, methodType));
            } catch (e) {
              console.log(e);
            }
          }
          break;
        }
        case "TSPropertySignature": {
          if (t.isIdentifier(child.key)) {
            props.push(
              // @ts-expect-error: typeAnnotation is optional
              tb.tprop(child.key.name, convert(child.typeAnnotation, ctx))
            );
          }
          break;
        }
      }
    }
    if (props.length > 0) {
      return tb.trec(props, ctx);
    } else {
      throw new Error("Empty interface")
    }
  }
  throw new Error(`Unhandled node type ${node.type}`);
};
