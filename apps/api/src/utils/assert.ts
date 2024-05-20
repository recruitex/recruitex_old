import { createTaggedError } from '#/utils/error';

const UnreachableError = createTaggedError('Unreachable');

export const assertUnreachable = (x: never): never => {
  throw new UnreachableError(`${x} was supposed to be unreachable`);
};
