// dsh-plugin-hr client —— 资源管理模式（HR）前端
// 挂载点：
//   conversation.input.dock —— HR 待办/概览面板（TodoDock posture）
//   sidebar.workspaces     —— 侧边栏资源看板（DOM 注入，任务看板先例）
import React, { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------
interface Overview {
  ok: boolean; profiles: number; needsPreset: number; locks: number; threads: number; summaries: number; updated: number;
}
interface Todo { id: string; title: string; detail: string; severity: 'ok' | 'warn' | 'danger' | 'info'; }
interface ProfileView { agentId: string; role: string; fit?: { score: number; mode: string; detail: string }; }
interface LockView { resource: string; holder: string; note?: string; acquiredAt?: number; }

async function api<T>(path: string): Promise<T> {
  const res = await fetch(path);
  return res.json() as Promise<T>;
}

const SEV_COLOR: Record<string, string> = {
  ok: 'var(--dsw-alias-success, #4caf50)',
  warn: 'var(--dsw-alias-warning, #f59e0b)',
  danger: 'var(--dsw-alias-danger, #d93025)',
  info: 'var(--dsw-alias-label-secondary)',
};

function fmtTime(ms?: number): string {
  if (!ms) return '-';
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// 概览卡片
// ---------------------------------------------------------------------------
function OverviewCards({ data }: { data: Overview | null }) {
  if (!data) return <div style={styles.hint}>加载中…</div>;
  const cards = [
    { label: '档案', value: data.profiles },
    { label: '需专用模式', value: data.needsPreset },
    { label: '锁', value: data.locks },
    { label: '线程', value: data.threads },
    { label: '纪要待审', value: data.summaries },
  ];
  return (
    <div style={styles.grid}>
      {cards.map((c) => (
        <div key={c.label} style={styles.card}>
          <div style={styles.cardValue}>{c.value}</div>
          <div style={styles.cardLabel}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 待办列表
// ---------------------------------------------------------------------------
function TodoList({ todos }: { todos: Todo[] }) {
  if (!todos.length) return <div style={styles.hint}>✅ 无待办</div>;
  return (
    <div style={styles.list}>
      {todos.map((t) => (
        <div key={t.id} style={styles.todoRow}>
          <span style={{ ...styles.todoDot, background: SEV_COLOR[t.severity] || '#888' }} />
          <div style={styles.todoBody}>
            <div style={styles.todoTitle}>{t.title}</div>
            <div style={styles.todoDetail}>{t.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 锁状态
// ---------------------------------------------------------------------------
function LockList({ locks }: { locks: LockView[] }) {
  if (!locks.length) return <div style={styles.hint}>🟢 无持有锁</div>;
  return (
    <div style={styles.list}>
      {locks.map((lk, i) => (
        <div key={i} style={styles.todoRow}>
          <span style={{ ...styles.todoDot, background: '#f59e0b' }} />
          <div style={styles.todoBody}>
            <div style={styles.todoTitle}>{lk.resource}</div>
            <div style={styles.todoDetail}>holder={lk.holder?.slice(-8)} · {fmtTime(lk.acquiredAt)} · {lk.note?.slice(0, 40) || ''}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// preset-fit 评分表
// ---------------------------------------------------------------------------
function PresetFitTable({ profiles }: { profiles: ProfileView[] }) {
  const top = (profiles || []).filter((p) => p.fit && p.fit.score >= 5).sort((a, b) => (b.fit?.score || 0) - (a.fit?.score || 0)).slice(0, 12);
  if (!top.length) return <div style={styles.hint}>暂无评估数据（运行 preset-fit.py）</div>;
  return (
    <div style={styles.list}>
      {top.map((p) => (
        <div key={p.agentId} style={styles.todoRow}>
          <span style={{ ...styles.scoreBadge, background: (p.fit?.score || 0) >= 8 ? '#2d6a4f' : '#3d5a80' }}>{p.fit?.score}</span>
          <div style={styles.todoBody}>
            <div style={styles.todoTitle}>{p.role?.slice(0, 28) || p.agentId?.slice(0, 8)}</div>
            <div style={styles.todoDetail}>{p.fit?.mode} · {p.fit?.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 主面板（dock 组件）
// ---------------------------------------------------------------------------
function HrDock({ useInput, inputActions }: { useInput?: any; inputActions?: any }) {
  const [tab, setTab] = useState<'overview' | 'todos' | 'locks' | 'preset'>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [locks, setLocks] = useState<LockView[]>([]);
  const [profiles, setProfiles] = useState<ProfileView[]>([]);

  const refresh = () => {
    api<Overview>('/hr/api/overview').then(setOverview).catch(() => {});
    api<{ todos: Todo[] }>('/hr/api/todos').then((d) => setTodos(d.todos || [])).catch(() => {});
    api<{ locks: LockView[] }>('/hr/api/locks').then((d) => setLocks(d.locks || [])).catch(() => {});
    api<{ profiles: ProfileView[] }>('/hr/api/profiles').then((d) => setProfiles(d.profiles || [])).catch(() => {});
  };

  useEffect(() => { refresh(); }, []);
  useEffect(() => { const iv = setInterval(refresh, 60000); return () => clearInterval(iv); }, []);

  const tabs = [
    { key: 'overview', label: `概览${overview ? ` ${overview.profiles}` : ''}` },
    { key: 'todos', label: `待办${todos.length ? ` ${todos.length}` : ''}` },
    { key: 'locks', label: `锁${locks.length ? ` ${locks.length}` : ''}` },
    { key: 'preset', label: '模式评估' },
  ];

  return (
    <div style={styles.wrap}>
      <div style={styles.tabRow}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as any)} style={{ ...styles.tab, ...(tab === t.key ? styles.tabActive : {}) }}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={styles.body}>
        {tab === 'overview' && <OverviewCards data={overview} />}
        {tab === 'todos' && <TodoList todos={todos} />}
        {tab === 'locks' && <LockList locks={locks} />}
        {tab === 'preset' && <PresetFitTable profiles={profiles} />}
      </div>
      <div style={styles.footer}>
        <button style={styles.refreshBtn} onClick={refresh}>刷新</button>
        <span style={styles.footNote}>HR 资源管理 · 自动刷新 60s</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 侧边栏看板（DOM 注入，任务看板先例）
// ---------------------------------------------------------------------------
function mountSidebar(sessions?: any): () => void {
  let el: HTMLElement | null = null;
  let stopObs: (() => void) | null = null;

  const isHrSession = () => {
    const preset = currentPresetOf(sessions);
    return preset !== undefined && HR_PRESET_IDS.has(preset);
  };

  const mount = () => {
    // 非 HR 驾驶舱会话不注入侧边栏 DOM
    if (!isHrSession()) return;
    // 找侧边栏容器（ui-workspace 区域；找不到则跳过，靠 MutationObserver 自愈）
    const sidebar = document.querySelector('[data-workspace-pane], .workspace-pane, [class*="workspace"]');
    if (!sidebar || el) return;
    el = document.createElement('div');
    el.id = 'hr-sidebar-view';
    el.style.cssText = 'padding:8px 12px;border-top:1px solid rgba(127,127,127,.15);font-size:12px';
    el.innerHTML = '<div style="opacity:.6;font-size:11px;padding:4px 0">HR 资源看板</div><div style="opacity:.5">加载中…</div>';
    sidebar.appendChild(el);
    api<Overview>('/hr/api/overview').then((d) => {
      if (el) el.innerHTML = renderSidebar(d);
    }).catch(() => { if (el) el.textContent = 'HR 看板加载失败'; });
  };

  mount();
  const obs = new MutationObserver(() => { if (!el) mount(); });
  obs.observe(document.body, { childList: true, subtree: true });

  // 会话切换时重判：切到非 HR 会话则移除，切回 HR 则重新注入
  let unsubscribe: (() => void) | null = null;
  if (sessions?.list?.subscribe) {
    unsubscribe = sessions.list.subscribe(() => {
      if (isHrSession()) { if (!el) mount(); }
      else if (el) { el.remove(); el = null; }
    });
  }

  return () => {
    obs.disconnect();
    unsubscribe?.();
    el?.remove();
  };
}

function renderSidebar(d: Overview): string {
  return `
  <div style="display:flex;flex-wrap:wrap;gap:6px">
    ${[
      ['档案', d.profiles], ['需专用', d.needsPreset], ['锁', d.locks], ['线程', d.threads], ['纪要', d.summaries],
    ].map(([l, v]) => `<div style="flex:1;min-width:44px;text-align:center;background:rgba(127,127,127,.08);border-radius:8px;padding:6px 4px">
      <div style="font-size:16px;font-weight:600">${v}</div><div style="font-size:10px;opacity:.65">${l}</div></div>`).join('')}
  </div>
  <div style="margin-top:6px;font-size:10px;opacity:.5">HR 插件 v0.1 · 更新 ${fmtTime(d.updated)}</div>`;
}

// ---------------------------------------------------------------------------
// apply（preset 门控：仅「HR 驾驶舱模式（resource-manager）」会话显示看板）
// ---------------------------------------------------------------------------
// 会话摘要 sessionSummarySchema.agentPreset 标识会话启动时的 preset id；
// 「HR 驾驶舱模式」preset 注册名 = resource-manager（preset.yml order=6）。
//
// 安全设计（避免重复 register 崩溃）：
//   slot 只在 apply 里「一次性」inject，绝不动态卸载/重复注册；
//   preset 判断下沉到 React 组件内部（纯渲染逻辑，订阅 sessions.list 后
//   按当前会话 preset 决定「渲染看板」还是「渲染空」），规避 slots 层
//   对同 id 重复 register 抛 "already has an entry" 的风险。
const HR_PRESET_IDS = new Set(['resource-manager', 'hr-cockpit']);

function currentPresetOf(sessions: any): string | undefined {
  try {
    const snap = sessions?.list?.getSnapshot?.();
    const currentId = snap?.current;
    if (!currentId) return undefined;
    return snap?.byId?.[currentId]?.agentPreset;
  } catch {
    return undefined;
  }
}

// 订阅当前会话 preset 的 React hook（sessions.list 是快照 store，可订阅）
function useCurrentPreset(sessions: any): string | undefined {
  const [preset, setPreset] = useState<string | undefined>(() => currentPresetOf(sessions));
  useEffect(() => {
    const update = () => setPreset(currentPresetOf(sessions));
    update();
    if (sessions?.list?.subscribe) return sessions.list.subscribe(update);
    return undefined;
  }, [sessions]);
  return preset;
}

// dock 面板门控壳：非 HR 驾驶舱会话渲染空（slot 已注册，仅控制内容显隐）
function GatedHrDock(props: { useInput?: any; inputActions?: any; sessions?: any }) {
  const preset = useCurrentPreset(props.sessions);
  if (preset === undefined || !HR_PRESET_IDS.has(preset)) return null;
  return React.createElement(HrDock as any, props);
}

function apply(ctx: { slots: any; effect: any; sessions?: any }) {
  console.info('[hr-plugin] client v0.1.0 loading (preset-gated)');

  const sessions = ctx.sessions ?? ctx.get?.('sessions');

  // dock 面板：slot 一次性 inject（不动态卸载），门控在 GatedHrDock 内部
  ctx.slots.inject('conversation.input.dock', () =>
    ctx.slots.register(
      { name: 'conversation.input.dock', id: 'hr-panel', order: 40 },
      (props: any) => React.createElement(GatedHrDock as any, { ...props, sessions })
    )
  );

  // 侧边栏看板：同样下沉门控——非 HR 会话不注入 DOM（mountSidebar 内判断 preset）
  ctx.effect(() => mountSidebar(sessions));

  console.info('[hr-plugin] preset-gated client ready');
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { padding: '4px 2px' },
  tabRow: { display: 'flex', gap: 2, marginBottom: 6 },
  tab: { flex: 1, padding: '5px 4px', fontSize: 11, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--dsw-alias-label-secondary)', cursor: 'pointer' },
  tabActive: { background: 'rgba(127,127,127,.14)', color: 'var(--dsw-alias-label-primary)' },
  body: { minHeight: 120, maxHeight: 320, overflowY: 'auto' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 },
  card: { background: 'rgba(127,127,127,.07)', borderRadius: 8, padding: '8px 6px', textAlign: 'center' },
  cardValue: { fontSize: 18, fontWeight: 600 },
  cardLabel: { fontSize: 10, opacity: .6, marginTop: 2 },
  list: { display: 'flex', flexDirection: 'column', gap: 4 },
  todoRow: { display: 'flex', gap: 8, alignItems: 'flex-start', padding: '4px 2px', borderRadius: 6 },
  todoDot: { width: 8, height: 8, borderRadius: '50%', flex: 'none', marginTop: 4 },
  todoBody: { flex: 1, minWidth: 0 },
  todoTitle: { fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  todoDetail: { fontSize: 10, opacity: .6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  scoreBadge: { width: 22, height: 22, borderRadius: '50%', color: '#fff', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' },
  hint: { fontSize: 11, opacity: .55, padding: '8px 2px' },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingTop: 4, borderTop: '1px solid rgba(127,127,127,.12)' },
  refreshBtn: { fontSize: 10, padding: '2px 10px', borderRadius: 6, border: '1px solid rgba(127,127,127,.25)', background: 'transparent', color: 'var(--dsw-alias-label-secondary)', cursor: 'pointer' },
  footNote: { fontSize: 9, opacity: .45 },
};

export { apply };
export const inject = ['slots', 'effect', 'sessions'];
declare const module: { exports: unknown } | undefined;
if (typeof module !== 'undefined' && module !== null) {
  module.exports = { apply, inject };
}
