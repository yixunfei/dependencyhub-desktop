# Bug 分诊报告（2026-09-18 接手排查）

> **修复状态（2026-09-18 当日）**：B1–B24 已全部修复并通过全量门禁，详见文末"修复记录"。

范围：`electron/`、`shared/`、`src/`、`scripts/`。方法：跑通全部既有验证门禁取得基线，然后对主进程/IPC、渲染层状态、管理器执行链路做新一轮只读审查，所有结论均有 file:line 证据并经人工抽查复核。三轮历史评审（PROJECT_REVIEW.md、SUPPLEMENT、2026-09-17）中已修复的 F1–F5、S1–S5 不再重复报告。

## 一、基线验证结果

| 门禁 | 结果 |
| --- | --- |
| `npm run typecheck`（renderer + electron） | ✅ 通过 |
| `npm test`（vitest + build 脚本测试） | ✅ 通过 |
| `npm run verify:core` | ✅ 通过 |
| `npm run verify:hardening` | ✅ 通过（54 checks） |
| `npm run verify:manager-contracts` | ✅ 通过（57 managers） |
| `npm run verify:ipc` | ❌ **失败**（见 B5） |

---

## 二、P1：高严重度（数据丢失 / 主进程崩溃 / 门禁失败）

### B1. 扩展管理器执行链路绕过写操作串行队列
- **位置**：`electron/services/extendedManager.ts:347-366`（`executePlanned` → `runArgs` 直调）；`electron/managers/profiledAdapter.ts:136`。对照 `execute()`（:392-394）有 `withProjectMutation` 包裹，`runArgs`（:397-427）内部无任何队列。
- **触发条件**：同一项目上并发触发两个走 planner 路径的写操作（deno/cocoapods/swiftpm/cloud/infra/ai/helmfile 均走 `operationPlanner` → `executePlanned`），或一个走 planner 路径、另一个走 `execute()` 路径。
- **根本原因**：S1.1 修复（写操作统一接入 `withProjectMutation` 串行队列）只覆盖了 `execute()` 入口；`executePlanned` 是后加的独立入口，未接入同一队列，绕过了互斥、快照与取消检查。
- **影响**：并发写清单/锁文件互相覆盖、后写胜出，改动静默丢失；备份/恢复语义互相冲突。这是 09-16 修复主张（"49 个写入口共享互斥"）的真实漏洞。
- **修复方案**：在 `executePlanned` 内对 `!dryRun && commandMutatesProjectFiles(args)` 的情况同样包 `withProjectMutation(cwd, run)`；或下沉到 `runArgs` 统一判断，避免第三个入口再次绕过。补充并发写回归用例到 `verify:hardening`。

### B2. Windows cmd 参数转义在双引号内失效，且 `%` 完全未转义
- **位置**：`electron/services/commandRunner.ts:112-121`（`formatCmdArg`）。
- **触发条件**：Windows 下参数含 `& < > ( )` 或 `%`，例如 `npm run <script> -- --grep "a&b"`、pip 安装含 `%xx%` 的 URL、包名/版本参数带 `%`。
- **根本原因**：两个错误叠加——(1) cmd 在双引号内不解释 `^`，现有转义把 `&` 变成字面 `^&` 传给子进程；(2) `%VAR%` 在引号内仍会被 cmd 展开，口令/token/编码 URL 会被环境变量展开破坏。
- **影响**：命令语义改变或失败；`%` 场景下存在把环境变量值注入命令参数的隐患。
- **修复方案**：引号包裹的参数不再插入 `^`；`%` 成对转义（`%%`）或对 `.cmd` shim 场景改走无 shell 的 spawn 数组路径。修复需覆盖 npm/pip 实际调用矩阵，含特殊字符参数的负向用例。

