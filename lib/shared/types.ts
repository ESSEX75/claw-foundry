/** Owns universal TypeScript type constructions without domain or SDK dependencies. */

/** Union of all value types declared by an object type. */
export type ValueOf<T> = T[keyof T];
