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
import {Loader} from './amd';
import {IComm, IWidgetManager, WidgetEnvironment} from './api';
import * as outputs from './outputs';
import {swizzle} from './swizzle';
import {
  WidgetModel,
  WidgetView,
  IClassicComm,
  DOMWidgetView,
  remove_buffers,
  put_buffers,
  BufferJSON,
  Dict,
} from '@jupyter-widgets/base';
import * as base from '@jupyter-widgets/base';
import {ManagerBase} from '@jupyter-widgets/base-manager';
import * as controls from '@jupyter-widgets/controls';
import * as services from '@jupyterlab/services';
import {JSONObject} from '@lumino/coreutils';
import {Message} from '@lumino/messaging';
import {Widget} from '@lumino/widgets';

export class Manager extends ManagerBase implements IWidgetManager {
  private readonly models = new Map<string, Promise<WidgetModel>>();
  private readonly loader: Loader;

  constructor(private readonly environment: WidgetEnvironment, loader: Loader) {
    super();

    this.loader = loader;

    // Backbone's extend cannot iterate static properties on ES6 classes and
    // misses propagating them when subclassing.
    const backboneExtend = base.WidgetModel.extend;
    const extend = function (
      this: object,
      proto: object,
      statics: unknown
    ): any {
      const result = backboneExtend.call(this, proto, statics);
      // Use prototype inheritance of the classes so the statics are correctly
      // inherited.
      Object.setPrototypeOf(result, this);
      return result;
    };
    base.WidgetModel.extend = controls.ButtonModel.extend = extend;

    // https://github.com/googlecolab/colab-cdn-widget-manager/issues/12
    // Add pWidget for better compat with jupyter-widgets 4.0.0.
    if (!Object.getOwnPropertyDescriptor(DOMWidgetView.prototype, 'pWidget')) {
      Object.defineProperty(DOMWidgetView.prototype, 'pWidget', {
        get: function () {
          return this.luminoWidget;
        },
      });
    }

    // https://github.com/googlecolab/colab-cdn-widget-manager/issues/19
    // Add processPhosphorMessage for better compat with jupyter-widgets 4.0.0.
    if (
      !Object.getOwnPropertyDescriptor(
        DOMWidgetView.prototype,
        'processPhosphorMessage'
      )
    ) {
      Object.defineProperty(DOMWidgetView.prototype, 'processPhosphorMessage', {
        value: function () {},
        writable: true,
      });
    }

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

    this.loader.define('@jupyter-widgets/output', [], () => outputs);
  }

  protected async loadClass(
    className: string,
    moduleName: string,
    moduleVersion: string
  ): Promise<typeof WidgetModel | typeof WidgetView> {
    const exports = await this.loader.load(moduleName, moduleVersion);
    return (exports as {[key: string]: typeof WidgetModel | typeof WidgetView})[
      className
    ];
  }

  protected async _create_comm(
    comm_target_name: string,
    model_id?: string,
    data?: JSONObject,
    metadata?: JSONObject,
    buffers?: ArrayBuffer[] | ArrayBufferView[]
  ): Promise<IClassicComm> {
    const sendBuffers = buffers?.map((buffer) => {
      if (ArrayBuffer.isView(buffer)) {
        return new Uint8Array(
          buffer.buffer,
          buffer.byteOffset,
          buffer.byteLength
        );
      }
      return buffer;
    });

    const comm = await this.environment.openCommChannel(
      comm_target_name,
      data,
      sendBuffers
    );
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

      // Round-trip the state through Jupyter's remove_buffers/put_buffers to
      // normalize the buffer format.
      const serializedState = remove_buffers(state.state as BufferJSON);
      put_buffers(
        state.state as Dict<BufferJSON>,
        serializedState.buffer_paths,
        serializedState.buffers
      );

      let comm = undefined;
      if (state.comm) {
        comm = new ClassicComm(modelId, state.comm);
      }

      const model = await this.new_model(
        {
          model_name: state.modelName,
          model_module: state.modelModule,
          model_module_version: state.modelModuleVersion,
          model_id: modelId,
          comm,
        },
        state.state
      );
      return model;
    })();
    this.models.set(modelId, modelPromise);
    return modelPromise;
  }

  async render(modelId: string, container: HTMLElement): Promise<void> {
    const model = (await this.get_model(modelId)) as WidgetModel;
    const view = await this.create_view(model);
    dispatchLuminoMessage(view.luminoWidget, {
      type: 'before-attach',
      isConflatable: false,
      conflate: () => false,
    });

    const lifecycleAdapter = new LuminoLifecycleAdapter(view.luminoWidget);
    lifecycleAdapter.appendChild(view.el);
    container.appendChild(lifecycleAdapter);
  }

  renderOutput(outputItem: unknown, destination: Element): Promise<void> {
    return this.environment.renderOutput(outputItem, destination);
  }

  async commChannelOpened(
    id: string,
    comm: IComm,
    data?: unknown,
    buffers?: ArrayBuffer[]
  ) {
    if (!data) {
      return;
    }
    const classicComm = new ClassicComm(id, comm);
    if (this.models.has(id)) {
      // This model has already been created, skip calling handle_com_open which
      // would re-create it.
      return;
    }
    await this.handle_comm_open(classicComm, {
      header: {} as services.KernelMessage.IHeader<'comm_open'>,
      metadata: {version: base.PROTOCOL_VERSION},
      parent_header: {},
      channel: 'iopub',
      content: {
        comm_id: id,
        target_name: 'jupyter.widget',
        data: data as JSONObject,
      },
    });
  }
}