### B3. 凭据库并发丢更新与失败时清空整个 vault
- **位置**：`electron/services/credentialVaultCore.ts:163-198`（`touch`/`readVault`/`writeVault`），:196 `unlink(path)` 后重试 rename。
- **触发条件**：并发"发布（resolve → touch 回写 lastUsedAt）"与"保存/删除凭据"；或 rename 失败后第二次 rename 也失败。
- **根本原因**：固定 `${path}.tmp` 临时文件（并发写互相覆盖）+ 无锁 read-modify-write；失败恢复分支先删目标文件再 rename，第二次 rename 失败即丢掉整个 vault。
- **影响**：凭据静默丢失或 vault 文件损坏；项目 4.4 已指出固定 .tmp 问题但未修。
- **修复方案**：按 vaultPath 排队串行化（复用 `projectMutation` 同款队列模式）；临时文件用唯一名（pid+随机）；失败分支不预删目标，rename 前校验 tmp 存在。补并发保存/删除/resolve 竞态测试。

### B4. 终端会话写入可使主进程崩溃
- **位置**：`electron/services/terminal.ts:57-63`（`write` 无 stdin error 监听、无 destroyed 检查）。
- **触发条件**：shell 已退出但 `close` 事件尚未派发的窗口期内调用 `terminal:write`（如终端里 `exit` 后立即输入）；`killed` 标志此时仍为 false。
- **根本原因**：`stdin.write(data)` 无回调，stdin 流的 `error`（ERR_STREAM_DESTROYED）无人监听 → uncaughtException → 主进程崩溃，全部窗口关闭。
- **影响**：单个终端竞态导致整个应用崩溃。
- **修复方案**：`write` 前检查 `stdin.destroyed || stdin.writableEnded`；给 stdin 挂 `error` 监听（丢弃或转 `terminal:data`）；`write(data, cb)` 吞掉异步错误。

### B5. `verify:ipc` 门禁失败（当前唯一红灯）
- **位置**：`scripts/verify-ipc-bridge.mjs:33`（`window.loadURL('data:text/html,...')` → `ERR_FAILED(-2)`）。
- **触发条件**：直接运行 `npm run verify:ipc`，Electron 42 上加载 data: URL 失败。
- **根本原因**：依赖 data: URL 作为顶层页面加载，受 Chromium 对 data: 顶层导航的限制/网络服务初始化失败影响（本机同时出现 WSA 10108 日志，存在环境相关性；但该写法本身脆弱）。
- **影响**：IPC 失败封套回归门禁失效，本批修复无法靠它验收。
- **修复方案**：改为向临时目录写 `index.html` 并 `loadFile` 加载，消除对 data: URL 的依赖；重跑验证。

### B6. 项目页 watcher 注册竞态：监听器泄漏 + 对已离开项目持续刷新
- **位置**：`src/features/managers/npm/scopes/project/Project.tsx:75-115`（`Global.tsx` 同型需一并排查）。
- **触发条件**：快速连续切换项目 A → B：清理函数同步执行 `stopWatcher`，而旧的 `startWatcher` 还在 `await detect`，其后的 `watcher.start(currentPath=A)` + `onChange` 在 stop 之后才落地。
- **根本原因**：注册流程异步、清理同步，无 mounted 标记/序号校验；onChange 闭包持有旧 `currentPath`。
- **影响**：监听器泄漏；后台对 A 项目持续 `fetchProjectPackages(A, true)`，浪费资源并可能触发过时通知。
- **修复方案**：闭包内 `let active = true`，清理时置 false；注册 `onChange` 前先 `removeChangeListener`；响应回调里校验当前 path 与最新路径一致。

---

## 三、P2：中严重度（错误结果 / 体验缺陷）

### B7. "安全版本"回退逻辑会把跨 major 最新版标为 safe
- **位置**：`electron/services/smartUpdate.ts:170-171`（`findSafeVersion` 第二回退 `versions.find(gt(current))`，versions 为 rcompare 降序，恒取最新版）。
- **触发**：存在安全修复版本但 `securityVersions` 匹配失败时。
- **影响**：UI 把 major 升级当"safe"推荐，违背 smart update 的风险分级承诺。
- **修复**：删除大版本回退，仅允许同 major 内的最新安全版；找不到就返回 null 并提示无 safe 选项。

