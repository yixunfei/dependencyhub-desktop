# 后续优化补充计划（F1–F5 修复之后）

编写日期：2026-09-16。基线：`PROJECT_REVIEW.md`（2026-09-15）记录的 F1–F5，以及随后完成的"管理器工作台行为加固"提交 `10ecb05`。

本文只覆盖**上次修复之外仍然存在**的事项，并且只写已经核实的代码证据。文中所有行号对应 `10ecb05` 时的代码。沿用 `PROJECT_REVIEW.md` 的 P1/P2/P3 分级：P1 = 会导致用户丢改动或误判结果，P2 = 明显影响体验或迭代速度，P3 = 整洁度。

---

## 0. 本次已闭环的部分（不再计入遗留项）

| 原编号 | 结论 |
| --- | --- |
| F1 预览与执行不一致 | 已闭环。适配器改用同一套 `operationPlanner` 驱动 plan/execute；`unsupported()` 改为返回不可执行结果而非 fallback |
| F2 切换项目数据串扰 | 已闭环。`packageStore` 引入请求序号 + 路径校验 + 错误态清理；工作台与扩展生态页改用 `ManagerWorkspaceCoordinator` |
| F3 npm 依赖类型错误 | 已闭环。分类改由 `package.json` 清单驱动；补齐 `optionalDependencies`/`peerDependencies`/缺失与异常状态；渲染层同步修正 |
| F4 备份与恢复不完整 | 已闭环。备份记录文件存在性、失败返回 `restore` 结构化结果、`expectedState` 冲突检测、`withProjectMutation` 串行化 |
| F5 注册表/适配器/页面不一致 | 部分闭环。kustomize/skaffold/argocd/flux 已提升 preview；`diagnostics()` 改为"声明 vs 适配器"一致性比对；**能力矩阵的统一表达仍未完成**，见 S5 |

附带修复（同批次）：工作台 coordinator token 互踢导致检测数据被丢弃、`diagnostics()` 误报 8 个内置管理器、`commandRunner` 预中止 signal 的 TDZ 崩溃、扩展生态页异步竞态、备份候选混入 glob 模式、仓库根 `NUL` 游离文件。

**仍需注意的能力边界**：恢复操作只回滚本操作声明的清单/锁文件/配置文件，不构成环境包或远程集群状态的回滚。这一限制目前只体现在实现里，没有在界面文案中说明。

---

## S1 / P1：写操作的串行化与失败反馈没有形成统一契约

这是当前最影响"敢不敢用"的问题，分三层。

### S1.1 写操作保护入口不统一

现状存在两套互不相干的机制：

- `withProjectMutation`（[electron/services/extendedManager.ts:116](electron/services/extendedManager.ts)）—— 真正的按项目串行队列，但**只有** `executeWithMutation`（同文件 `:439`）在用，即只有 SwiftPM 的 install/remove 走这条路。
- `withProjectSnapshot`（[electron/main.ts:383](electron/main.ts)）—— 49 个写操作 IPC 处理器在用（npm install/uninstall/update、pip、maven、cargo、gradle、go、publish、`write package.json` 等）。它只做一件事：

  ```ts
  async function withProjectSnapshot<T>(cwd, label, operation) {
    await snapshotBeforeMutation(cwd, label)
    return await operation()
  }
  ```

  即"先打快照再执行"，**没有任何互斥**。

后果：同一项目上并发触发两个写操作（例如连点两次"更新"、批量更新与单个安装同时进行），两个 `npm install` 会同时改写 `package.json` / `package-lock.json`，后写覆盖先写，且两个快照的恢复语义互相冲突。这一场景当前没有任何测试覆盖（`verify-core-behaviors.mjs` 只验证了恢复时的并发冲突检测，验证的是"文件被外部改过"，不是"两个操作并发"）。

### S1.2 超时与取消没有通到界面

`runLoggedCommand` 已支持 `timeoutMs` / `signal` / `operationId`（[electron/services/commandRunner.ts](electron/services/commandRunner.ts)），但：

- 全仓搜索显示，除 `registryReachability` / `search/http` 的内部 fetch 外，**没有任何 IPC 处理器传入 `signal`**，即不存在用户可触发的取消；
- npm/pip/maven/gradle 等安装类命令普遍只设了 `maxBuffer`（如 [electron/services/npm.ts:138](electron/services/npm.ts) 的 10MB），**没有设 `timeoutMs`**；
- 界面没有取消按钮，一次卡住的安装只能杀掉整个应用。

