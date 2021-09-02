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
import css from '../lib/index.css.txt';
import {Loader} from './amd';
import {IWidgetManager, WidgetEnvironment} from './api';
import {Manager} from './manager';

/**
 * Implementation of the WidgetManagerModule interface.
 */
export function createWidgetManager(
  environment: WidgetEnvironment
): IWidgetManager {
  const loader = new Loader();
  return new Manager(environment, loader);
}

// Add the Jupyter Widgets CSS to the page.
const style = document.createElement('style');
style.textContent = css;
document.head.appendChild(style);

// Some widgets rely on icons from font-awesome, so add that as well.
const fontAwesome = document.createElement('link');
fontAwesome.rel = 'stylesheet';
fontAwesome.href =
  'https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css';
document.head.appendChild(fontAwesome);