### B8. packageStore 全局 `loading` 被四类并发操作共用
- **位置**：`src/stores/packageStore.ts:318/386`（置 false）与 `:183/302`（置 true）；`Project.tsx:71` 整 store 订阅放大重渲染。
- **触发**：项目加载 + 全局加载 + 安装操作并发。
- **影响**：任一先完成即解除 loading，Spin 提前消失、按钮提前可用。
- **修复**：按 scope 拆分 loading 键或引入计数器。

### B9. searchStore 搜索竞态 + loading 共用
- **位置**：`src/stores/searchStore.ts:27-43`；`Project.tsx:327-345`（loadPackageOptions）同型。
- **触发**：快速连续搜索。
- **影响**：旧响应覆盖新结果。与 F2 同类但漏修的 store。
- **修复**：复制 `useWorkspaceRequest` 的请求序号模式。

### B10. `clearCache` 键未归一化，路径大小写/尾斜杠不一致时清缓存失效
- **位置**：`src/stores/packageStore.ts:148-153`（原始 cwd）vs `:144`（normalize 后 setCache）。
- **修复**：clearCache 同样走 `normalizeProjectPath`。

### B11. "检查更新"不传 force，5 分钟缓存内直接返回旧缓存并提示"检查完成"
- **位置**：`Project.tsx:429`、`Global.tsx:86`。
- **修复**：该入口传 `forceRefresh=true`。

### B12. RuntimeLocalizer 用 WeakMap 旧原文覆盖 React 新写入的中文
- **位置**：`src/components/Localization/RuntimeLocalizer.tsx:58-59, 89-93`（characterData 触发即回写旧译文）。
- **影响**：zh-CN 下计数/状态类动态文本滞留旧值直到下次重渲染。已知架构风险的实际危害点。
- **修复**：characterData 变更时以 React 写入的新文本为准更新 WeakMap（或跳过该节点），不做旧值覆盖。

### B13. pubspec.yaml / build.gradle 编辑破坏 CRLF 行尾
- **位置**：`electron/services/flutter.ts:600-615`（upsert/remove 统一 `join('\n')`）、`:201/:232/:286/:294` 直接 writeFile；`electron/services/gradle.ts:232-248`（且 upsert 只匹配首个 `dependencies {`，注释/字符串中的该串会插错块）。
- **影响**：CRLF 项目每次增删依赖产生全文件 diff，污染版本控制。
- **修复**：检测原行尾并按原行尾 join；gradle 匹配限定顶层块。

### B14. persist 缓存损坏导致所有 fetch 崩溃
- **位置**：`src/stores/packageStore.ts:466-472`（persist 无 version/migrate 校验）、`:139-141`、`:160-165`（直接索引 `state.cache[...]`）。
- **触发**：localStorage 中 `cache` 字段损坏为 null/非对象。
- **修复**：persist 加 `merge` 校验 cache 形状，异常时重置。

### B15. system 类命令无超时、不可取消
- **位置**：`electron/services/system.ts:9-21`（裸 `execFileAsync`，不经过 `CommandProcess`/operationContext）。
- **触发**：`system:update-npm`、`clear-cache` 等在网络慢时。
- **影响**：可永久挂起占住渲染请求。
- **修复**：统一走 `runLoggedCommand`（获得 timeout/signal/operationId）。

### B16. FileWatcher 以原始路径作键，Windows 路径别名重复监听；窗口关闭未清理
- **位置**：`electron/services/watcher.ts:68, 72-75, 123-135`；`electron/main.ts:484-489`（closed 未 `unwatchAll`）。
- **影响**：`C:\Proj\X` 与 `c:\proj\x` 双 watcher、重复 `file-change`；macOS 关窗泄漏。
- **修复**：键统一 `projectIdentity()`；closed 回调清理。

---

## 四、P3：低严重度

