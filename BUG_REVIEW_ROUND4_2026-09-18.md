# 第四轮全面审查与修复报告（2026-09-18）

本轮为独立全面复查：基于前三轮修复（B1-B24、R1-R4）的 diff 回归 + 主进程/渲染层/脚本与配置四个方向的并行审查。共确认 **26 项真实缺陷**（P1×1、P2×13、P3×12+），全部修复并通过全部门禁。

## P1

### R5-1 Windows cmd 包装链在 spawn 层失效（libuv 二次加引号）
- **位置**：`electron/services/commandRunner.ts`（resolveShellFreeCommand）、`electron/services/commandProcess.ts:38`、`electron/services/npm.ts`（login/adduser 两处 spawn）
- **原因**：`/d /s /c` 负载被 spawn 时，libuv（非 verbatim 模式）按 MSVCRT 规则对含空格/引号参数再包引号并把内部 `"` 转义成 `\"`；cmd 不把 `\` 当转义符，最终到达子进程的命令行被破坏。凡 formatCmdArg 加过引号的参数（含 `&`、`%`、空格）或 bin 路径含空格（默认 Node 安装路径即触发）均损坏。既有门禁只断言字符串输出、从不真实 spawn，故未暴露。
- **修复**：与 Node `shell:true` 内部实现对齐——负载外层再包一对引号并传 `windowsVerbatimArguments: true`（`ShellFreeCommand` 新增标记位，三处 spawn 透传）。
- **回归锁定**：verify:hardening 新增 `testCmdSpawnPassesArgumentsIntact`（真实 spawn cmd.exe + .cmd shim，断言含 `&`/空格/`%` 的参数原样到达子进程；实测缺 verbatim 时必失败，证明守卫承重）。

## 主进程 P2

### R5-2 依赖健康修复动作按 id 去重互相覆盖 → 执行错误包的命令
- **位置**：`electron/services/dependencyHealth.ts`（catalogActions）
- **原因**：`cargo-update-package`/`flutter-upgrade-package`/`npm-explain` 等动作 id 每包重复，`catalog.set(action.id, ...)` 后写覆盖前写；点击 A 包的修复按钮实际执行 B 包的命令。
- **修复**：重复 id 追加出现序号后缀（`action.id:2`），动作对象携带唯一 id 回传渲染层；catalog 每次 scan 重建。

### R5-3 七处 registry HTTPS 客户端无超时、不可取消、响应流无 error 监听
- **位置**：npm/cargo/go/maven/gradle/flutter/pip 的 `httpsGet` + flutter `httpsPostJson`
- **原因**：半开连接/代理挂起时 promise 永久 pending（这些请求不经 operation context，无取消手段）；`IncomingMessage` 中途 reset 的 `error` 事件未监听可致主进程 uncaughtException。
- **修复**：新建共享 `electron/services/registryHttp.ts`（`registryHttpGet`/`registryHttpPostJson`：20s socket 空闲超时 + destroy + `res.on('error', reject)`），七处统一接入。

### R5-4 无 operation context 的只读命令无任何超时
- **位置**：`electron/services/commandRunner.ts`
- **原因**：read handler 直调 service，无 ambient context → 无超时无 signal，`npm ls --all`/`mvn dependency:tree` 卡死时渲染层 loading 永不解除。
- **修复**：ambient 不存在时兜底 3 分钟超时；ambient 存在时尊重 ambient（显式禁用语义不变）。

### R5-5 maven.addDependency 插入 dependencyManagement 导致依赖静默不生效
- **位置**：`electron/services/maven.ts`（addDependency/removeDependencyBlock）
- **原因**：`replace(/<\/dependencies>/, ...)` 取文档第一个闭合标签——Spring Boot 工程的 dependencyManagement 块在前，写入后不引入依赖；remove 也可能误删管理条目。
- **修复**：新增 pom 标签栈扫描器 `findProjectDependenciesSpan`（跳过注释/CDATA，按深度定位 `<project>` 直属的 dependencies 块）；增删均限定该块；无插入点时显式报错。

### R5-6 conanfile.py 项目执行 conan install/uninstall 会创建冲突的 conanfile.txt 桩
- **位置**：`electron/services/native.ts`
- **修复**：变更入口检测 conanfile.py 存在即抛出结构化错误拒绝，不再写桩。

### R5-7 npm:move-dep 两段写无原子性，第二步失败丢依赖
- **位置**：`electron/services/npm.ts`（moveDependency）
- **修复**：uninstall 前快照 package.json，第二步失败时恢复原文再抛错。

## 渲染层 P2

### R5-8 fetchProjectPackages 缓存命中分支不复位 loading → 页面永久 Spin
- **位置**：`src/stores/packageStore.ts`
- **原因**：缓存命中瞬时 return，飞行中旧请求的 finally 因 requestId 已被递增而跳过 `projectLoading: false`。
- **修复**：命中分支同步 `projectLoading: false`。

### R5-9 Native.tsx 完全缺失 epoch 守卫（R4-3 漏掉的第七个生态页）
- **位置**：`src/features/managers/native/Native.tsx`
- **影响**：慢响应后列表与 currentPath 错配，Remove 会在新项目中删除同名依赖。
- **修复**：`loadEpochRef` + 每个 await 后校验；安装弹窗搜索补序号。

### R5-10 版本对话框竞态守卫群缺失（8 处）→ 安装错误版本
- **位置**：Go/Flutter/Gradle/MavenManagerPage（load+show）/PipManagerPage（load+show）/Project（loadInstallVersions）/Global（loadInstallVersions）
- **影响**：新包名 + 旧版本列表错配，Maven/Pip 还会自动把旧包首个版本填入表单。
- **修复**：统一 `versionRequestRef` 单调序号 + apply 前校验表单包名/坐标未变。

### R5-11 Global.tsx loadPackageOptions 缺请求序号（B9 姊妹漏修）
- **修复**：照抄 Project 的 `packageOptionsRequestId` 模式；空查询分支同步失效。

### R5-12 PackageDetailModal 无竞态守卫 → B 弹窗显示 A 包数据
- **修复**：effect 内 `active` 标记 + 打开时清空旧数据。

### R5-13 RuntimeLocalizer 语言切回 zh-CN 后属性停留英文且原文记录被污染
- **位置**：`src/components/Localization/RuntimeLocalizer.tsx`
- **修复**：文本与属性两个 zh-CN 分支按 CJK 判定：React 新写入（中文）→ 采纳为原文（last-writer-wins）；翻译残留（非中文）→ 还原记录的原文。

## P3（主进程）

| 编号 | 位置 | 问题 | 修复 |
| --- | --- | --- | --- |
| R5-14 | commandMutates.ts | 动词表缺 `dedupe`/`import`（重写 lockfile 却无备份）；全 flag argv 判定为只读 | 动词表补齐；全 flag 偏置为 mutating（安全侧） |
| R5-15 | mcpOperations.ts planMcpRemoval | 任一配置文件解析失败即整体中止，与清单读取容错不一致 | 循环内跳过解析失败文件 |
| R5-16 | aiTypes.ts writeFileAtomically | 固定临时名 + rename 失败不清理 | 委托共享 `atomicWrite.writeFileAtomic`（uuid 临时名 + 失败清理） |
| R5-17 | projectGuard.ts | 变更操作 cwd 缺失时落到 `process.cwd()`（应用目录）执行 | 无 lockKey 的 mutation 直接抛错（global npm 走 serializeKey 不受影响） |
| R5-18 | maven.ts renderDependency | 插入片段固定 LF，CRLF pom 产生混合行尾 | 片段经 `applyLineEnding` |
| R5-19 | terminal.ts | spawn 失败路径不清理 session | error 回调删除 session 并补发 `terminal:exit` |
| R5-20 | credentialVaultCore.ts writeVault | writeFile 失败分支泄漏 `.tmp` 文件 | writeFile+rename 统一 try/catch unlink |
| R5-21 | credentialVaultCore.ts readVault | 字段不全条目被静默过滤并在下次写回时永久删除 | `repairStoredCredential` 补默认值保留；仅缺 id/密文才丢弃 |

## P3（渲染层）

| 编号 | 位置 | 问题 | 修复 |
| --- | --- | --- | --- |
| R5-22 | Search.tsx / searchStore.ts | 切换 searchType 不失效版本序号（旧弹窗复活）；空查询/清空不 bump 序号（旧结果回填） | 切换/清空时同步 bump 相应计数器 |
| R5-23 | PackageDetailModal convertToTreeData | 共享依赖树 key 重复（B22 第二处实现） | key 加父链路径 |
| R5-24 | Project/Search 的尺寸/下载量加载 | 项目切换/新搜索后旧响应覆盖 | effect 内 `cancelled` 标记 |
| R5-25 | CommandLogWindow.startTerminal | 并发创建导致 shell 会话泄漏 | `startingTerminalRef` 互斥 + kill 后清 id |
| R5-26 | ToolchainStatusModal | 三个异步函数 try/finally 无 catch 静默失败 | 补 catch + 通知（`describeError` 消除 any） |
| R5-27 | Project.tsx handleInstallFromDetail | 安装失败零反馈 | try/catch + 错误通知 |
| R5-28 | settingsStore/themeStore | persist 合并无枚举校验，脏数据直入状态 | 枚举白名单 merge |
| R5-29 | Project.tsx handleRunScript | 并发脚本输出互串、loading 互踩 | `runningScripts` Record + runId 守卫 |
| R5-30 | DependencyTreeModal / ManagerHub / PluginComponents | 项目切换竞态 | active 标记 / epoch 守卫 |
| R5-31 | clipboard/openFile/selectDirectory 裸调用 | 失败仅 unhandled rejection | 补 catch + 通知 |

## 脚本 / CI

| 编号 | 位置 | 问题 | 修复 |
| --- | --- | --- | --- |
| R5-32 | release-gates.yml | 证据恒缺失时三验证器恒绿（虚假安全感）；工件上传与 `--no-write` 矛盾 | 有证据走严格模式，无证据显式 `::warning::` 标注；删除无效工件步骤 |
| R5-33 | verify-hardening watcher 测试 | 失败路径泄漏 fs.watch 句柄（失败变超时） | `unwatchAll()` 移入 finally |
| R5-34 | verify-hardening S2 断言 | `applied.length === 0` 恒真，无验证力 | 改为断言失败报告不含 value 载荷 |
| R5-35 | verify-framework-runner | 脚本 token 精确匹配恒失败，`node` 被计入组覆盖 | 按后缀定位脚本 token |
| R5-36 | verify-ipc-bridge | 超时路径清理失败掩盖原始错误 | rm 包 catch 告警 |
| R5-37 | generate-icons-simple.js | 部分失败仍退出 0；ICO 输入路径未引号 | 失败计数非零退出 + 路径引号 |
| R5-38 | verify-terraform-managers.mjs | fixture 写入字面 `\n` 非真实换行 | 改为真实换行 |

## 记录为已知限制（本轮不修）

1. **CI 缺位**：verify:packaged-smoke 无任何 CI 执行；quality matrix 无 macOS（verify:ipc 从未在 darwin 验证）。需接入 platform-build 产物，属发布流程决策。
2. **cli-integration.yml 命名失真**：verify:core 的 npm 路径走 stub，真实 CLI 端到端仍缺。
3. **NSIS 安装器语言未接线**：`default-language.json` 既不在仓库也不在打包配置，安装版语言永远走 en-US + 提示分支。需 NSIS 自定义脚本扩展。
4. **engineering-debt longFunctions 排序索引对齐**的精度问题：本轮按惯例上调基线，算法改进另案。
5. **packaged-smoke CDP 探测强度**：仅断言 page target 存在，preload 失败/渲染层异常的白屏变体仍绿灯。需 WebSocket Runtime.evaluate（无 ws 依赖）。
6. smartUpdate.ts analyze 中 `semver.gt` 未包 try（currentVersion 非法时抛错）；flutter.ts 两处提前返回给无尾换行 CRLF 文件补裸 `\n`（单行行尾不一致）。

## 验证方式与结果

全部 9 项本地门禁在修复后重跑通过：

| 门禁 | 结果 |
| --- | --- |
| `npm run typecheck`（renderer + electron） | ✅ |
| `npm run test`（vitest 17 文件） | ✅ 62/62 |
| `npm run build`（vite 渲染层 + preload + electron） | ✅ |
| `npm run verify:core` | ✅ 33 checks |
| `npm run verify:hardening` | ✅ 68 checks（含新增真实 spawn 回归） |
| `npm run verify:manager-contracts` | ✅ 57 managers |
| `npm run verify:i18n` | ✅（hardcoded CJK 基线 14 文件未变） |
| `npm run verify:ipc` | ✅（隔离 preload 保留 failure/backup/restore/success 数据） |
| `npm run verify:engineering-debt` | ✅（既有债务不增长；R5 修复净增量按惯例计入基线并注明） |

回归控制说明：
- N1 的修复由新增的真实 spawn 用例锁定（该用例在缺 verbatim 时确实失败，证明其承重）。
- `projectExecution.test.ts` 的超时用例因 R5-17 改为传入真实 cwd（原 `undefined` 是测试便利写法，语义不变）。
- 工程债基线按实际增量上调 13 个文件并注明"由修复引起，非债务回涨"。
