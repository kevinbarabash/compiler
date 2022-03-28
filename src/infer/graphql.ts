import * as fs from "fs";
import * as path from "path";
import {
  ASTNode,
  buildSchema,
  GraphQLEnumType,
  TypeNode,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLScalarType,
  Kind,
  parse,
  TypeInfo,
  visit,
  visitWithTypeInfo,
} from "graphql";

import * as tt from "../infer/type-types";
import * as tb from "../infer/type-builders";
import { Context } from "../infer/context";

export const parseSchema = () => {
  const src = fs.readFileSync(path.join(__dirname, "schema.graphql"), "utf-8");
  return buildSchema(src);
};

export const getOperationType = (query: string, ctx: Context): tt.Type => {
  const schema = parseSchema();
  const typeInfo = new TypeInfo(schema);
  // Tracks the fields we've visted so far.  Is emptied whenever we
  // encounter a field that's a GraphQLObjectType.
  const fields: Map<string, tt.Type> = new Map();

  const convertOutputType = (type: GraphQLOutputType): tt.Type => {
    if (type instanceof GraphQLNonNull) {
      return convertOutputType(type.ofType);
    } else if (type instanceof GraphQLList) {
      return tb.tgen("Array", [convertOutputType(type.ofType)], ctx);
    } else if (type instanceof GraphQLEnumType) {
      // TODO: handle non-string enums
      const values: string[] = type.getValues().map((value) => value.value);
      return tb.tunion(
        values.map((value) => tb.tlit({ __type: "LStr", value }, ctx)),
        ctx
      );
    } else if (type instanceof GraphQLScalarType) {
      return tb.tprim("string", ctx);
    } else if (type instanceof GraphQLObjectType) {
      const props = [...fields.entries()].map(([name, type]) => {
        return tb.tprop(name, type);
      });
      fields.clear();
      return tb.trec(props, ctx);
    } else {
      throw new Error("We don't handle this type of GraphQL type yet");
    }
  };

  const convertTypeNode = (type: TypeNode, ctx: Context): tt.Type => {
    switch (type.kind) {
      case Kind.NAMED_TYPE: {
        if (type.name.value === "ID") {
          return tb.tprim("string", ctx);
        }
        throw new Error(`TODO: handle NAMED_TYPE with value ${type.name.value}`);
      }
      case Kind.LIST_TYPE: {
        return tb.tgen("Array", [convertTypeNode(type.type, ctx)], ctx);
      }
      case Kind.NON_NULL_TYPE: {
        return convertTypeNode(type.type, ctx);
      }
    }
  }

  let result: tt.Type | null = null;

  const visitor = {
    enter(node: ASTNode) {
      typeInfo.enter(node);
    },
    leave(node: ASTNode) {
      if (node.kind === Kind.FIELD) {
        const fieldDef = typeInfo.getFieldDef();
        if (fieldDef) {
          const type = convertOutputType(fieldDef.type);
          fields.set(fieldDef.name, type);
        }
      } else if (node.kind === Kind.OPERATION_DEFINITION) {
        // Creates top-level TRec
        const dataProps = [...fields.entries()].map(([name, type]) => {
          return tb.tprop(name, type);
        });
        fields.clear();
        const dataType = tb.trec(dataProps, ctx);

        const variableProps = node.variableDefinitions
          ? node.variableDefinitions.map(varDef => {
            return tb.tprop(
              varDef.variable.name.value,
              convertTypeNode(varDef.type, ctx), 
            );
          })
          : [];

        const variablesType = tb.trec(variableProps, ctx);

        result = tb.tgen("GqlOperation", [dataType, variablesType], ctx);
      } else if (node.kind === Kind.DOCUMENT) {
        node.kind; // ?
        node.definitions[0].kind; // ?
      }
      typeInfo.leave(node);
    },
  };
  visit(parse(query), visitWithTypeInfo(typeInfo, visitor));

  if (!result) {
    throw new Error("Coudln't determine result type");
  }

  return result;
};
