/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint @typescript-eslint/no-explicit-any: "off" */
interface Constructable<T, A extends any[]> {
  new(...args: A): T;
}

// Make an ES6 class subclassable via Backbone's extend() call.
// The primary issue here is that ES6 constructors must be invoked via 'new' but
// Backbone does not do this when creating the parent object:
// https://github.com/jashkenas/backbone/blob/153dc41616a1f2663e4a86b705fefd412ecb4a7a/backbone.js#L2060
/* eslint @typescript-eslint/no-explicit-any: "off" */
export function swizzle<T, A extends any[]>(base: Constructable<T, A>): Constructable<T, A> {
  /* eslint @typescript-eslint/no-explicit-any: "off" */
  const Constructor = (function(this: any, ...args: A): T {
    // ES6 new.target will be specified if being constructed via the `new`
    // keyword.
    if (new.target) {
      return Reflect.construct(base, [...args], new.target);
    }
    return Reflect.construct(base, [...args], this.constructor);
  }) as unknown as Constructable<T, A>;

  Object.setPrototypeOf(Constructor.prototype, base.prototype);
  Object.setPrototypeOf(Constructor, base);

  return Constructor;
}