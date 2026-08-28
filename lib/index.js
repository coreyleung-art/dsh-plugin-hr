"use strict";
// dsh-plugin-hr —— 资源管理模式（HR）插件
// 能力：
//   读总线数据（~/.dsh/agent-bus.json：profiles/locks/threads/lightLog）
//   webServer API（/hr/api/*）：
//     /hr/api/overview  —— 资源总览（档案数/锁数/线程数/待办数）
//     /hr/api/profiles  —— 会话档案列表（含 preset-fit 评分）
//     /hr/api/locks     —— 锁状态实时视图
//     /hr/api/todos     —— HR 待办队列（未登记档案/异常锁/capture 纪要）
//     /hr/api/preset-fit—— 模式评估结果（preset-fit.py 输出）
//     /hr/api/scripts   —— HR 工具脚本运行入口（bus-capture/profile-sync/role-scan/lock-audit）
// 配套 preset：resource-manager（~/.dsh/.agent-presets/resource-manager/）
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = exports.inject = exports.name = void 0;
exports.apply = apply;
const promises_1 = require("node:fs/promises");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const adapt_1 = require("./adapt");
const HR_LOG_FILE = (0, node_path_1.join)((0, node_os_1.homedir)(), '.dsh', 'hr-plugin.log');
function hrLog(msg) {
    try {
        (0, node_fs_1.appendFileSync)(HR_LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
    }
    catch (e) { /* 日志失败不阻塞 */ }
}
exports.name = 'hr';
exports.inject = ['webServer', 'tools'];
const PREFIX = '/hr/api';
const BUS_FILE = (0, node_path_1.join)((0, node_os_1.homedir)(), '.dsh', 'agent-bus.json');
const SCRIPTS_DIR = (0, node_path_1.join)((0, node_os_1.homedir)(), 'dsh-collab', 'scripts');
const REG_FILE = (0, node_path_1.join)((0, node_os_1.homedir)(), 'dsh-collab', 'resource-registry.md');
async function loadBus() {
    try {
        const raw = await (0, promises_1.readFile)(BUS_FILE, 'utf8');
        return JSON.parse(raw);
    }
    catch (e) {
        return { threads: [], locks: [], lightLog: [], profiles: [] };
    }
}
function runScript(script, args = []) {
    return new Promise((resolve) => {
        (0, node_child_process_1.execFile)('/usr/bin/python3', [(0, node_path_1.join)(SCRIPTS_DIR, script), ...args], { timeout: 30000 }, (err, stdout) => {
            resolve({ ok: !err, output: stdout || String(err?.message || ''), script });
        });
    });
}
// —— preset-fit 评分（与 scripts/preset-fit.py 同逻辑的轻量版）——
const DOMAIN_SIGNALS = {
    '运营': 3, '外卖': 3, '客服': 3, '供应链': 3, '依赖': 3,
    '知识库': 2, '调研': 2, '情报': 2, '设备': 2, '算力': 2,
    '媒体': 2, '外链': 2, '通道': 2, '摄取': 2, '归档': 2,
    '资源': 2, '治理': 2, '审计': 2, '成本': 2, '健康': 2,
    '文档': 1, '文件': 1, '开发': 1, '插件': 1, '测试': 1, '验收': 1,
};
const COMPLEX_KW = ['监控', '调度', '仲裁', '审批', '引擎', '管道', 'SDK', 'API', '协议', '算法', '模型', 'OCR', '爬虫', '自动化'];
function scoreRole(p) {
    const role = p.role || '';
    const abilities = p.abilities || [];
    const resources = p.resources || [];
    let domain = 0, ability = 0, resource = 0, declared = 0;
    for (const [kw, w] of Object.entries(DOMAIN_SIGNALS))
        if (role.includes(kw))
            domain += w;
    for (const a of abilities)
        for (const kw of COMPLEX_KW) {
            if (a.includes(kw)) {
                ability += 1;
                break;
            }
        }
    if (resources.length) {
        resource = Math.min(3, Math.floor(resources.length / 2) + 1);
        const rt = resources.join(' ');
        if (rt.includes('独占') || rt.includes('专属') || rt.includes('写'))
            resource += 1;
    }
    if (/智能体|专员|专家|员|管理|协调/.test(role))
        declared = 1;
    const total = domain + ability + resource + declared;
    let mode, detail;
    if (total >= 8) {
        if (resource >= 3 && domain >= 3) {
            mode = '🔧 preset + 📊 插件';
            detail = '专用 preset + 侧边栏/面板视图';
        }
        else {
            mode = '🔧 专用 preset';
            detail = '工具面收窄 + persona 纪律注入';
        }
    }
    else if (total >= 5) {
        mode = '📊 插件增强';
        detail = '标准模式够用，可加面板视图';
    }
    else {
        mode = '✅ 标准模式';
        detail = '工具面全即可';
    }
    return { score: total, domain, ability, resource, declared, mode, detail };
}
exports.Config = undefined;
async function apply(ctx) {
    // 插件化标准：dsh 版本自适应 + 统一文件日志
    try { (0, adapt_1.startAdaptGuard)(ctx, 'hr'); } catch (e) { hrLog('adapt-guard error: ' + String(e).slice(0, 100)); }
    hrLog('apply started');
    // 响应式注册：webServer 晚到时重试（agent-bus 同款机制）
    let routesRegistered = false;
    const json = (res, status, body) => {
        const payload = Buffer.from(JSON.stringify(body), 'utf8');
        res.writeHead(status, {
            'content-type': 'application/json; charset=utf-8',
            'content-length': payload.length,
            'cache-control': 'no-store',
        });
        res.end(payload);
    };
    const hostAllowed = (req) => {
        const host = req.headers.host ?? '';
        return host.startsWith('127.0.0.1') || host.startsWith('localhost') || host.startsWith('[::1]');
    };
    const routes = [
        ['/overview', async () => {
                const bus = await loadBus();
                const profiles = bus.profiles || [];
                const scored = profiles.map((p) => ({ ...p, fit: scoreRole(p) }));
                const needsPreset = scored.filter((s) => s.fit.score >= 8).length;
                const locks = (bus.locks || []).length;
                const threads = (bus.threads || []).length;
                // 待办：capture 纪要草稿数
                const { readdir } = await Promise.resolve().then(() => __importStar(require('node:fs/promises')));
                let summaries = 0;
                try {
                    summaries = (await readdir((0, node_path_1.join)((0, node_os_1.homedir)(), '.dsh', 'capture', 'summaries'))).length;
                }
                catch {
                    summaries = 0;
                }
                return { ok: true, profiles: profiles.length, needsPreset, locks, threads, summaries, updated: Date.now() };
            }],
        ['/profiles', async () => {
                const bus = await loadBus();
                const profiles = (bus.profiles || []).map((p) => ({ ...p, fit: scoreRole(p) }));
                return { ok: true, profiles };
            }],
        ['/locks', async () => {
                const bus = await loadBus();
                return { ok: true, locks: bus.locks || [], lightLog: (bus.lightLog || []).slice(-30) };
            }],
        ['/todos', async () => {
                const bus = await loadBus();
                const { readdir } = await Promise.resolve().then(() => __importStar(require('node:fs/promises')));
                const todos = [];
                // 1. 未登记档案（简版：profiles 数 vs 登记表 session- 出现数）
                try {
                    const reg = await (0, promises_1.readFile)(REG_FILE, 'utf8');
                    const regCount = (reg.match(/session-[0-9a-f]{8}/g) || []).length;
                    const busProfiles = (bus.profiles || []).length;
                    todos.push({ id: 'registry-sync', title: '档案登记同步', detail: `总线 ${busProfiles} 档案 vs 登记表 ${regCount} 会话`, severity: busProfiles > regCount ? 'warn' : 'ok' });
                }
                catch { /* 忽略 */ }
                // 2. 异常锁（持锁 >24h）
                const now = Date.now();
                for (const lk of bus.locks || []) {
                    const age = now - (lk.acquiredAt || 0);
                    if (age > 24 * 3600 * 1000) {
                        todos.push({ id: 'stale-lock', title: `疑似残留锁: ${lk.resource}`, detail: `holder=${lk.holder} 持锁 ${Math.round(age / 3600000)}h`, severity: 'danger' });
                    }
                }
                // 3. capture 纪要待审核
                try {
                    const files = await readdir((0, node_path_1.join)((0, node_os_1.homedir)(), '.dsh', 'capture', 'summaries'));
                    if (files.length)
                        todos.push({ id: 'capture-review', title: `capture 纪要待审核: ${files.length} 份`, detail: '文档摄取 55d4d1bd 按 J36 三轨落档', severity: 'info' });
                }
                catch { /* 忽略 */ }
                return { ok: true, todos };
            }],
        ['/preset-fit', async () => {
                const r = await runScript('preset-fit.py', ['--json']);
                let data = [];
                try {
                    data = JSON.parse(r.output);
                }
                catch {
                    data = [];
                }
                return { ok: r.ok, data };
            }],
        ['/run-script', async (body) => {
                const script = body?.script;
                if (!script || !['bus-capture.py', 'profile-sync-check.py', 'role-scan.py', 'lock-audit.py'].includes(script)) {
                    return { ok: false, error: 'invalid script' };
                }
                const args = script === 'bus-capture.py' ? ['--since=1', '--no-post'] : [];
                return await runScript(script, args);
            }],
    ];
    function registerRoutes() {
        if (routesRegistered)
            return;
        const wsNow = ctx.get('webServer', false);
        if (!wsNow || typeof wsNow.register !== 'function')
            return;
        routesRegistered = true;
        ctx.effect(() => wsNow.register({
            kind: 'prefix',
            path: PREFIX,
            handler: async (req, res) => {
                if (!hostAllowed(req)) {
                    json(res, 403, { ok: false, error: 'forbidden: untrusted host' });
                    return;
                }
                try {
                    const url = new URL(req.url ?? '/', 'http://localhost');
                    const p = url.pathname;
                    const route = routes.find(([rp]) => p === `${PREFIX}${rp}`);
                    if (!route) {
                        json(res, 404, { ok: false, error: `not found: ${p}` });
                        return;
                    }
                    const [, handlerFn] = route;
                    let body = undefined;
                    if (req.method === 'POST') {
                        const chunks = [];
                        for await (const c of req)
                            chunks.push(c);
                        try {
                            body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                        }
                        catch {
                            body = {};
                        }
                    }
                    const result = await handlerFn(body);
                    json(res, 200, result);
                }
                catch (e) {
                    json(res, 500, { ok: false, error: String(e?.message || e) });
                }
            },
        }));
        console.info(`[hr-plugin] ${routes.length} API routes registered under ${PREFIX}`);
    }
    // 立即尝试 + webServer 晚到重试
    registerRoutes();
    ctx.effect(() => registerRoutes());
}
