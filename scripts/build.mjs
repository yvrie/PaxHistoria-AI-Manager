import { mkdir, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const output = path.join(dist, 'PaxHistoria-AI-Manager.user.js');
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const userscriptBanner = `// ==UserScript==
// @name         PaxHistoria - AI Manager
// @namespace    https://paxhistoria.co/
// @homepageURL  https://github.com/yvrie/PaxHistoria-AI-Manager
// @supportURL   https://github.com/yvrie/PaxHistoria-AI-Manager/issues
// @version      ${version}
// @description  Connect AI providers and choose models for Pax Historia features.
// @match        https://paxhistoria.co/*
// @match        https://www.paxhistoria.co/*
// @match        http://paxhistoria.co/*
// @match        http://www.paxhistoria.co/*
// @match        https://paxhistoria.co/game/*
// @match        https://www.paxhistoria.co/game/*
// @include      https://paxhistoria.co/*
// @include      https://www.paxhistoria.co/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.registerMenuCommand
// @grant        GM.xmlHttpRequest
// @grant        unsafeWindow
// @connect      *
// @run-at       document-start
// @noframes
// ==/UserScript==
/* jshint esversion: 11, browser: true */
`;

await build({
  entryPoints: [path.join(root, 'src/relay/bootstrap.js')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2018'],
  legalComments: 'inline',
  outfile: output,
  banner: { js: userscriptBanner }
});

console.log('Built userscript: ' + path.relative(root, output));
