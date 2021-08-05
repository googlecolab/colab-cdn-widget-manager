/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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