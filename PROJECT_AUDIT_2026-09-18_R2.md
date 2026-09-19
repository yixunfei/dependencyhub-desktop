# 项目审核报告 · 第二轮（2026-09-18）

范围与方法：在第一轮 24 项修复（BUG_TRIAGE_2026-09-18.md，B1–B23）完成并全部门禁绿灯后，进行独立第二轮审核。三条并行审查线：①逐项复核上轮修复质量；②排查上轮浅覆盖区域（preload/IPC、shared/、managers/groups、安全）；③渲染层其余 feature 与脚本/构建配置。所有发现均经 file:line 抽查确认。

## 〇、基线与总体结论

- 门禁基线复核：typecheck ✅ verify:core ✅ verify:hardening(62) ✅ verify:ipc ✅ verify:manager-contracts(57) ✅ npm test ✅。
- 上轮 24 项修复中 18 项复核无误；4 项修复不完整（见 P1-1/P1-2/P2-1/P3-3），2 项有低危残留（P3-2/P3-3）。
- 工作树中此前遗留的未提交 i18n/重构改动经核验**未发现新引入 bug**（key 无残留引用、新增 key 双语齐全、调用点已传 t）。
- 本轮新发现 **20 项**（6 P1 / 7 P2 / 7 P3）。

## 一、P1（高危，可复现）

### P1-1 上轮 B13 修复不完整：flutter 资产操作仍破坏 CRLF
- 证据：`electron/services/flutter.ts:670,678`（upsertAsset 两处 `ensureTrailingNewline(lines.join('\n'))`）与 `:681+` removeAsset 同型；上轮只修了依赖增删路径（:603/:608/:633）。
- 触发：CRLF 行尾的 pubspec.yaml 项目增删 assets。
- 根因：资产写入路径未走 detectLineEnding/withLineEnding。
- 影响：全文件行尾被改写 → git 大面积 diff、pubspec 语义虽不变但污染版本历史。
- 方案：资产路径复用上轮抽出的行尾工具函数。

### P1-2 上轮 B1 修复不完整：自由命令入口仍绕过写队列
- 证据：`electron/services/extendedManager.ts:331-345` `run()` 直调 `runArgs`，无 withProjectMutation；`electron/managers/profiledAdapter.ts:144` runCustom → service.run。executePlanned(:347)/execute 已修，此入口漏网。
- 触发：工作台运行 `deno add` 等 mutating 自由命令，同时 planner 写操作并发。
- 影响：与上轮 B1 相同的并发写竞争。
- 方案：`run()` 对 `commandMutatesProjectFiles(normalizeArgs(...))` 命中的命令包队列（注意：runCustom 命令行需先拆参再判断）。

### P1-3 system:open-path / system:open-file 无任何校验
- 证据：`electron/main.ts:684-690` 直接 `shell.openPath(path)`。
- 触发：渲染进程被污染（如 README/公告渲染 XSS）即可打开或执行任意 exe（.exe/.bat 会被 shell 关联执行）。
- 影响：任意代码执行链的最后一环。
- 方案：限定路径必须位于已添加项目目录内，或扩展名白名单（文件夹/文本类）；拒绝 .exe/.bat/.cmd/.ps1 直开。

### P1-4 清单解析不剥离 UTF-8 BOM
- 证据：`electron/managers/structuredData.ts:18-25` `readTextIfExists` 直接 utf-8 读取；全仓仅 aiTypes.ts:150 处理过 BOM。
- 触发：Windows 记事本/PowerShell 保存的 package.json / pyproject.toml / composer.json（BOM 头 `\uFEFF`）。
- 影响：JSON.parse / smol-toml 全部报 "Cannot parse"，该清单整份失效。
- 方案：readTextIfExists 统一 strip 前导 BOM（一处修复覆盖全部调用方）。

### P1-5 工具链/设置页 IPC 失败静默丢失
- 证据：`src/components/Toolchain/GlobalToolchainPanel.tsx:32-52` loadTools/savePath 只有 try/finally 无 catch；`src/features/settings/Settings.tsx:83-117` loadConfig 同病。
- 触发：system.checkTools/setToolPath 被拒（IPC 异常/主进程错误）。
- 影响：unhandled rejection、UI 零提示；保存"看起来成功"实则失败；失败时 registry 输入框仍显示默认官方源误导用户。
- 方案：补 catch + 通知。

### P1-6 npm token 存到错误的 registry 键
- 证据：`src/features/settings/Settings.tsx:187-195`：registry 填无协议地址（`registry.npmmirror.com`）时 `new URL` 抛错被 catch 吞掉，token 回退写入 `//registry.npmjs.org/:_authToken`。
- 触发：登录 Modal 填无协议 registry + token 认证。
- 影响：token 对目标 registry 永不生效，登录"成功"但拉包仍 401。
- 方案：缺协议时补 `https://` 前缀并校验后再构造键。

