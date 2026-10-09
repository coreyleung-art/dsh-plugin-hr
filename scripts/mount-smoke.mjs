// scripts/mount-smoke.mjs — R006 v3.1.0 §2 ① 第5项【真挂载冒烟】(dsh-plugin-hr)
// 三态: pass / fail / skipped —— 绝不把 skipped 写成 pass。
// 用法(须在插件自身目录内跑, 依赖才解析得到):
//   ELECTRON_RUN_AS_NODE=1 /Applications/CLD.app/Contents/MacOS/CLD scripts/mount-smoke.mjs
//   ... --control=fault    正控: 注入故障, 必须 fail
//   ... --control=nodeps   反控: 依赖解析不到, 必须 skipped
//
// ★ 对模板的一处修正(提交协调者): 模板把 Cannot find module 一律归 skipped,
//   但 相对路径模块缺失(如 ./adapt) 是 插件真坏, 不是依赖环境问题 => 应判 fail。
//   本实现按 裸包说明符->skipped / 相对路径->fail 区分。

const mode = (process.argv.find((a) => a.startsWith("--control=")) || "").split("=")[1] || "normal";

function classify(e) {
  const msg = String((e && e.message) || e);
  if (/Cannot find module '(?:\.|\/)/.test(msg)) {
    return { state: "fail", error: "相对路径模块缺失 = 真实缺陷(非依赖环境问题): " + msg.split("\n")[0] };
  }
  if (/Cannot find package|ERR_MODULE_NOT_FOUND|Cannot find module/.test(msg)) {
    return { state: "skipped", reason: msg.split("\n")[0] };
  }
  return { state: "fail", error: msg.split("\n").slice(0, 3).join(" "), code: e && e.code };
}

if (mode === "nodeps") {
  // 反控: **必须在真正解析不到依赖的环境里构造** ——
  // 本插件 node_modules 是软链, 在其自身目录内依赖永远解析得到, 造不出该条件。
  // 故: 在空临时目录里跑一次裸包 import, 拿到真实的 ERR_MODULE_NOT_FOUND, 再用同一 classifier 判定。
  const { mkdtempSync, writeFileSync: wf } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { execFileSync } = await import("node:child_process");
  const dir = mkdtempSync(join(tmpdir(), "mount-smoke-nodeps-"));
  const probe = join(dir, "probe.mjs");
  wf(probe, 'try { await import("@deepseek-ai/dsh-tools"); console.log("RESOLVED"); } catch (e) { console.log("ERR:" + e.code + ":" + String(e.message).split("\\n")[0]); }');
  const out = execFileSync(process.execPath, [probe], { encoding: "utf8", cwd: dir }).trim();
  let s;
  if (out.startsWith("ERR:")) s = classify(new Error(out.slice(4)));
  else s = { state: "pass", note: "意外: 空目录下依赖居然解析到了" };
  console.log("[mount-smoke/反控] 环境:", dir.includes("mount-smoke-nodeps") ? "空临时目录(无 node_modules)" : dir);
  console.log("[mount-smoke/反控]", out.slice(0, 140));
  console.log("[mount-smoke/反控] 判定:", JSON.stringify(s));
  const ok = s.state === "skipped";
  console.log(ok ? "[mount-smoke/反控] OK 依赖不可解析 -> 如实报 skipped" : "[mount-smoke/反控] X 未判 skipped");
  process.exit(ok ? 0 : 1);
}
const registered = [];
const routes = [];
function makeCtx(breakIt) {
  const ws = {
    register: (r) => {
      if (breakIt) throw new Error("INJECTED_FAULT: webServer.register");
      registered.push("webServer.register");
      routes.push(r);
      return () => {};
    },
  };
  const tools = { register: () => { registered.push("tools.register"); return () => {}; } };
  // 本插件实测只用到 ctx.get / ctx.effect (lib/index.js:238 / 242)
  return {
    get: (name) => (name === "webServer" ? ws : name === "tools" ? tools : undefined),
    effect: (fn) => { const d = fn(); return typeof d === "function" ? d : () => {}; },
    on: () => () => {},
    logger: { info() {}, warn() {}, error() {}, debug() {} },
  };
}

let smoke;
try {
  const mod = await import("../lib/index.js");
  const apply = mod.apply || (mod.default && mod.default.apply);
  if (typeof apply !== "function") throw new Error("导出中找不到 apply —— 不是依赖问题, 是入口契约问题");
  await apply(makeCtx(mode === "fault"), {});
  if (registered.length === 0) throw new Error("apply 返回但未注册任何项(桩 ctx 已提供 webServer.register 与 tools.register)");
  smoke = { state: "pass", registered: registered.length, injected_routes: routes.length, entry: "lib/index.js", inject: mod.inject || null };
} catch (e) {
  smoke = classify(e);
}

console.log("[mount-smoke]", JSON.stringify(smoke));
if (mode === "fault") {
  console.log(smoke.state === "fail" ? "[mount-smoke/正控] OK 注入故障 -> 正确判 fail" : "[mount-smoke/正控] X 注入故障却判 " + smoke.state);
  process.exit(smoke.state === "fail" ? 0 : 1);
}
const tag = { pass: "挂载通过", fail: "挂不上(真实缺陷)", skipped: "已跳过(如实说明)" }[smoke.state];
console.log("[mount-smoke]", tag, smoke.state === "pass" ? "注册项 " + smoke.registered + " 个" : "");
process.exit(smoke.state === "pass" ? 0 : smoke.state === "skipped" ? 0 : 2);
