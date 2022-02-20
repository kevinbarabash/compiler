import type { Type } from "./types";

export const print = (
  t: Type,
  tVarNames: Record<number, string> = {},
  printTVarIds = false
): string => {
  let nextNameCharCode = "a".charCodeAt(0);
  for (const name of Object.values(tVarNames)) {
    if (nextNameCharCode <= name.charCodeAt(0)) {
      nextNameCharCode++;
    }
  }
  let nextName: string = String.fromCharCode(nextNameCharCode);

  const _print = (t: Type): string => {
    switch (t.t) {
      case "TLit": {
        const l = t.literal;
        switch (l.t) {
          case "LBool":
            return l.value.toString();
          case "LNum":
            return l.value.toString();
          case "LStr":
            return `"${l.value}"`;
        }
      }
      case "TVar": {
        if (printTVarIds) {
          return `t${t.id}`;
        } else {
          if (!tVarNames[t.id]) {
            tVarNames[t.id] = nextName;
            nextName = String.fromCharCode(nextName.charCodeAt(0) + 1);
          }
          return tVarNames[t.id];
        }
      }
      case "TCon": {
        const typeArgs = t.typeArgs.map(_print);
        const name = t.frozen ? `${t.name}(frozen)` : t.name;
        return typeArgs.length > 0
          ? `${name}<${typeArgs.join(", ")}>`
          : name;
      }
      case "TFun": {
        const paramTypes = t.paramTypes.map((p, i) => {
          const name = p.name || `arg${i}`;
          return p.optional
            ? `${name}?: ${_print(p.type)}`
            : `${name}: ${_print(p.type)}`;
        });
        const retType = _print(t.retType);
        return `(${paramTypes.join(", ")}) => ${retType}`;
      }
      case "TRec": {
        const properties = t.properties.map((p) =>
          p.optional
            ? `${p.name}?: ${_print(p.type)}`
            : `${p.name}: ${_print(p.type)}`
        );
        return `{ ${properties.join(", ")} }`;
      }
      case "TTuple": {
        return `[${t.types.map(_print).join(", ")}]`;
      }
      case "TUnion": {
        const types = t.types.map((t) =>
          t.t === "TFun" ? `(${_print(t)})` : _print(t)
        );
        return types.join(" | ");
      }
    }
  };

  return _print(t);
};
