/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { expect } from '@jest/globals';
import {Loader} from './amd';

test('getHostedModuleUrl', () => {
  const loader = new Loader();
  expect(loader.resolveModule('foo').pathname).toBe('/npm/foo@*/dist/index.js');
  expect(loader.resolveModule('@jupyter-widgets/base').pathname).toBe('/npm/@jupyter-widgets/base@*/dist/index.js');
  expect(loader.resolveModule('@jupyter-widgets/base', '4.0.0').pathname).toBe('/npm/@jupyter-widgets/base@4.0.0/dist/index.js');
  expect(loader.resolveModule('@jupyter-widgets/base/css/index.css', '4.0.0').pathname).toBe('/npm/@jupyter-widgets/base@4.0.0/css/index.css');
});