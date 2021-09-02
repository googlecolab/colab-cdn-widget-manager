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

import { WidgetModel, WidgetView, IClassicComm } from '@jupyter-widgets/base';
import * as base from '@jupyter-widgets/base';
import * as controls from '@jupyter-widgets/controls';
import { ManagerBase } from '@jupyter-widgets/base-manager';
import { JSONObject } from '@lumino/coreutils';
import { Widget } from '@lumino/widgets';

import { Loader } from './amd';
import { IComm, IWidgetManager, WidgetEnvironment } from './api';
import { swizzle } from './swizzle';

export class Manager extends ManagerBase implements IWidgetManager {
  private readonly models = new Map<string, Promise<WidgetModel>>();
  private readonly loader: Loader;

  constructor(private readonly environment: WidgetEnvironment, loader: Loader) {
    super();

    this.loader = loader;

    // Backbone's extend cannot iterate static properties on ES6 classes and
    // misses propagating them when subclassing.
    const backboneExtend = base.WidgetModel.extend;
    const extend = function (this: object, proto: object, statics: unknown): any {
      const result = backboneExtend.call(this, proto, statics);
      // Use prototype inheritance of the classes so the statics are correctly
      // inherited.
      Object.setPrototypeOf(result, this);
      return result;
    }
    base.WidgetModel.extend = controls.ButtonModel.extend = extend;

    this.loader.define('@jupyter-widgets/base', [], () => {
      const module: {[key: string]: unknown} = {};
      for (const key of Object.keys(base)) {
        let value = (base as any)[key];
        // The ES6 classes cannot be subclassed via Backbone's extend that some
        // code uses, so if the export looks like a class use swizzle to make it
        // extensible.
        if (value.prototype) {
          value = swizzle(value);
        }
        module[key] = value;
      }
      return module;
    });

    this.loader.define('@jupyter-widgets/controls', [], () => {
      const module: {[key: string]: unknown} = {};
      for (const key of Object.keys(controls)) {
        let value = (controls as any)[key];
        // The ES6 classes cannot be subclassed via Backbone's extend that some
        // code uses, so if the export looks like a class use swizzle to make it
        // extensible.
        if (value.prototype) {
          value = swizzle(value);
        }
        module[key] = value;
      }
      return module;
    });
  }

  protected async loadClass(className: string, moduleName: string, moduleVersion: string): Promise<typeof WidgetModel | typeof WidgetView> {
    const exports = await this.loader.load(moduleName, moduleVersion);
    return (exports as {[key: string]:(typeof WidgetModel| typeof WidgetView)}) [className];
  }

  protected async _create_comm(comm_target_name: string, model_id?: string, data?: JSONObject, metadata?: JSONObject, buffers?: ArrayBuffer[] | ArrayBufferView[]): Promise<IClassicComm> {
    const sendBuffers = buffers?.map((buffer) => {
      if (ArrayBuffer.isView(buffer)) {
        return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      }
      return buffer;
    });

    const comm = await this.environment.openCommChannel(comm_target_name, data, sendBuffers);
    return new ClassicComm(model_id || '', comm);
  }

  /* eslint @typescript-eslint/ban-types: "off" */
  protected _get_comm_info(): Promise<{}> {
    throw new Error('Method not implemented.');
  }

  async get_model(modelId: string): Promise<WidgetModel> {
    let modelPromise = this.models.get(modelId);
    if (modelPromise) {
      return modelPromise;
    }
    modelPromise = (async () => {
      const state = await this.environment.getModelState(modelId);
      if (!state) {
        throw new Error('not found');
      }
      let comm = undefined;
      if (state.comm) {
        comm = new ClassicComm(modelId, state.comm);
      }

      const model = await this.new_model({
        model_name: state.modelName,
        model_module: state.modelModule,
        model_module_version: state.modelModuleVersion,
        model_id: modelId,
        comm,
      }, state.state);
      return model;
    })();
    this.models.set(modelId, modelPromise);
    return modelPromise;
  }

  async render(modelId: string, container: HTMLElement): Promise<void> {
    const model = (await this.get_model(modelId)) as WidgetModel;
    const view = await this.create_view(model);
    view.luminoWidget.processMessage({
      type: 'before-attach',
      isConflatable: false,
      conflate: () => false,
    });

    const lifecycleAdapter = new LuminoLifecycleAdapter(view.luminoWidget);
    lifecycleAdapter.appendChild(view.el);
    container.appendChild(lifecycleAdapter);
  }
}

class ClassicComm implements IClassicComm {
  constructor(private readonly id: string, private readonly comm: IComm) {}
  get target_name() {
    return '';
  }

  open(data: any, callbacks: any, metadata?: any, buffers?: ArrayBuffer[] | ArrayBufferView[]): string {
    // Comm channels should be opened through Manager._create_comm.
    throw new Error('Method not implemented.');
  }

  /* eslint @typescript-eslint/no-explicit-any: "off" */
  send(data: unknown, callbacks: any, metadata?: unknown, buffers?: ArrayBuffer[] | ArrayBufferView[]): string {
    let opts = undefined;
    if (buffers) {
      const sendBuffers = buffers.map((buffer) => {
        if (ArrayBuffer.isView(buffer)) {
          return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        }
        return buffer;
      });
      opts = {buffers: sendBuffers};
    }
    this.comm.send(data, opts).then(() => {
      if (callbacks && callbacks.iopub && callbacks.iopub.status) {
        callbacks.iopub.status({
          content: {
            execution_state: 'idle',
          }
        });
      }
    });
    return '';
  }
  close(data?: unknown, callbacks?: unknown, metadata?: unknown, buffers?: ArrayBuffer[] | ArrayBufferView[]): string {
    // Currently does not support data in the close.
    this.comm.close();
    return '';
  }

  on_msg(callback: (x: unknown) => void) {
    (async() => {
      for await (const message of this.comm.messages) {
        let buffers;
        if (message.buffers) {
          // The comm callback is typed as ArrayBuffer|ArrayBufferView but
          // some code (pythreejs) require ArrayBufferViews.
          buffers = message.buffers.map((b) => new Uint8Array(b));
        }
        try {
          callback({
            content: {
              comm_id: this.id,
              data: message.data,
            },
            buffers: buffers
          });
        } catch (error) {
          console.error(error);
        }
      }
    })();
  }

  on_close(callback: (x: unknown) => void): void {
    (async() => {
      // Wait for all messages to complete.
      /* eslint no-empty: "off", @typescript-eslint/no-unused-vars: "off" */
      for await (const message of this.comm.messages) {}
      callback(undefined);
    })();
  }

  get comm_id() {
    return this.id;
  }
}

/**
 * Custom element to provide Lumino lifecycle events driven by native DOM
 * events.
 */
class LuminoLifecycleAdapter extends HTMLElement {
  constructor(private readonly widget?: Widget) {
    super();
  }
  connectedCallback() {
    if (this.widget) {
      this.widget.processMessage({
        type: 'after-attach',
        isConflatable: false,
        conflate: () => false,
      });
    }
  }
  disconnectedCallback() {
    if (this.widget) {
      // We don't have a native event for before-detach, so just fire before
      // the after-detach.
      this.widget.processMessage({
        type: 'before-detach',
        isConflatable: false,
        conflate: () => false,
      });
      this.widget.processMessage({
        type: 'after-detach',
        isConflatable: false,
        conflate: () => false,
      })
    }
  }
}
try {
  window.customElements.define('colab-lumino-adapter', LuminoLifecycleAdapter);
} catch (error: unknown) {
  // May have already been defined.
}