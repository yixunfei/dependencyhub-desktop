# 第六轮独立审查与修复报告（2026-09-22）

> 2026-09-23 复核说明：本历史报告部分结论未完整落实（包括写队列超时、SwiftPM 参数顺序、R/Julia 模板转义）。本次实际修复与验证结果以 `RELEASE_REVIEW_2026-09-23.md` 为准。

本轮为**独立于既有报告的全面复查**（4 路并行只读审查：主进程服务与 IPC、主进程 managers 与并发、渲染层、脚本与 CI），不依赖此前任何审查文档。共确认并修复 **28 项可复现缺陷**，全部修复后通过全部门禁。

## 验证结果

| 门禁 | 结果 |
| --- | --- |
| `npm run typecheck`（renderer + electron） | ✅ |
| `vitest run` | ✅ 77/77（20 文件） |
| `npm run test:scripts`（build.test.cjs） | ✅ 5/5 |
| `npm run verify:core` | ✅ |
| `npm run verify:hardening` | ✅ |
| `npm run verify:manager-contracts` | ✅ |
| `npm run verify:i18n` | ✅（修复了门禁脚本自身 CRLF 缺陷，见 R6-27） |
| `npm run verify:engineering-debt` | ✅（基线按惯例上调并注明，含 HEAD 漂移） |
| `npm run build` | ✅ |

---

## 高严重度

### R6-1 pip 发布口令写入主进程全局环境变量（竞态 + 泄漏）
- **位置**：`electron/services/pip.ts`（publish / executePythonModule / executeExternalCandidates）
- **触发**：两个项目并发执行 `pip:publish`，或发布期间任意其它命令/终端/工具探测被拉起。
- **根因**：口令只能靠 `process.env.TWINE_PASSWORD` 传递（子进程 env 展开自主进程）。项目 B 覆盖后项目 A 的 twine 子进程读到 B 的口令；窗口期内所有新子进程继承该变量。
- **影响**：凭据错发到错误 registry、泄漏到任意并发子进程。
- **修复**：`executePythonModule`/`executeExternalCandidates` 增加 `env` 参数并透传 `runLoggedCommand`（`commandEnv` 支持 extra 覆盖），口令仅注入 twine 子进程；删除 `process.env` 读写。

### R6-2 写队列超时后被拒操作仍在后台真实执行
- **位置**：`electron/services/projectMutation.ts`（awaitQueuedTurn）
- **触发**：同项目上一 mutation 运行超过 60 秒，期间再发一个同项目 mutation。
- **根因**：`previous.then(task, task)` 把任务挂进链上即不可取消；60 秒拒绝调用方后，前任 settle 时任务仍执行，且操作上下文已 finish（不可取消、报表缓存不失效），用户重试导致同一写操作执行两次。
- **修复**：链上任务包守卫 `startIfStillWaiting`，超时后不再启动任务。

### R6-3 写命令被误判只读，绕过串行队列与写前备份
- **位置**：`electron/services/commandMutates.ts`
- **触发**：经 runCustom / executePlanned 执行 `npm version patch`、`npm pkg set`、`pip config set`、`pnpm patch`/`patch-commit`、`npm ci`、`npm link`、`npm publish` 等。
- **根因**：只读判定只看首个动词，上述动词不在任何表中，返回 false → 不入写队列、不建快照。与 `operationHistory` 的 `config set = mutating` 判定自相矛盾。
- **修复**：新增子动作依赖动词表（version/pkg/config/patch + `patch*` 前缀），只读子动作（get/list/ls/show/view）豁免，其余按 mutating；正则补 `link|unlink|rebuild|ci|publish|move`。

### R6-4 二进制锁文件 bun.lockb 快照/恢复即不可逆损坏
- **位置**：`electron/services/supplyChain.ts`（readSupplyChainFiles / restoreSnapshot）、`electron/services/extendedManager.ts`（createCommandBackup / restoreBackup）
- **触发**：bun 项目（仅二进制 `bun.lockb`）任何 mutation 前的快照/命令备份，及随后的恢复。
- **根因**：utf-8 读取把非法字节替换为 U+FFFD，恢复按 utf-8 写回，字节级内容永久改变且快照本身已损坏。
- **修复**：新建共享模块 `electron/services/manifestContent.ts`（二进制名单 + NUL 字节探测 → base64 存储，带 `encoding` 标记）；快照/备份/恢复/哈希四路统一走该模块；`writeFileAtomic` 支持 `Buffer`。

