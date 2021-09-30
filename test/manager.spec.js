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
import {createWidgetManager} from '../dist/manager.dev.js';

/**
 * Helper which adapts the widget state notebook format to the public API
 * format.
 */
class FakeState {
  constructor(state, comm) {
    this.state = state;
    this.comm = comm;
  }

  async getModelState(modelId) {
    const state = this.state[modelId];
    return {
      modelModule: state.model_module,
      modelName: state.model_name,
      modelModuleVersion: state.model_module_version,
      state: state.state,
      comm: this.comm,
    };
  }

  async renderOutput(output, element) {
    if (output.data['text/html']) {
      element.innerHTML = output.data['text/html'];
    }
  }
}

describe('widget manager', () => {
  let container;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  afterEach(() => {
    container.remove();
  });

  it('can render a threejs scene', async () => {
    const modelId = 'pythree_example_model_007';
    const state = await (
      await fetch('/base/test/jupyter_threejs_state.json')
    ).json();

    const provider = new FakeState(state);
    const manager = createWidgetManager(provider);

    await manager.render(modelId, container);
    const threeJs = container.querySelector('.jupyter-threejs canvas');
    expect(threeJs).toBeInstanceOf(HTMLCanvasElement);
  });

  it('can render ipyleaflet', async () => {
    const modelId = '34baf5762f2344e19200892a8efafc27';
    const state = await (await fetch('/base/test/leaflet_state.json')).json();

    const provider = new FakeState(state);
    const manager = createWidgetManager(provider);

    await manager.render(modelId, container);
    const leaflet = container.querySelector('.leaflet-widgets');
    expect(leaflet).toBeInstanceOf(HTMLDivElement);
  });

  it('throws for invalid specs', async () => {
    const provider = new FakeState({
      123: {
        state: {},
      },
    });
    const oldHandler = window.onerror;
    window.onerror = () => {};
    const manager = createWidgetManager(provider);
    await expectAsync(manager.render('123', container)).toBeRejected();
    await new Promise((resolve) => setTimeout(resolve, 100));
    window.onerror = oldHandler;
  });

  it('has proper lifecycle events', async () => {
    const provider = new FakeState({
      123: {
        state: {
          _view_module: 'custom-widget',
          _view_name: 'View',
        },
        model_module: 'custom-widget',
        model_name: 'Model',
      },
    });
    const manager = createWidgetManager(provider);
    let modelClass;
    let viewClass;

    manager.loader.define(
      'custom-widget',
      ['@jupyter-widgets/base'],
      (base) => {
        class Model extends base.DOMWidgetModel {
          constructor(...args) {
            super(...args);
          }
        }
        class View extends base.DOMWidgetView {
          constructor(...args) {
            super(...args);
            this.hasBeenDisplayed = false;
            this.displayed.then(() => {
              this.hasBeenDisplayed = true;
            });
          }
        }
        modelClass = Model;
        viewClass = View;

        return {
          Model,
          View,
        };
      }
    );

    container.remove();

    await manager.render('123', container);
    const model = await manager.get_model('123');
    expect(model).toBeInstanceOf(modelClass);
    const view = await Object.values(model.views)[0];
    expect(view).toBeInstanceOf(viewClass);
    expect(view.hasBeenDisplayed).toBe(false);
    document.body.appendChild(container);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(view.hasBeenDisplayed).toBe(true);
  });

  it('supports output widgets', async () => {
    const modelId = '99837b7c37654c8c8f35cad63aaad130';
    const state = await (await fetch('/base/test/output_state.json')).json();

    const provider = new FakeState(state);
    const manager = createWidgetManager(provider);

    await manager.render(modelId, container);
    const marquee = container.querySelector('marquee');
    expect(marquee).toBeInstanceOf(HTMLElement);
  });

  it('omits non-transferrables', async () => {
    const provider = new FakeState(
      {
        123: {
          state: {
            _view_module: 'custom-widget',
            _view_name: 'View',
          },
          model_module: 'custom-widget',
          model_name: 'Model',
        },
      },
      {
        send: async (data) => {
          const channel = new MessageChannel();
          channel.port1.postMessage(data);
        },
      }
    );
    const manager = createWidgetManager(provider);
    let modelClass;
    let viewClass;

    manager.loader.define(
      'custom-widget',
      ['@jupyter-widgets/base'],
      (base) => {
        class Model extends base.DOMWidgetModel {
          constructor(...args) {
            super(...args);
          }
        }
        class View extends base.DOMWidgetView {
          constructor(...args) {
            super(...args);
            this.hasBeenDisplayed = false;
            this.displayed.then(() => {
              this.hasBeenDisplayed = true;
            });
          }
        }
        modelClass = Model;
        viewClass = View;

        return {
          Model,
          View,
        };
      }
    );
    await manager.render('123', container);
    const model = await manager.get_model('123');
    expect(() => {
      model.send({
        nonTransferrable: () => {},
      });
    }).not.toThrow();
  });

  it('normalizes buffers', async () => {
    const provider = new FakeState({
      123: {
        state: {
          _view_module: 'custom-widget',
          _view_name: 'View',
          my_data: new ArrayBuffer(100),
        },
        model_module: 'custom-widget',
        model_name: 'Model',
      },
    });
    const manager = createWidgetManager(provider);

    let constructedState;
    manager.loader.define(
      'custom-widget',
      ['@jupyter-widgets/base'],
      (base) => {
        class Model extends base.DOMWidgetModel {
          constructor(state, options) {
            super(state, options);
            constructedState = state;
          }
        }
        class View extends base.DOMWidgetView {
          constructor(...args) {
            super(...args);
          }
        }
        return {
          Model,
          View,
        };
      }
    );

    await manager.render('123', container);
    expect(constructedState.my_data).toBeInstanceOf(DataView);
    await new Promise((resolve) => setTimeout(resolve, 0));

    container.remove();
  });
});