`PROJECT_REVIEW.md` 4.3 提出的"关联 operation ID、超时与进程树终止策略"仍处于未实施状态。

### S1.3 失败结果不结构化

命令失败时，除 `backup` / `restore` 外没有统一字段，界面只能展示 `error.message` 文本。取消、超时、退出码非零、输出超限这四类失败无法区分，也就无法给出"重试 / 回滚 / 查看日志"这类可执行建议。

### 建议实施顺序

1. 把 `withProjectSnapshot` 内部改为基于 `withProjectMutation` 的同一队列，使 49 个写入口与 `executeWithMutation` 共享互斥（改动集中在一处，风险低、收益最大）。
2. 定义统一的 `OperationContext`（`operationId` + `timeoutMs` + `AbortSignal` + 失败类别），由 preload 暴露 `managers.cancel(operationId)`，界面加取消与超时提示。
3. 失败结果增加 `category`（`cancelled` / `timeout` / `exit-code` / `output-limit` / `unknown`），界面据此决定是否提示回滚。

### 验收条件

- 同一项目并发两个写操作时，第二个等待第一个结束，`package.json` 不出现交叉写入；
- 用户可取消，取消后进程被终止且界面明确显示"已取消"；
- 超时触发时给出可重试提示，且不残留半成品文件；
- `verify-core-behaviors.mjs` 增加并发写与取消两条用例。

---

## S2 / P1：失败与"无数据"无法区分

[src/features/health/HealthCenter.tsx](src/features/health/HealthCenter.tsx) 进入页面即并发发起 **39 个** IPC 调用，其中 **65 处**使用 `catch(() => null)` 把错误吞成 `null`。

结果是后端报错、网络不通、报告尚未生成三种情况在界面上完全一致，都呈现为"无数据"，且没有重试入口。对一个治理/健康面板来说，把失败伪装成正常空态是最危险的一类误导——用户会据此认为"这项检查通过了"。

**建议**：按工作流分组，改为按需加载；每块独立维护 `loading / error / data` 三态；错误就地展示并提供重试；同一批项目盘点结果在多个区块间复用，避免 39 次重复扇出。

**验收**：任意一个报告接口抛错时，对应区块显示错误与重试按钮，且不影响其他区块。

---

## S3 / P2：数据新鲜度依赖单个文件监听

[electron/services/watcher.ts](electron/services/watcher.ts) 只监听 `package.json` 一个文件，且仅处理 `change` 事件：

- 编辑器原子替换（写临时文件再 rename）不会触发 `change`，会漏事件；
- `package-lock.json`、`requirements.txt`、`Cargo.toml`、`go.mod` 等清单变化完全不触发刷新。

用户手动修改依赖清单后界面不更新，容易误判为工具失效。

**建议**：监听改为目录级（或同时监听清单与锁文件），补齐 `rename`/`add`/`unlink` 事件，并加去抖；工作区内多清单变化时统一触发一次重新盘点。

**验收**：三种场景下界面自动刷新——外部编辑器改写 `package.json`、`package.json` 被原子替换、`package-lock.json` 单独变化。

---

## S4 / P2：Electron 边界与凭据存储策略需要决策

- **`open-external` 无白名单**：[electron/main.ts:619](electron/main.ts) 直接 `shell.openExternal(url)`，未校验协议与来源。建议限制为 `https:` / `http:`，并配套 `will-navigate` 与 `setWindowOpenHandler` 约束。需要负向测试（`file:`、`javascript:` 等应被拒绝）。
- **安全存储降级**：[electron/services/credentialVaultCore.ts:206](electron/services/credentialVaultCore.ts) 在系统安全存储不可用时退化为 Base64 编码。设置页有 warning，不属于静默明文，但**这是产品决策而非缺陷**，需要在三者中选一：禁止持久化 / 仅会话内存 / 由用户显式确认后降级。
- **IPC 参数校验**：多数处理器仍是透传，未做运行时校验（上次仅给 `npm:smart-analyze` 补了类型检查）。建议对写操作类处理器统一做参数校验，并覆盖负向用例。

---

## S5 / P2：管理器能力矩阵仍未统一表达