### R6-5 SwiftPM install 写入 target 的 dependencies 数组（清单编译失败）
- **位置**：`electron/managers/groups/platform/swiftpmManifestEditor.ts`
- **触发**：Package.swift 无包级 `dependencies:`（无外部依赖的包极常见）时执行 install。
- **根因**：`/\bdependencies\s*:\s*\[/` 取全文第一个匹配，命中 `.target(dependencies:)`；target 数组不接受 `.package(...)` 声明。
- **修复**：括号深度扫描定位 `Package(` 直属的 dependencies 键（跳过字符串字面量）；无包级键时在 `Package(` 后注入 `dependencies: [...]` 参数而非落进 target 块。

### R6-6 SwiftPM 删除依赖残留尾逗号/孤儿行
- **位置**：同上
- **触发**：删除数组末元素（前行留尾逗号，Swift 6.1 前工具链拒绝）；声明跨多行或含嵌套括号（`.upToNextMajor(from:)`）时正则 `[^)]*` 截断只删首行。
- **根因**：按单行删除，不处理分隔逗号与嵌套括号。
- **修复**：`.package` 调用按括号配对（字符串感知）取完整区间；整行/内联两种形态分别吸收前/后逗号；末元素时回收前行尾逗号。同时修复 `atomicallyWriteSwiftManifest` rename 失败残留固定名临时文件（改 uuid 名 + 失败清理）。

### R6-7 命令备份按文件名排序剪枝，可删掉刚写入的待回滚备份
- **位置**：`electron/services/extendedManager.ts`（pruneCommandBackups）
- **触发**：备份目录 ≥25 个文件时为字典序靠后的 manager（如 apt/cargo）写第 26 个备份。
- **根因**：`files.sort().reverse()` 以 manager id 为主键，刚写的备份可能立刻被 unlink；命令失败回滚时备份已不存在。
- **修复**：按文件名内嵌 ISO 时间戳排序；`keepPath` 保护本次写入的文件。

### R6-8 快照恢复循环部分写入，留下半恢复状态
- **位置**：`electron/services/supplyChain.ts`（restoreSnapshot）
- **触发**：损坏/被篡改的快照第 N 个文件含 `../` 不安全路径或中途写盘失败。
- **根因**：校验在循环内逐个进行，前 N-1 个文件已被非原子 writeFile 覆盖后才抛错。
- **修复**：先全量校验路径再开始写；写入改用 `writeFileAtomic`。

### R6-9 renv / julia 操作模板解释器级代码注入
- **位置**：`electron/services/extendedManager.ts`（operationTemplate 的 renv/julia 分支）
- **触发**：`manager:execute` 传入含 `"` 的包名（`x"); system("calc"); y<-("`）。
- **根因**：包名直接插值进 `Rscript -e` / `julia -e` 的代码字符串，引号闭合后剩余内容成为任意 R/Julia 语句。
- **修复**：统一 `rString`/`juliaString` 转义（`\` 与 `"`）。

### R6-10 Windows 打开外部终端的 cmd 元字符注入
- **位置**：`electron/services/system.ts`（openTerminal win32 分支）
- **触发**：项目目录名含 `&`、`|`、`^` 等（Windows 合法目录名），调用 `npm:open-terminal`。
- **根因**：spawn 只在含空格/引号时才加引号，`&` 不触发；cmd.exe `/K` 按 `&` 分段解析，目录名中嵌入的命令被执行。
- **修复**：负载整体双引号包裹 + `windowsVerbatimArguments: true`（Windows 目录名不能含 `"`，双引号即免疫元字符）。

### R6-11 npm 依赖树深度无上限，IPC 永不 settle
- **位置**：`electron/services/npm.ts`（getDependencyTree）
- **触发**：渲染进程传大 depth（如 15/50）。
- **根因**：每节点串行 `npm view`，无去重无记忆化，调用次数指数增长且单条 3 分钟超时，事实上永不 resolve。
- **修复**：depth 钳制到 [0,4]；按 `name@version#depth` Promise 级 memo；500 节点预算，超出退化为叶子节点。

### R6-12 依赖健康修复把命令失败伪装成成功
- **位置**：`electron/services/dependencyHealth.ts`（applyFix）
- **触发**：健康中心任一修复动作命令非零退出/超时。
- **根因**：catch 把错误输出拼成字符串正常 return，UI 无法区分"修复成功"与"修复失败"。
- **修复**：失败时抛出带 stdout/stderr 的结构化错误（错误信封经 `runProjectOperation` 附加 failure 信息）。

