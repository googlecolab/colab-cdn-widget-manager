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
 * A *very* minimal requirejs-like (AMD) module loader to avoid having an
 * explicit requirejs dependency in the global scope.
 */
export class Loader {
  private readonly definitions = new Map<string, Definition>();
  private loadQueue = Promise.resolve();

  async load(moduleName: string, moduleVersion?: string): Promise<unknown> {
    let definition = this.definitions.get(moduleName);
    if (definition) {
      return this.loadModule(moduleName, definition);
    }

    const loaded = this.loadQueue.then(async (): Promise<Module> => {
      this.register();

      const url = this.resolveModule(moduleName, moduleVersion);
      const script =
        (await (await fetch(url.toString())).text()) + `\n//@ sourceURL=${url}`;
      const fn = new Function('define', script);
      let module: Module | undefined;
      const define = (
        first: string | string[],
        second: string[] | (() => unknown) | unknown,
        third?: (() => unknown) | unknown
      ) => {
        if (typeof first === 'string') {
          module = this.define(first, second as string[], third);
        } else {
          module = this.define(
            moduleName,
            first as string[],
            second as (() => unknown) | unknown
          );
        }
      };
      fn.call({define}, define);
      /* eslint @typescript-eslint/no-non-null-assertion: "off" */
      return module!;
    });
    // Serialize script loading to keep only one module loading at a time.
    /* eslint @typescript-eslint/no-empty-function: "off" */
    this.loadQueue = loaded
      .then(() => {})
      .catch(() => {
        // ignore errors for later loads.
      });

    definition = {
      loaded,
    };

    this.definitions.set(moduleName, definition);
    return this.loadModule(moduleName, definition);
  }

  resolveModule(moduleName: string, moduleVersion?: string): URL {
    return getHostedModuleUrl(moduleName, moduleVersion);
  }

  private register() {
    /* eslint @typescript-eslint/no-explicit-any: "off" */
    (window as any).define = this.define.bind(this);
  }

  async loadModule(id: string, declaration: Definition): Promise<unknown> {
    const module = await declaration.loaded;
    if (module.exports) {
      return module.exports;
    }
    if (!module.exports) {
      module.exports = (async () => {
        const requirements = await Promise.all(
          module.dependencies.map((dependency) => {
            const definition = this.definitions.get(dependency);
            if (!definition) {
              throw new Error(`Unknown dependency ${dependency}`);
            }
            return this.loadModule(dependency, definition);
          })
        );
        return module.factory.apply(window, requirements);
      })();
    }
    return module.exports;
  }

  define(
    moduleId: string,
    dependencies: string[],
    definition: () => unknown
  ): Module;
  define(moduleId: string, dependencies: string[], definition: unknown): Module;
  define(
    moduleId: string,
    dependencies: string[],
    factory?: (() => unknown) | unknown
  ): Module {
    if (!(factory instanceof Function)) {
      factory = () => factory;
    }
    const definition = this.definitions.get(moduleId);
    const module = {
      factory: factory as () => unknown,
      dependencies,
    };
    if (!definition) {
      this.definitions.set(moduleId, {
        loaded: Promise.resolve(module),
      });
    }
    return module;
  }
}

function getHostedModuleUrl(moduleName: string, moduleVersion?: string): URL {
  const parts = moduleName.split('/');
  let filename = 'dist/index.js';
  let packageName = parts.shift();
  if (moduleName.startsWith('@') && parts.length) {
    packageName = `${packageName}/${parts.shift()}`;
  }
  if (parts.length) {
    filename = parts.join('/');
    if (!filename.includes('.')) {
      filename = filename + '.js';
    }
  }
  let version = moduleVersion || '*';
  if (version.startsWith('^')) {
    version = version.substr(1);
  }
  return new URL(
    `https://cdn.jsdelivr.net/npm/${packageName}@${version}/${filename}`
  );
}

interface Definition {
  loaded: Promise<Module>;
}

interface Module {
  dependencies: string[];
  factory: (...args: unknown[]) => unknown;
  exports?: Promise<unknown>;
}