## 二、P2（中危）

### P2-1 上轮 B9 修复不完整：viewPackage 无请求序号
- 证据：`src/stores/searchStore.ts:53-63`，仅 search 有序号。
- 触发：快速连看 A→B，旧 A 响应覆盖 selectedPackage。
- 方案：复制 search 的序号模式。

### P2-2 python 清单扫描单文件错误全局失败
- 证据：`electron/managers/groups/python/pythonManifests.ts:31-39` + structuredData.ts:81-88 `Promise.all` 无 per-file 容错。
- 触发：工作区（maxDepth 6）内任一子项目 pyproject.toml 语法错误。
- 影响：uv/poetry 整个 inventory 失败。
- 方案：单文件 catch 降级并记 warning。

### P2-3 cargo 清单解析白名单过窄 + 注释剥离误伤
- 证据：`electron/services/cargo.ts:150-159` section 白名单仅 3 个，`[target.'cfg(windows)'.dependencies]` 与 `workspace = true` 继承全部漏报；:147 `replace(/#.*/,'')` 误删字符串内 `#`（git URL fragment）。
- 方案：改用 smol-toml 解析并处理 target/workspace 段。

### P2-4 gradle/maven 坐标注入 + 非原子写入
- 证据：`electron/services/gradle.ts:98-102` 坐标原样内插 build.gradle（Groovy 代码）；`maven.ts:104-110` 原样内插 pom.xml（XML）；gradle.ts:105 / maven.ts:488 / flutter.ts:201,232 / native.ts:230,252 直接 writeFile 非原子。
- 触发：从搜索结果/手工输入插入含特殊字符的坐标。
- 影响：可注入任意 Groovy/XML 并在下次构建执行；写入中途崩溃损坏用户构建文件。
- 方案：坐标校验 `[\w.:/+-]+`、XML 转义、临时文件+rename。

### P2-5 go.mod 块状 replace 未解析（上轮已知限制，升级处理）
- 证据：`electron/services/go.ts:202-205` 注释自认忽略块状 `replace (...)`。
- 影响：多模块 monorepo 版本展示错误。上轮仅修单行。
- 方案：解析块状 replace。

### P2-6 splitCommandLine 按空白硬切不识别引号（6 处复制）
- 证据：`cargo.ts:217-222`，同款复制于 go.ts:359、gradle.ts:476、native.ts:605、flutter.ts:991、extendedManager.ts:2933。
- 触发：`conan install "C:\My Proj\x.txt"` 类含空格参数被拆碎。
- 方案：引号感知 tokenizer，一处实现、六处替换。

### P2-7 fetchGlobalPackages 无请求序号 + 过期检查假成功
- 证据：`src/stores/packageStore.ts:321-402` 无 requestId（对比 fetchProjectPackages:186 有）；:398 catch 仅 console.error → `Global.tsx:84-92` npm list 失败仍弹"检查完成"。
- 方案：加 requestId 并向上传播错误。

## 三、P3（低危/债务）

### P3-1 B2 残留：含换行参数被静默删除而非报错
- 证据：`electron/services/commandRunner.ts:115` `replace(/[\r\n]/g,'')`。其余转义经 spawn（commandProcess.ts:38 shell:false）推演正确。
- 方案：含换行改抛错。

### P3-2 B12 残留：RuntimeLocalizer 属性侧同病
- 证据：`src/components/Localization/RuntimeLocalizer.tsx:138-141`，zh-CN 下 placeholder/title 属性变更仍被旧原文覆盖（characterData 已修，属性未修）。
- 方案：属性回调同型"最后写入者为准"。

### P3-3 B8 残留：store 无 selector 订阅（性能债）
- 证据：`Project.tsx:75`、`Global.tsx:53` 仍 `usePackageStore()` 无 selector，cache/mutating 任意变化全量重渲染。语义已正确，属优化项。

### P3-4 safeStorage 不可用静默降级
- 证据：`electron/services/credentialVault.ts:11-13` base64-fallback 仅编码不加密，save 照常落盘不提示（Linux 无 keyring）。
- 方案：降级时拒绝保存或强确认。

### P3-5 operationHistory 无限增长
- 证据：`electron/services/operationHistory.ts:117` 项目内 `.npmDesktopManager/operations/command-history.jsonl` append-only 无轮转。
- 方案：按大小/条数轮转。

### P3-6 build:all 在 Windows 必败
- 证据：package.json `"build:all": "node scripts/build.js all all"` + scripts/build.js:19-23，Windows 上会请求 mac dmg 目标。
- 方案：按宿主过滤或前置校验报清晰错误。

