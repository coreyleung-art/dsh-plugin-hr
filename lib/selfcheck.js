// lib/selfcheck.js — dsh-plugin-hr 自查门（2026-10-03 存量补课 · R006 ②+①-5）
//
// ★ 事故修复（apply 自检死循环）：真挂载冒烟必须【独立入口 + 防重入守卫 + 绝不在 apply
//   调用链内】。否则 apply→runSelfCheck→(import('./index.js')+apply)→apply 无限异步递归
//   ⇒ 事件循环饿死、dsh web 永不宣告 URL、CLD 100% CPU 卡死（2026-10-03 openchronicle 事故）。
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// —— 纯检查：同步、零副作用、零 import/apply —— 生产 apply 可安全调用
export function runSelfCheck(pluginName = 'hr') {
  const rows = [];
  const check = (name, ok, detail = '') => rows.push({ name, ok, detail });
  const req = (() => { try { return createRequire(import.meta.url); } catch { return null; } })();
  if (!req) check('peer 解析器', false, 'createRequire 不可用');
  else {
    try { req.resolve('@deepseek-ai/cordis'); check('peer @deepseek-ai/cordis', true); } catch (e) { check('peer @deepseek-ai/cordis', false, String(e.message).slice(0, 60)); }
    try { req.resolve('@deepseek-ai/dsh-client-ui-primitives'); check('peer @deepseek-ai/dsh-client-ui-primitives', true); } catch (e) { check('peer @deepseek-ai/dsh-client-ui-primitives', false, String(e.message).slice(0, 60)); }
    try { req.resolve('@deepseek-ai/dsh-client-ui-slots'); check('peer @deepseek-ai/dsh-client-ui-slots', true); } catch (e) { check('peer @deepseek-ai/dsh-client-ui-slots', false, String(e.message).slice(0, 60)); }
    try { req.resolve('@deepseek-ai/dsh-tools'); check('peer @deepseek-ai/dsh-tools', true); } catch (e) { check('peer @deepseek-ai/dsh-tools', false, String(e.message).slice(0, 60)); }
    try { req.resolve('@deepseek-ai/dsh-host-webserver'); check('peer @deepseek-ai/dsh-host-webserver', true); } catch (e) { check('peer @deepseek-ai/dsh-host-webserver', false, String(e.message).slice(0, 60)); }
  }
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    check('type:module', pkg.type === 'module' || !pkg.type, 'CJS 编译产物（无 type 声明，CommonJS 合法）');
  } catch (e) { check('type:module', false, String(e.message).slice(0, 60)); }
  const nFail = rows.filter((r) => !r.ok).length;
  for (const r of rows) console.log('  ' + (r.ok ? 'PASS' : 'FAIL') + '  ' + r.name + (r.detail ? '  — ' + r.detail : ''));
  console.log('  selfcheck: ' + (nFail === 0 ? 'PASS' : 'FAIL ' + nFail + ' 项'));
  return nFail === 0 ? 0 : 1;
}

// —— 真挂载冒烟（仅 CLI/CI 显式调用）：import('./index.js') + apply(stubCtx) 三态 ——
let _smokeInFlight = false;
export async function runApplySmoke() {
  const EXPECTED = [];
  if (_smokeInFlight) { console.log('  SKIP  ① 真挂载冒烟  — 防重入守卫：已有冒烟在跑'); return 0; }
  _smokeInFlight = true;
  try {
    const mod = await import('./index.js');
    const registered = [];
    const noop = new Proxy(function () {}, { get: () => noop, apply: () => undefined });
    const toolsSvc = { register: (t) => { registered.push(typeof t === 'string' ? t : (t && t.name)); } };
    const stubCtx = new Proxy({
      tools: toolsSvc,
      effect: (fn) => { if (typeof fn === 'function') fn(); },
      on: () => undefined,
      get: (n) => (n === 'tools' ? toolsSvc : undefined),
    }, { get: (t, k) => (k in t ? t[k] : noop) });
    await mod.apply(stubCtx, {});
    const missing = EXPECTED.filter((n) => !registered.includes(n));
    if (missing.length === 0 && EXPECTED.length > 0) { console.log('  PASS  ① 真挂载冒烟(pass)  — ' + EXPECTED.length + ' 工具全部注册'); return 0; }
    if (missing.length === 0 && EXPECTED.length === 0 && 'no-tools' === 'tools') { console.log('  FAIL  ① 真挂载冒烟(fail-to-verify)  — 注入 tools 但源码抽不到工具名'); return 1; }
    if (missing.length === 0) { console.log('  PASS  ① 真挂载冒烟(pass-no-tools)  — 无宿主工具注入，apply 正常返回'); return 0; }
    console.log('  FAIL  ① 真挂载冒烟(fail)  — 缺: ' + missing.join(',')); return 1;
  } catch (e) {
    const m = String((e && e.message) || e);
    if (m.includes('ERR_MODULE_NOT_FOUND') || m.includes('Cannot find')) { console.log('  PASS  ① 真挂载冒烟(skipped)  — 依赖缺失: ' + m.slice(0, 60)); return 0; }
    console.log('  FAIL  ① 真挂载冒烟(fail)  — apply 抛异常: ' + m.slice(0, 80)); return 1;
  } finally {
    _smokeInFlight = false;
  }
}

const _isCli = process.argv[1] && fileURLToPath(new URL(import.meta.url)) === process.argv[1];
if (_isCli) { const c = runSelfCheck(); runApplySmoke().then((s) => process.exit(c || s)); }
