#!/usr/bin/env node
// dsh-plugin-hr 构建脚本
// 1) tsc 构建 node 端 (src/index.ts -> lib/index.js)
// 2) esbuild 打包 client 端 (src/client/index.tsx -> lib/client.js, __ModuleLoader__.load 格式)
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lib = join(root, 'lib');

function run(cmd) {
  console.log('>', cmd);
  execSync(cmd, { cwd: root, stdio: 'inherit' });
}

// 1. node 端
mkdirSync(lib, { recursive: true });
run('npx tsc -p tsconfig.json');

// 2. client 端打包（CJS factory 承接 esbuild module.exports）
run('npx esbuild src/client/index.tsx --bundle --format=cjs --platform=browser --target=es2022 --outfile=lib/.client.tmp.js --log-level=warning --external:react --external:react/jsx-runtime --external:@deepseek-ai/*');

// 3. 包装成 __ModuleLoader__.load 格式
const bundle = readFileSync(join(lib, '.client.tmp.js'), 'utf8');
const wrapped = `window.__ModuleLoader__.load({
  id: "dsh-plugin-hr",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${bundle}
    return module.exports;
  }
});
`;
writeFileSync(join(lib, 'client.js'), wrapped);
console.log('> wrote lib/client.js', wrapped.length, 'bytes');

// 4. 清理
try { execSync('rm -f lib/.client.tmp.js', { cwd: root }); } catch {}

console.log('> build done');