class ClassicComm implements IClassicComm {
  constructor(private readonly id: string, private readonly comm: IComm) {}
  get target_name() {
    return '';
  }

  open(
    data: any,
    callbacks: any,
    metadata?: any,
    buffers?: ArrayBuffer[] | ArrayBufferView[]
  ): string {
    // Comm channels should be opened through Manager._create_comm.
    throw new Error('Method not implemented.');
  }

  /* eslint @typescript-eslint/no-explicit-any: "off" */
  send(
    data: unknown,
    callbacks: any,
    metadata?: unknown,
    buffers?: ArrayBuffer[] | ArrayBufferView[]
  ): string {
    let opts = undefined;
    if (buffers) {
      const sendBuffers = buffers.map((buffer) => {
        if (ArrayBuffer.isView(buffer)) {
          return new Uint8Array(
            buffer.buffer,
            buffer.byteOffset,
            buffer.byteLength
          );
        }
        return buffer;
      });
      opts = {buffers: sendBuffers};
    }
    // Round-trip through JSON to drop non-transferrable properties. These will
    // throw errors when sent via a message channel, vs JSON.stringify which
    // will just skip.
    data = JSON.parse(JSON.stringify(data));
    this.comm.send(data, opts).then(() => {
      if (callbacks && callbacks.iopub && callbacks.iopub.status) {
        callbacks.iopub.status({
          content: {
            execution_state: 'idle',
          },
        });
      }
    });
    return '';
  }
  close(
    data?: unknown,
    callbacks?: unknown,
    metadata?: unknown,
    buffers?: ArrayBuffer[] | ArrayBufferView[]
  ): string {
    // Currently does not support data in the close.
    this.comm.close();
    return '';
  }

  on_msg(callback: (x: unknown) => void) {
    (async () => {
      if (!this.comm) {
        return;
      }
      for await (const message of this.comm.messages) {
        let buffers: Uint8Array[] = [];
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
            buffers: buffers,
          });
        } catch (error) {
          console.error(error);
        }
      }
    })();
  }

  on_close(callback: (x: unknown) => void): void {
    if (!this.comm) {
      return;
    }
    (async () => {
      // Wait for all messages to complete.
      /* eslint no-empty: "off", @typescript-eslint/no-unused-vars: "off" */
      for await (const message of this.comm.messages) {
      }
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
      dispatchLuminoMessage(this.widget, {
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
      dispatchLuminoMessage(this.widget, {
        type: 'before-detach',
        isConflatable: false,
        conflate: () => false,
      });
      dispatchLuminoMessage(this.widget, {
        type: 'after-detach',
        isConflatable: false,
        conflate: () => false,
      });
    }
  }
}

function dispatchLuminoMessage(widget: Widget, message: Message) {
  widget.processMessage(message);
  const phosphorWidget = widget as MaybePhosphorWidget;
  if (phosphorWidget._view?.processPhosphorMessage) {
    phosphorWidget._view.processPhosphorMessage(message);
  }
}

declare interface MaybePhosphorWidget {
  _view?: MaybePhosphorView;
}

declare interface MaybePhosphorView {
  processPhosphorMessage?(message: Message): void;
}

try {
  window.customElements.define('colab-lumino-adapter', LuminoLifecycleAdapter);
} catch (error: unknown) {
  // May have already been defined.
}
