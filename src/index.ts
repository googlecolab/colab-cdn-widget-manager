/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { IWidgetManager, WidgetEnvironment } from './api';
import { Manager } from './manager';
import css from '../lib/index.css.txt';
import { Loader } from './amd';

/**
 * Implementation of the WidgetManagerModule interface.
 */
export function createWidgetManager(environment: WidgetEnvironment): IWidgetManager {
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
fontAwesome.href = 'https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css';
document.head.appendChild(fontAwesome);