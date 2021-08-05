/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const esbuild = require('esbuild');

(async () => {
  await esbuild.build({
    entryPoints: ['src/index.css'],
    bundle: true,
    outfile: 'lib/index.css.txt',
  });

  await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    outfile: 'dist/manager.dev.js',
    format: 'esm',
  });
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    outfile: 'dist/manager.min.js',
    format: 'esm',
    minify: true,
  });
})();