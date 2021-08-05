/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { expect } from '@jest/globals';
import {swizzle} from './swizzle';
import * as Backbone from 'backbone';

class BaseES6 {
  readonly valueAtConstruction: string;
  readonly staticValueAtConstruction: string;
  static staticProperty = 'the base static';

  constructor(readonly constructorParam) {
    this.valueAtConstruction = this.getValue();
    /* eslint @typescript-eslint/no-explicit-any: "off" */
    this.staticValueAtConstruction = (this.constructor as any).staticProperty;
  }

  getValue(): string {
    return 'the super class';
  }
}

describe('swizzle', () => {
  describe('handles subclassing ES6 classes', () => {
    class Subclass extends swizzle(BaseES6) {
      static staticProperty = 'the derived static';
      getValue () {
        return 'the derived class';
      }
    }

    const instance = new Subclass('constructor param');
    it('passes constructor params', () => {
      expect(instance.constructorParam).toBe('constructor param');
    });
    it('overrides methods during construction', () => {
      expect(instance.valueAtConstruction).toBe('the derived class');
    });
    it('overrides methods', () => {
      expect(instance.getValue()).toBe('the derived class');
    });
    it('overrides statics on the constructor', () => {
      expect(instance.constructor.staticProperty).toBe('the derived static');
    });
    it('overrides statics', () => {
      expect(Subclass.staticProperty).toBe('the derived static');
    });
    it('overrides statics on the constructor during construction', () => {
      expect(instance.staticValueAtConstruction).toBe('the derived static');
    });
  });

  describe('constructors can be overridden backbone.extend', () => {
    const Subclass = Backbone.Model.extend.call(swizzle(BaseES6), {
      getValue: function () {
        return 'the derived class';
      },
    }, {
      staticProperty: 'the derived static',
    });
    const instance = new Subclass('constructor param');
    it('passes constructor params', () => {
      expect(instance.constructorParam).toBe('constructor param');
    });
    it('overrides methods during construction', () => {
      expect(instance.valueAtConstruction).toBe('the derived class');
    });
    it('overrides methods', () => {
      expect(instance.getValue()).toBe('the derived class');
    });
    it('overrides statics on the constructor', () => {
      expect(instance.constructor.staticProperty).toBe('the derived static');
    });
    it('overrides statics', () => {
      expect(Subclass.staticProperty).toBe('the derived static');
    });
    it('overrides statics on the constructor during construction', () => {
      expect(instance.staticValueAtConstruction).toBe('the derived static');
    });
  });
});