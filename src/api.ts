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

/**
 * The interface a custom widget manager ES6 module is expected to
 * implement.
 *
 * In plain code this means that the module would export a method such as:
 *
 * ```
 *    export function createWidgetManager(environment: WidgetEnvironment) {
 *       ...
 *    }
 * ```
 */
export declare interface WidgetManagerModule {
  createWidgetManager(
    state: WidgetEnvironment,
    arguments?: unknown
  ): IWidgetManager;
}

/**
 * The host API of the widget manager.
 */
export declare interface WidgetEnvironment {
  /**
   * @param modelId The ID of the model for which the model state is desired.
   */
  getModelState(modelId: string): Promise<ModelState | undefined>;

  /**
   * Open a new comm channel to the kernel.
   *
   * The kernel should have registered a handler following the documentation
   * at
   * https://jupyter-notebook.readthedocs.io/en/stable/comms.html#opening-a-comm-from-the-frontend.
   *
   * @param targetName The name of the channel registered on the kernel.
   * @param data Any data to be sent with the open message.
   * @param buffers Any binary data to be sent with the open message.
   * @return The established comm channel.
   */
  openCommChannel(
    targetName: string,
    data?: unknown,
    buffers?: ArrayBuffer[]
  ): Promise<IComm>;
}

export declare interface IWidgetManager {
  /**
   * Render the model specified by modelId into the container element.
   */
  render(modelId: string, container: Element): Promise<void>;
}

export declare interface ModelState {
  // Should these be here, or in the state object?
  // comm_open message passes it in the state:
  // https://github.com/jupyter-widgets/ipywidgets/blob/13fb8066c6a44fa57b8667de7959de6bd20f3bca/packages/base-manager/src/manager-base.ts#L205-L211
  // But the ipynb serialization pulls them above the general state params:
  // https://github.com/jupyter-widgets/ipywidgets/blob/13fb8066c6a44fa57b8667de7959de6bd20f3bca/packages/schema/v2/state.schema.json#L24-L34
  modelName: string;
  modelModule: string;
  modelModuleVersion: string;

  state: {[key: string]: unknown};
  /**
   * If connected to a kernel then this is the comm channel to the kernel.
   * This will only be set if currently connected to a kernel.
   */
  comm?: IComm;
}

export declare interface IComm {
  send(data: unknown, opts?: {buffers?: ArrayBuffer[]}): Promise<void>;
  close(): void;

  /**
   * An async iterator of the incoming messages from the kernel.
   * The iterator will end when the comm channel is closed.
   */
  readonly messages: AsyncIterable<Message>;
}

/** A single Comm message. */
export interface Message {
  /** The JSON structured data of the message. */
  readonly data: unknown;
  /** Optional binary buffers transferred with the message. */
  readonly buffers?: ArrayBuffer[];
}
