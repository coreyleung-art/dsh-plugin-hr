# dsh-plugin-hr · 资源管理模式（HR）插件：侧边栏资源看板 + 会话面板——资源/锁/档案/待办/preset-fit 评估可视化

> 版本见 `package.json`（单一来源）· 归属 `~/dsh-plugin-hr/`
> 本文档满足 R006 ⑤ 与 R039（工具中文描述文档）· 2026-10-03 存量补课（生成器 r006-retrofit.js）。

## ① 为什么需要（事故/证据）

资源管理模式（HR）插件：侧边栏资源看板 + 会话面板——资源/锁/档案/待办/preset-fit 评估可视化，配套 resource-manager preset

## ② 用法（含退出码）

插件随 CLD 挂载，宿主内注册以下工具：

| 工具 | 作用 |
|---|---|
| （未从源码抽取到工具，见 lib/index.js） |

自检 CLI：`node lib/selfcheck.js`（退出码 0=通过 / 1=失败）；治理入口 `node cli.js --tool-version`。

## ③ R006 达标矩阵

| 项 | 判定 | 说明 |
|---|---|---|
| ① dsh 插件形态 | ✓ | package.json + cordis.patch.yml + lib/index.js（apply） |
| ② TCC 检测 | ✓ | lib/selfcheck.js（补课新增，含真挂载冒烟三态） |
| ③④ CLD/版本自适应 | ✓ | 零宿主私有 API；peer 经正式声明 |
| ⑤ 文档化 | ✓ | 本文件 |
| ⑥ 版本管理 | ✓ | package.json 单一来源 + CHANGELOG |
| ⑦ 统一日志 | ⚠️ 部分 | 以宿主日志/黑板为准（本批未新增专用日志） |
| ⑧ 自动落链 | ⚠️ 部分 | 黑板 data/registry 登记卡随批登记 |
| ⑨ CLI 治理 | ✓ | cli.js（--tool-version/--selfcheck，未知旗标 exit 2） |
| ⑩ 约束前置 | N/A | 本插件无「不该发生路径」类危险操作 |

## ④ 坑（如实）

1. 本文档由补课生成器生成，工具表来自源码 defineTool 抽取；若与实现不符以源码为准。
2. 真挂载冒烟若为 fail/skipped，说明插件在缺宿主服务的桩环境下 apply 抛异常或依赖缺失——已如实记录，不伪装通过。
3. 存量插件的 ⑦⑧ 两项标注 ⚠️ 部分：补齐日志与登记卡属后续批次的治理动作。

## ⑤ 复现命令

```bash
cd ~/dsh-plugin-hr && node lib/selfcheck.js   # 期望 PASS（三态如实）
node cli.js --tool-version                    # 期望与 package.json 一致
```
