import * as b from './builders';

export const tTrue = b.tLit(b.lBool(true)); 
export const tFalse = b.tLit(b.lBool(false));

export const tUndefined = b.tCon('undefined');
export const tNumber = b.tCon('number');
export const tBoolean = b.tCon('boolean');
export const tString = b.tCon('string');

// TODO: figure out how to model methods and getters
// .map(), .forEach(), .length
export const tArray = b.tCon('Array', [b.tVar()]);
// .then(), .catch()
export const tPromise = b.tCon('Promise', [b.tVar()]);
// These are essentially parameterized object types
