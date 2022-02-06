export const zip = <T>(xs: T[], ys: T[]): [T, T][] => {
  const length = xs.length;
  const result: [T, T][] = [];
  for (let i = 0; i < length; i++) {
    result[i] = [xs[i], ys[i]];
  }
  return result;
}