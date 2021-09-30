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
 * A simple test server for locally running a widget manager in a vanilla HTML
 * file, for easier debugging.
 */
import fs from 'fs';
import {IncomingMessage, ServerResponse} from 'http';
import http from 'http';
import {AddressInfo} from 'net';
import path from 'path';

const esbuild = require('esbuild');

async function serveDev(response: ServerResponse) {
  await esbuild.build({
    entryPoints: ['./src/index.css'],
    bundle: true,
    outfile: './lib/index.css.txt',
  });

  await esbuild.build({
    entryPoints: ['./src/index.ts'],
    bundle: true,
    outfile: './dist/manager.dev.js',
    format: 'esm',
  });
  const contents = await fs.promises.readFile('./dist/manager.dev.js');
  response.writeHead(200, {
    'Content-Type': 'text/javascript',
    'Access-Control-Allow-Origin': '*',
  });
  response.end(contents);
}

async function serveTest(request: IncomingMessage, response: ServerResponse) {
  const testFolder = path.resolve(path.normalize('./test/'));
  const toServe = path.resolve(
    path.normalize(path.join('./test/', request.url!))
  );
  if (!toServe.startsWith(testFolder)) {
    throw new Error('not allowed');
  }
  const contents = await fs.promises.readFile(toServe);
  let contentType = 'text/plain';
  switch (path.extname(toServe)) {
    case '.html':
      contentType = 'text/html';
      break;
    case '.js':
      contentType = 'text/javascript';
      break;
  }
  response.writeHead(200, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
  });
  response.end(contents);
}

const server = http
  .createServer({}, async (request, response) => {
    console.log(request.url);
    try {
      if (request.url === '/manager.dev.js') {
        await serveDev(response);
        return;
      }
      await serveTest(request, response);
      return;
    } catch (error) {
      response.writeHead(500, 'Error');
      response.end(String(error));
      console.error(error);
    }
  })
  .listen(9897, '127.0.0.1', () => {
    const address = server.address() as AddressInfo;
    console.log(`Listening on http://127.0.0.1:${address.port}`);
  });
