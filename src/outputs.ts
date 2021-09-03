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
import {DOMWidgetModel, DOMWidgetView} from '@jupyter-widgets/base';
import {WidgetModel} from '@jupyter-widgets/base';
import {ViewOptions} from '@jupyter-widgets/base/node_modules/@types/backbone';
import * as _ from 'underscore';

interface OutputRenderer {
  renderOutput(modelId: string, container: Element): Promise<void>;
}

/**
 * Widget Model for an Output widget.
 */
export class OutputModel extends DOMWidgetModel {
  defaults(): Backbone.ObjectHash {
    return _.extend(super.defaults(), {
      outputs: [],
      _view_name: 'OutputView',
      _model_name: 'OutputModel',
      _view_module: '@jupyter-widgets/output',
      _model_module: '@jupyter-widgets/output',
    });
  }
}

/**
 * Widget View for an Output widget.
 */
export class OutputView extends DOMWidgetView {
  constructor(options: ViewOptions<WidgetModel>) {
    super(options);

    this.tagName = 'div';
  }
  /**
   * Called when view is rendered.
   */
  /* eslint @typescript-eslint/no-explicit-any: "off" */
  render(): any {
    const result = super.render();
    this.listenTo(this.model, 'change:outputs', this.updateOutputs);
    this.updateOutputs();
    return result;
  }

  private async updateOutputs() {
    const newElements = [];
    const oldNodes = Array.from(this.el.childNodes);
    const outputs = this.model.attributes.outputs;
    for (const output of outputs) {
      const div = document.createElement('div');
      // Hide the new div while loading to avoid jank.
      div.style.display = 'none';
      this.el.appendChild(div);
      newElements.push(div);
      await (
        this.model.widget_manager as unknown as OutputRenderer
      ).renderOutput(output, div);
    }
    // Remove all previous items.
    for (const node of oldNodes) {
      this.el.removeChild(node);
    }
    for (const element of newElements) {
      // Show all of the new divs.
      element.style.display = 'block';
    }
  }
}
