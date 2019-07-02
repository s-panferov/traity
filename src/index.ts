export class Trait {}

export type Matcher<C> = (v: any) => v is C;
export type Predicate<C> = (value: C) => boolean;

export class TraitBuilder<T extends Trait> {
  klass: Constructor<T>;
  constructor(trait: Constructor<T>) {
    this.klass = trait;
  }

  for<C extends T>(target: Constructor<C> | Matcher<C>) {
    return new WithBuilder<T, C>(this, target);
  }
}

export interface TraitMeta<T extends Trait> {
  impls: { predicates: Predicate<any>[]; impl: Constructor<T> }[];
}

const map: Map<Trait, TraitMeta<Trait>> = new Map();

export class WithBuilder<T extends Trait, C> {
  trait: TraitBuilder<T>;
  target: Constructor<C> | Matcher<C>;
  predicates: Predicate<C>[] = [];

  constructor(trait: TraitBuilder<T>, target: Constructor<C> | Matcher<C>) {
    this.trait = trait;
    this.target = target;
  }

  where(predicate: Predicate<C>) {
    this.predicates.push(predicate);
    return this;
  }

  with<I extends T>(impl: new () => I) {
    let meta = map.get(this.trait.klass) as TraitMeta<T>;
    if (!meta) {
      meta = { impls: [] } as TraitMeta<T>;
      map.set(this.trait.klass, meta);
    }

    meta.impls.push({
      impl,
      predicates: this.predicates
    });

    if (isConstructor(this.target)) {
      const items = Object.getOwnPropertyNames(impl.prototype);
      for (const itemName of items) {
        if (itemName === "constructor") {
          continue;
        }
        const item = impl.prototype[itemName];
        if (typeof item === "function") {
          if (typeof this.target.prototype[itemName] === "undefined") {
            this.target.prototype[itemName] = dispatch(
              itemName,
              this.trait.klass,
              this.target
            );
          }
        }
      }
    }
  }
}

function dispatch(
  method: string,
  trait: Constructor<Trait>,
  target: Constructor<{}>
) {
  return function(this: any, ...args: any[]) {
    return runtimeDispatch(this, method, trait, args, target);
  };
}

function runtimeDispatch(
  self: any,
  method: string,
  trait: Constructor<{}>,
  args: any[],
  target?: Constructor<{}>
) {
  const meta = map.get(trait);
  if (!meta || meta.impls.length === 0) {
    throw new Error(
      `No implementation of the trait ${trait} found for ${target}`
    );
  }

  const impl = meta.impls.find(i => {
    if (i.predicates.length > 0) {
      return i.predicates.some(p => p(self));
    }
    return true;
  });

  if (!impl) {
    throw new Error(
      `No implementation of the trait ${trait} found for ${target}`
    );
  }

  let foo = impl.impl.prototype[method] as Function;
  return foo.apply(self, args);
}

const handler = {
  construct() {
    return handler;
  }
}; //Must return ANY object, so reuse one

const isConstructor = <C>(
  x: Constructor<C> | Matcher<C>
): x is Constructor<C> => {
  try {
    return !!new new Proxy(x as any, handler)();
  } catch (e) {
    return false;
  }
};

export type TraitObj<T extends Trait> = {
  [K in keyof T]: T[K] extends <V1>(value1: V1) => infer R
    ? (<E>(self: T, value: E) => R)
    : T[K] extends (...args: infer A) => infer R
    ? ((self: T, ...args: A) => R)
    : never
};

export type Constructor<T> = Function & { prototype: T };

export function instantiate<T extends Trait, C extends Constructor<T>>(
  trait: C
): TraitObj<T> & { Trait: C } {
  const proxy = new Proxy(
    {},
    {
      get(_t, p) {
        return (self: any, ...args: any[]) => {
          return runtimeDispatch(self, p.toString(), trait, args);
        };
      }
    }
  );

  return proxy as any;
}

export function implement<T extends Trait>(trait: Constructor<T>) {
  return new TraitBuilder(trait);
}