| # | 位置 | 问题 | 修复方向 |
| --- | --- | --- | --- |
| B17 | `extendedManager.ts:2879-2882` | deno.json 注释剥离只豁免 `://`，字符串内其他 `//` 被截断 → 清单解析失败为空 | 改用保守的 JSON-aware 剥离或仅处理行首注释 |
| B18 | `go.ts:177-215` | `go list -m` 失败回退 declared 时不解析 replace/exclude，展示未替换版本 | fallback 解析 replace 指令 |
| B19 | `projectGuard.ts:62-69` | 排队中取消仍会获得锁跑一轮再抛 cancelled，无谓延迟后续写操作 | 入队前/获得锁后复查 `signal.aborted` 直接跳过 |
| B20 | `npm.ts:259-268, 432-440` | npm login/adduser spawn 无 `error` 处理（npmBin 解析失败即崩溃）；`stdio:'inherit'` 在打包 GUI 下登录提示不可见 | 加 `on('error')`；改 pipe 回传提示 |
| B21 | `CommandLogWindow.tsx:70,360` | terminalBuffer 无上限累积，长会话内存/渲染失控 | 环形缓冲截断 |
| B22 | `DependencyTreeViewer.tsx` convertTree | key=`parent/name`，同级同名依赖重复 key，Tree 展开态错乱 | key 加路径或序号 |
| B23 | `MultiManager.tsx:21-46` | loadProjectInfo 无失效校验，快速切换项目旧结果覆盖新信息 | 请求序号 |

---

## 五、修复批次建议（按依赖与风险排序）

1. **批次一（P1，先修）**：B5（恢复 IPC 门禁，其他修复的验收依赖它）→ B1（写队列绕过）→ B4（崩溃）→ B3（凭据丢失）→ B2（cmd 转义，影响面广需回归矩阵）→ B6（watcher 竞态）。
2. **批次二（P2）**：B7、B9/B10/B11（同属请求/缓存一致性）、B13、B14、B15、B16、B8、B12。
3. **批次三（P3）**：顺手修，单独立 commit。

每批修复后必跑：`npm run typecheck`、`npm test`、`verify:core`、`verify:hardening`、`verify:ipc`、`verify:manager-contracts`；批次一再补 2-3 条行为回归（executePlanned 并发写、terminal 退出后写入、vault 并发保存）进 hardening verifier。

## 六、回归测试建议

- **B1**：临时项目上并发发起两个 planner 写操作（如 deno add + deno remove），断言第二次在队列中等待、清单无交叉写入。
- **B2**：特殊字符参数（`a&b`、`%PATH%`、含空格）经 npm.cmd shim 执行后子进程收到的 argv 快照断言。
- **B3**：并发 save/delete/resolve ×50 后 vault 文件合法、凭据数量正确；模拟 rename 失败断言原 vault 完好。
- **B4**：真实子进程 `exit` 后立即 write，断言主进程不崩溃。
- **B13**：CRLF fixture 增删依赖后字节级行尾不变。
- **B12/B9**：渲染层组件测试补乱序/动态文本用例。

---

## 七、修复记录（2026-09-18 当日完成）

### 修复后门禁结果（全绿）

| 门禁 | 结果 |
| --- | --- |
| `npm run typecheck`（renderer + electron） | ✅ |
| `npm run build`（含 vite 生产构建） | ✅ |
| `npm test` | ✅ 36 项（新增 terminalWrite 3 项） |
| `npm run verify:core` | ✅ |
| `npm run verify:hardening` | ✅ **62 项**（原 54 + B2 cmd 转义 4 项 + B3 凭据并发 4 项） |
| `npm run verify:ipc` | ✅（修复后恢复） |
| `npm run verify:manager-contracts` | ✅ 57 managers |
| `npm run verify:i18n` | ✅ |
| `npm run verify:engineering-debt` | ✅ 320 文件 AST 检查 |

### 逐项落实情况

