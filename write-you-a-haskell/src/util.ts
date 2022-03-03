export function fst<A, B>(tuple: [A, B]): A {
  return tuple[0];
}

export function snd<A, B>(tuple: [A, B]): B {
  return tuple[1];
}

export function zip<A, B>(as: readonly A[], bs: readonly B[]): [A, B][] {
  const length = Math.min(as.length, bs.length);
  const result: [A, B][] = [];
  for (let i = 0; i < length; i++) {
    result.push([as[i], bs[i]]);
  }
  return result;
}
