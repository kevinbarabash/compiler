import * as b from './builders';
import * as t from './types';

export const tTrue = b.tBool(true); 
export const tFalse = b.tBool(false);

export const tUndefined = () => b.tCon('undefined');
export const tNumber = () => b.tCon('number');
export const tBoolean = () => b.tCon('boolean');
export const tString = () => b.tCon('string');

// TODO: figure out how to model methods and getters
// .map(), .forEach(), .length
export const tArray = (a: t.Type) => b.tCon('Array', [a]);
// .then(), .catch()
export const tPromise = (a: t.Type) => b.tCon('Promise', [a]);
// These are essentially parameterized object types