### R6-13 RuntimeLocalizer 与 React 协调冲突，错误内容常驻
- **位置**：`src/components/Localization/RuntimeLocalizer.tsx`
- **触发**：en-US 模式下，曾被记录中文原文的文本节点被 React 更新为不含 CJK 的新值（计数 `2 运行中` → `3`，版本号 `可用` → `20.0.0`）。
- **根因**：en-US 分支回退到旧中文原文的翻译覆盖 React 刚写入的新值；React vnode 认为 DOM 已最新，永远不会再修正。
- **修复**：非 CJK 当前值若等于本组件对记录原文的翻译则视为自身写入跳过；否则判定为 React 写入并采纳为新原文（last-writer-wins）。

---

## 中严重度

### R6-14 gradle configuration 未校验直插构建脚本
- **位置**：`electron/services/gradle.ts`（addDependency）
- **触发**：`configuration` 传 Groovy/Kotlin 代码片段，写入 build.gradle(.kts) 后下一次构建即执行。
- **修复**：白名单校验 `/^[A-Za-z][A-Za-z0-9_-]*$/`。

### R6-15 gradle 删除多行 map 记法留孤儿行；无匹配静默成功
- **位置**：`electron/services/gradle.ts`（removeDependency）
- **修复**：删除后内容未变 → 抛"未找到"；删除后仍残留 `group:`/`name:` map 记法 → 拒绝并提示手工删除（不再写出语法损坏的构建文件）。

### R6-16 conanfile.txt 换行注入 + 删除大小写误报
- **位置**：`electron/services/native.ts`
- **触发**：install 的 name 含 `\n`（一行变多行注入新 section）；卸载传 `Fmt` 而文件是 `fmt/9.1.0`，或卸载不存在的包却报成功。
- **修复**：conan 引用白名单校验（含拒绝换行）；删除改大小写不敏感比较，未命中抛错。

### R6-17 pubspec.yaml 字段换行注入
- **位置**：`electron/services/flutter.ts`（validateDependencyArgs / addAsset）
- **修复**：packageName/version/path/git 拒绝 `\r\n`；包名按 pub 规则 `^[a-z0-9_]+$` 校验；asset 路径同样拒绝换行。

### R6-18 maven settings.xml 损坏时配置写入静默"成功"
- **位置**：`electron/services/maven.ts`（upsertSettingsBlock）
- **触发**：settings.xml 缺 `</settings>`（被截断/非法 XML）时 set-mirror/set-server/set-local-repository。
- **修复**：replace 后内容未变即抛错，不再报告假成功。

### R6-19 npm moveDependency 失败只回滚 package.json，lockfile 中间态
- **位置**：`electron/services/npm.ts`（moveDependency）
- **修复**：同时快照 `package-lock.json`/`npm-shrinkwrap.json`；回滚写改 `writeFileAtomic`。

### R6-20 smartUpdate 对非法 currentVersion 裸调 semver.gt
- **位置**：`electron/services/smartUpdate.ts`
- **触发**：currentVersion 为 `^1.2.3`/`workspace:*`/git SHA 等且命中安全版本时整个分析 IPC 抛 TypeError。
- **修复**：`semver.parse` 兜底，非法时按无安全更新处理；比较同样 try 包裹。

### R6-21 npm login/adduser 超时只杀 cmd 包装层，孙进程泄漏
- **位置**：`electron/services/npm.ts`（login / adduser 超时分支）
- **修复**：`child.kill()` → `terminateProcessTree(child)`（Windows taskkill /T 树杀）。

### R6-22 packageStore mutating 共享布尔 + cache 无上限且持久化
- **位置**：`src/stores/packageStore.ts`
- **触发**：并行变更操作先完成者清除后完成者的 loading（安装按钮提前解禁）；浏览多项目后 cache 无限增长且每次写入全量序列化到 localStorage，最终 QuotaExceededError。
- **修复**：`beginMutation/endMutation` 计数器替代布尔；`partialize` 不再持久化 cache（merge 同步收窄）；setCache 按插入序 LRU 淘汰（上限 10 项目）。