上次只把 4 个已知矛盾的条目对齐，没有解决"谁在维护能力事实"这个结构问题：

- 注册表仍同时存在 `status`、`implemented`、`searchable`、`healthSupported` 与 `capabilities` 多套字段，页面、诊断、验证脚本各取所需；
- `/extended` 页只列 `getPlannedManagerDefinitions()`（31 条），而拥有 preview 适配器却无专用页面的生态不会出现在这里，形成反向不一致；
- 当前分布：8 stable、23 preview、31 planned。

**建议**（沿用 `PROJECT_REVIEW.md` 的方向）：

1. 把"目标能力"与"已实现能力"拆成两个明确字段，页面与诊断统一读"已实现能力"；
2. `/extended` 页改为列出"无专用页面但已有适配器"的生态，而不是绑定 `planned` 状态；
3. 新增管理器时，能力只需在一处声明，验证脚本自动比对适配器实现，避免再出现双向不一致。

**验收**：任取一个管理器，页面展示状态、诊断结果、验证脚本结论三者一致；新增一个管理器无需同步维护多份状态定义。

---

## S6 / P3：工程债（不直接影响用户，但制约迭代速度）

- **文件规模**：`src/features/health/HealthCenter.tsx` 7955 行、`src/types/global.d.ts` 5842 行、`electron/services/workspaceGovernance.ts` 3770 行、`electron/services/readinessGate.ts` 3353 行、`electron/services/extendedManager.ts` 3040 行、`electron/main.ts` 2066 行。
- **类型逃逸**：约 597 处 `any` / `as any`，削弱了严格类型检查的收益。
- **测试门禁**：无 `npm test`、无 lint/format 脚本、无桌面 E2E。现有 `verify` 体系很扎实（框架组 665 项），但断言多为"生成的字符串是否正确"，覆盖不到 React 交互——本批次修复的 coordinator 竞态就完全测不出来。
- **CI 覆盖**：`.github/workflows/quality.yml` 的 `verify:framework` 组未包含 `deno` / `cocoapods` / `ansible` / `terraform`；`.github` 目录在本批次首次纳入版本控制，需确认 Actions 实际执行情况。

**建议**：按职责拆分超限文件（HealthCenter 拆数据 hooks / 容器 / 对话框 / 展示组件；`extendedManager` 拆解析 / 计划 / 执行 / 备份）；`any` 采用"只减不增"基线；补一层组件级测试与桌面冒烟；把缺失的验证组加进 CI。

---

## 优先级建议

如果只做一件事，选 **S1.1**：把 `withProjectSnapshot` 接入 `withProjectMutation` 的同一队列。改动集中、风险低，但它决定了用户能否放心在真实项目上批量改依赖——当前并发写会让改动互相覆盖，这是本清单里唯一会**造成不可见的数据丢失**的问题。

其后顺序建议：S1.2 / S1.3（取消与结构化失败）→ S2（失败可见）→ S5（能力矩阵统一）→ S3（文件监听）→ S4（安全决策）→ S6（工程债）。

---

## 与既有计划的关系

本文是 `PROJECT_REVIEW.md` 第 5 节 M0–M5 的补充与再排序，不替代它：

- 该文 M1（核心正确性）中的 F1–F4 已完成，F5 部分完成 → 本文 S5 承接剩余部分；
- 该文 M2（执行与测试基础）尚未开始 → 本文 S1 是其具体化，并补充了"并发写无互斥"这一当时未记录的具体缺陷；
- 该文 4.3（性能与失败反馈）、4.4（桌面边界）未开始 → 本文 S2 / S3 / S4 承接；
- 该文 4.1（规模）、4.2（测试门禁）未开始 → 本文 S6 承接。

## 核实方式与限制

- 本文所有结论均来自对 `10ecb05` 代码的静态核对与检索（如 39 个并发调用、65 处 `catch(() => null)`、597 处 `any`、49 处 `withProjectSnapshot` 均为实际计数）。
- **未做**运行时压测、内存与启动耗时基准；未在 macOS/Linux 上执行；未做真实生态的端到端安装验证。上述场景下的结论应视为待验证假设。
- S1.1 的并发覆盖问题为代码结构推断（缺少互斥与测试），尚未用可复现场景实测确认写入冲突的具体表现。