| 项 | 实际改动 | 与方案偏差 |
| --- | --- | --- |
| B1 | `extendedManager.ts` `executePlanned` 对 `!dryRun && commandMutatesProjectFiles(args)` 包 `withProjectMutation` | 无 |
| B2 | `commandRunner.ts` `formatCmdArg` 重写：引号内不再插 `^`；`%` 以 `"^%"` 形式移出引号 | 无 |
| B3 | `credentialVaultCore.ts`：新增按实例串行队列，save/delete/touch 全部入队；临时文件改 `path.<uuid>.tmp`；rename 失败改为删除临时文件并抛错，不再 unlink 活跃 vault | 无 |
| B4 | `terminal.ts`：stdin 挂 no-op `error` 监听；`write` 前检查 `destroyed/writableEnded`，write 回调吞错 | 无 |
| B5 | `verify-ipc-bridge.mjs`：data: URL 改为临时 `index.html` + `loadFile`；补 `no-sandbox`/`disable-gpu` 开关（受限环境下 Chromium GPU/网络服务子进程被阻断所致，真机上也无害） | 方案升级：仅改 loadFile 在沙箱仍失败，根因是子进程受限 |
| B6 | `Project.tsx` watcher 注册改为传入 `isActive` 闭包标记；注册前先 stop+removeChangeListener；回调校验 path 与 active | 无 |
| B7 | `smartUpdate.ts` 删除大版本回退，safe 仅取安全集合内版本 | 无 |
| B8 | `packageStore.ts` 拆 `projectLoading`/`globalLoading`/`mutating`，消费方（Project/Global）逐个绑定；删除无消费方的 `setLoading` | 无 |
| B9 | `searchStore.ts` 请求序号 + `detailLoading` 独立；`loadPackageOptions` 本地序号 | 无 |
| B10 | `clearCache` 走 `normalizeProjectPath` | 无 |
| B11 | Project/Global "检查更新"传 force | 无 |
| B12 | `RuntimeLocalizer.tsx` characterData 改 last-writer-wins：文本变化时更新 WeakMap 并跳过覆盖 | 无 |
| B13 | `flutter.ts` 新增 `detectLineEnding/withLineEnding` 保留原行尾；`gradle.ts` 同样保留行尾且 upsert 匹配收紧为顶格 `dependencies {` | gradle 采用 LF 归一化编辑后还原行尾的实现 |
| B14 | `packageStore.ts` persist 加 `isCacheShape` 守卫 + `merge`，损坏即重置 cache | 无 |
| B15 | `system.ts` 改用 `runLoggedCommand`（timeout/signal/operationId，log:false 不污染工作台）；删除裸 execFile 路径 | 无 |
| B16 | `watcher.ts` Map 键改 `projectIdentity()`，新增原始路径映射保持出参不变；`main.ts` closed 回调补 `unwatchAll()` | 无 |
| B17 | `extendedManager.ts` `stripJsonComments` 改字符级扫描（跟踪字符串/转义），字符串内 `//` 不误伤 | 无 |
| B18 | `go.ts` 解析单行 `replace old => new [version]` 并应用为展示版本（块形式 replace 仍不解析，记为已知限制） | 无 |
| B19 | `projectGuard.ts` 任务获得锁后复查 `signal.aborted`，已取消短路抛 `OperationCancelledError` | 无 |
| B20 | `npm.ts` login/adduser 补 `child.on('error')` 转结构化失败；stdio 保持 inherit（GUI 无 TTY 限制已注释说明） | stdio 未按方案改 pipe（交互 TTY 风险高，单独评估） |
| B21 | `CommandLogWindow.tsx` 终端缓冲 512KB 上限环形淘汰 | 无 |
| B22 | `DependencyTreeViewer.tsx` key 改 `父链/序号/name` | 无 |
| B23 | `MultiManager.tsx` loadProjectInfo 移入 useEffect + active 标记 | 无 |

### 工程债基线调整（需评审知悉）

6 个历史超限文件因修复净增 1–20 行（watcher 竞态修复、终端缓冲、loading 拆分、unwatchAll），`scripts/engineering-debt-baseline.json` 已按实际值上调并附注原因；总债（6 超大文件 / 76 长函数 / 630 any）未增长，新文件/新函数均符合 1500/100 限制。

### 遗留与后续

1. **未提交改动混淆风险**：工作树中仍有此前遗留的 i18n/重构未提交改动（ExtendedEcosystems、dictionaries、health/actions、presentation.tsx、CHANGELOG 等），与本轮修复无关，提交时需分开。
2. B18 的 go.mod 块形式 `replace ( ... )` 未解析，属已知限制。
3. B20 的打包后 GUI 登录交互（无 TTY）仍是产品级限制，需后续决策（pipe 化登录流程）。
4. 真实 CLI 端到端、桌面 E2E、跨平台验证仍缺（与 09-17 复核结论一致）。