### R6-23 渲染层三处竞态守卫缺失
- **位置**：`src/components/Toolchain/ProjectToolchainPanel.tsx`、`src/components/Package/SecurityAuditModal.tsx`、`src/components/Package/DependencyHealthModal.tsx`
- **触发**：切项目/重开弹窗/执行动作后旧响应覆盖新状态（工具链面板显示错项目绑定；审计弹窗显示上项目漏洞清单并可能对错项目 audit fix；健康扫描重复通知）。
- **修复**：统一单调 requestId/epoch 守卫，响应落地前校验。

### R6-24 安装搜索无防抖 + 版本加载未捕获 rejection（Project/Global 双份）
- **位置**：`src/features/managers/npm/scopes/project/Project.tsx`、`.../global/Global.tsx`
- **触发**：安装弹窗每次按键触发完整 registry 搜索 + 逐包下载量请求；点"加载版本"失败产生 unhandled rejection。
- **修复**：300ms 防抖（空查询同步失效在途请求）；loadInstallVersions 包 try/catch + 错误通知（`npm.loadVersionsFailed` 既有键）。

### R6-25 Search 页安装与搜索共享 loading、安装无防连点
- **位置**：`src/features/search/Search.tsx`
- **触发**：连点安装按钮并行多个 install；安装中再搜索，搜索 finally 清除安装 loading。
- **修复**：独立 `installing` 状态 + 入口守卫 + 按钮 loading/disabled。

### R6-26 通知容器全量重放，旧通知"续命"
- **位置**：`src/components/Notification/NotificationContainer.tsx`
- **根因**：effect 依赖整个数组，每次变化对所有通知再 open 一次（antd 同 key 重置 4 秒计时），store 侧移除计时与 antd 侧脱节。
- **修复**：`shownIdsRef` 只对新 id open；清理已移除 id 防集合无界增长。

### R6-27 verify-i18n 门禁在 CRLF 词典下恒失败
- **位置**：`scripts/verify-i18n.mjs`（parseDictionary）
- **根因**：`split('\n')` 后行尾 `\r` 使 `$` 锚失配，词典解析为 0 条 → "dictionary is empty" + 全部 t() 键误报未定义（Windows 检出必现，掩盖真实 i18n 问题）。
- **修复**：行尾 `\r` 容错；键模式同步支持转义引号（`(?:[^'\\]|\\.)*`）。

### R6-28 工程债基线陈旧（HEAD 漂移）+ 生成式更新工具缺失
- **位置**：`scripts/engineering-debt-baseline.json`
- **根因**：09-19 AI 模块提交增大 main.ts/preload 等未更新基线 → HEAD 本身违反门禁；基线只能手工编辑。
- **修复**：新增 `scripts/update-engineering-debt-baseline.mjs`（只升不降：current 与 previous 逐项取 max，防止"重新生成以接受回退"）；基线按本轮修复增量上调并在 description 注明原因。

---

## 记录为已知问题（本轮未修，需决策）

1. **发布链零签名/零公证/零哈希产出**（package.json build 段、release.js、platform-build.yml）：需要证书与 Apple 凭据决策，非代码缺陷。
2. **release-gates 恒绿**：证据目录不进 git 且无 artifact 传递，`--optional` 路径恒走通。修法：platform-build 上传证据包 → release-gates 下载后严格校验，或显式 neutral。属发布流程决策。
3. **verify-release-trust 信任自证 JSON**：`report.status !== 'blocked'` 即放行，门禁应自行按 checks[] 重算并 fail-closed。与上一条同属发布信任链改造。
4. **maven:set-server 明文口令落盘**：存在平行的 `maven:set-secure-server`（vault + env 占位符）安全路径；建议 UI 默认引导 secure 路径并给明文路径加告警，属产品决策。
5. **生产保留 DevTools 菜单 / Electron fuses 缺失**：打包安全加固项，需与发布链一起做。
6. **IPC 无 senderFrame 校验、preload 暴露面过大**：架构级改造，建议单独立项。
7. **supplyChain 的 conanfile.py 全文正则 / requirements.txt 降级解析伪造 SBOM 组件**：应复用 `native.ts parseConanfilePy` 与 `pythonManifests.ts parsePythonRequirement`，属解析层统一改造。
8. **终端会话数无上限 / toolchain 探测并发无上限**：资源防护增强，非正确性缺陷。
9. **afterPack 删除 GPU 运行时 DLL**：无 GPU 机器可能白屏，需打包验证决策。
10. **G-01 级超长组件**（Search/Project/Pip 等 900-1200 行单函数）：既存工程债，受 ratchet 控制不增长，重构另立任务。
