const classTemplate = <const Tag extends string>(tag: Tag) => `
    return class ${tag} extends Error {
      _tag = '${tag}';
    };
  `;

interface TaggedError<T extends string> {
  name: string;
  message: string;
  stack?: string;
  _tag: T;
}

interface TaggedErrorConstructor<T extends string> {
  new (message?: string, options?: ErrorOptions): TaggedError<T>;
  (message?: string, options?: ErrorOptions): TaggedError<T>;
  readonly prototype: TaggedError<T>;
}

export const createTaggedError = <const T extends string>(tag: T) => {
  return new Function(
    classTemplate(tag),
  )() as unknown as TaggedErrorConstructor<T>;
};
