# Changelog · dsh-plugin-hr

## [迁移] - 2026-10-09

### CJS → ESM 迁移（代做）
- **时间戳**：2026-10-09T21:57
- **最后变动人**：session-b250bf9d
- **授权**：AUTH-20261009-dea67d017d9f（所有者原话：「4 个 cjs 插件做迁移，这次你代做。」）
- **通道**：plugin:dsh-plugin-hr
- **变更**：tsconfig.json 的 `module` commonjs→es2022；package.json 加 `"type": "module"`（原缺 ⇒ R006 ① 静态四要素不过）
- **验证**：tsc 重编译后 `lib/index.js` 为纯 ESM（`export` 语句、`exports.`/`require` 归零）；`node -e "import('./lib/index.js')"` 实测通过（`name`/`apply` 正常）；`lib/client.js` 未改动（仍为宿主 `__ModuleLoader__.load` 格式）。
- **回滚**：`git -C ~/dsh-plugin-hr checkout f1c8b62 -- .`，或 `cp -r /tmp/hr-before-esm/* ~/dsh-plugin-hr/`

## [0.1.0] - 2026-08-27

### 首版登记（版本管理补全）
- 定位：资源管理模式（HR）：侧边栏资源看板 + 会话面板
- 说明：本插件此前未做版本管理，本次补全 CHANGELOG + git 初始化。
