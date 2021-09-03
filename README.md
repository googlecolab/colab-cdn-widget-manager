# Custom Widget Manager implementation for Google Colab

A proposal for Google Colaboratory to support a pluggable Jupyter Widget Manager
implementation to allow users to arbitrary widgets from arbitrary sources.

This project includes an implementation of a widget manager which loads widgets from a
CDN.

## Pluggable Widget Manager API

Colab frontend should expose an API for users to specify what widget manager
they would like to use.

The API should be as minimal as possible and avoid being tied to specific Jupyter Widgers versions. The notebook author should have the flexibility to determine the Jupyter Widgets version they would like to use. Later viewers of the notebook will see the widgets rendered with the same Jupyter Widgets version as the original author.

#### API Proposal

Expose a global method for registering a custom widget manager:

```typescript;
google.colab.widgets.installCustomManager(url: string, args: any): void
```

This API can be invoked at any point by Javascript outputs to change the widget manager for all subsequent outputs. This API can be wrapped in a Python API to make it easier to invoke from a kernel.

The URL must resolve to an ES6 module exporting the WidgetManagerModule interface:

```typescript
interface WidgetManagerModule {
  createWidgetManager(
    state: WidgetEnvironment,
    arguments?: unknown
  ): IWidgetManager;
}

interface IWidgetManager {
  render(modelId: string, container: Element): Promise<void>;
}
```

After a custom widget manager has been registered and a Jupyter Widget is being rendered to the outputs then the custom widget manager module will be loaded, the widget manager will be created and all widgets within that window will be created with that manager.

Once a custom widget manager has been registered then a manager will be instantiated when any widgets need to be rendered in the notebook.

The full API details are included in Colab's [outputframe declaration file](https://github.com/googlecolab/colabtools/blob/07b38dfa2869780ff2128cf7c1ad4414d1b4109c/packages/outputframe/lib/index.d.ts#L154-L210).

# Development

Install and run the development server:

```shell
npm install
npm run server
```

Then from a notebook running in Google Colab:

```python
from IPython.display import Javascript

# Specify the custom widget manager running locally
display(Javascript('''
  google.colab.widgets.installCustomManager('http://127.0.0.1:9897/manager.dev.js');
'''))

import ipywidgets as widgets

widget = widgets.IntSlider(value=10)
display(widget)
```

The development server will automatically rebuild the sources- no need to restart the server after local modifications. A full example is https://github.com/googlecolab/colab-cdn-widget-manager/blob/main/notebooks/ipympl.ipynb.

To run all tests:

```
npm run tests
```

Alternatively functional tests can be executed and debugged with:

```
npm run test:karma:dev
```

Then navigate to http://localhost:9876/.