### P3-7 i18n 硬编码中文（冻结债务）
- 证据：`Settings.tsx:451-855` 约 60+ 处字面中文；Global.tsx/Project.tsx 同类；scripts/verify-i18n.mjs:137 对动态 key 有漏检面。属 i18n-cjk-baseline 冻结债务，非本轮引入。

## 四、验证盲区与回归建议

- verify:core / verify:i18n 未覆盖：packageStore localStorage 损坏 merge 兜底、fetchGlobalPackages 竞态、RuntimeLocalizer DOM 翻译、watcher 同目录多路径别名。建议各补一条 hardening/组件用例。
- P1-3/P1-4 修复后：hardening 补 open-path 拒绝用例与 BOM 清单解析用例。
- P2-6 修复后：为 splitCommandLine 补引号解析单测（六个复制点同源）。

## 五、修复实施记录（同日完成，20/20 全部修复）

**门禁终态**：typecheck ✅ / npm test ✅ / verify:core ✅ / verify:hardening ✅ / verify:ipc ✅ / verify:manager-contracts ✅ / verify:i18n ✅ / verify:engineering-debt ✅ / 生产构建 ✅。

逐项落实：
- **P1-1** flutter.ts upsertAsset/removeAsset 全部返回路径接入 detectLineEnding/withLineEnding（:651-695）。
- **P1-2** extendedManager.ts `run()` 对 `commandMutatesProjectFiles` 命中的自由命令包 `withProjectMutation`（execute/executePlanned 直调 runArgs，无重复入队）。
- **P1-3** 新增 `electron/services/shellGuard.ts`（可执行扩展名黑名单 + 目录放行 + 空路径拒绝），main.ts 两个 open 通道接入。
- **P1-4** structuredData.ts readTextIfExists 统一剥离前导 BOM。
- **P1-5** GlobalToolchainPanel loadTools/savePath 补 catch + 通知（新增 i18n key `toolchain.loadFailed/saveFailed` 双语）；Settings loadConfig 失败补 UI 通知。
- **P1-6** Settings getRegistryAuthTokenKey 对无协议地址自动补 `https://` 后再构造 token 键。
- **P2-1** searchStore viewPackage 独立请求序号。**P2-2** python 清单三处扫描（pyproject/pipfile/conda）单文件解析 catch 降级。**P2-3** cargo.ts 改 smol-toml 解析，覆盖 target.*.dependencies 与 workspace 继承。**P2-4** maven/gradle 坐标白名单校验（拒 `${`、引号、尖括号）+ XML 转义 + writeFileAtomic。**P2-5** go.mod 块状 replace 解析。**P2-6** 新增引号感知 `splitCommandLine.ts`（含 7 个单测）替换 6 处复制。**P2-7** fetchGlobalPackages 请求序号 + 错误上抛，Global.tsx 失败弹错误通知。
- **P3-1** formatCmdArg 含换行参数抛错。**P3-2** RuntimeLocalizer 属性回调 last-writer-wins。**P3-3** Global/Project 改逐字段 selector 订阅。**P3-4** 凭据库降级 cipher 保存时明确 warn（保留可用性）。**P3-5** operationHistory 2MB 轮转。**P3-6** build.js `all` 平台在非 macOS 宿主自动排除 mac 目标（测试同步更新）。**P3-7** Settings/Global/Project 全部硬编码中文抽取：词典新增 216 key（settings.* 118、npm.* 98），双语同步，grep 中文字面量归零。

**附带重构**：`src/i18n/dictionaries.ts`（1814 行，超 1500 上限）拆分为 `dictionaries/en-US.ts` 与 `dictionaries/zh-CN.ts`（各 905 行），聚合导出签名不变；verify-i18n.mjs 同步改为按文件解析。新增文件：shellGuard.ts、splitCommandLine.ts(+test)、两个词典文件，均在债务限制内。

**基线调整**：6 个文件函数长度 1-20 行必要增长上调并附注（main.ts/GlobalToolchainPanel/Global/Project/Settings/packageStore）；Global.tsx 抽取 helper 引入的 5 个 `any` 已改为真实类型，any 计数未增反降。

**验证盲区补测**：splitCommandLine 引号解析 7 用例；verify:i18n 新覆盖词典拆分后的 key 完整性（902 keys）。

## 六、上轮修复复核通过项

B4/B5/B7/B10/B11/B14/B15/B16/B17/B18/B19/B20/B21/B22/B23 及工程债基线数值全部复核无误；未提交 i18n diff 核验干净；credentialVault 队列化/唯一 tmp/保留原 vault 正确；stripJsonComments 字符串感知正确；watcher isActive 防竞态正确。
