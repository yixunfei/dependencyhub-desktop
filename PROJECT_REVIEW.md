# 项目进度、缺陷与后续开发计划

评估日期：2026-09-15。评估对象：当前工作区，包含未提交和未跟踪的开发改动。重点：功能完整性与工程质量。

## 1. 结论

项目已经完成多生态桌面依赖管理平台的主体框架，拥有实际的管理器服务、项目工作区、健康与治理报告、工具链配置及构建链路。当前处于“功能覆盖较广、核心行为仍需收敛验证”的阶段。

主要问题不是缺少更多菜单或生态入口，而是部分功能的“声明—预览—执行—结果—恢复”没有形成一致闭环。此次隔离复现发现了操作计划与执行不符、项目切换数据串扰、回滚不完整等问题；基础 npm 依赖分类也存在错误。建议下一个开发周期优先修复这些问题，并同步建立行为级回归门禁。

不建议给整个项目报一个完成百分比：尚无经确认的目标能力清单和验收分母，管理器数量也不能代表可用程度。注册表中的 stable/preview 仅是项目自身声明，不是本次审计认证。

## 2. 当前进度

| 模块 | 已有实现 | 当前判断 / 剩余工作 |
| --- | --- | --- |
| 桌面基础 | Electron 主进程、preload 桥接、React 路由、主题、中英文、设置、日志 | 主体已完成；IPC 边界、错误恢复及真实桌面回归待加强 |
| 项目工作区 | 清单检测、工作区发现、项目/全局作用域、最近目录、上次目录恢复 | 基本功能已有；异步请求隔离、缓存错误清理、文件监听需要修复 |
| 8 个内置管理器 | npm、pip、Maven、Gradle、Cargo、Go、Flutter、Native 各有服务和页面 | 已有主要实现；不能据此认定全部操作在三平台完整可用，npm 已发现基础缺陷 |
| Node / Python / Backend 扩展 | pnpm/Yarn/Bun、uv/Poetry/Pipenv/Conda、NuGet/Composer/Bundler 的专用解析、计划、搜索与健康检查 | 已进入 preview，有专项 fixture 验证；仍需真实工具集成测试 |
| Cloud / Platform / Infra 扩展 | Helm、Helmfile、SwiftPM、Deno、CocoaPods、Terraform/OpenTofu、Ansible 等专用模块 | 部分推进中；新 planner 与旧 executor 脱节，状态声明尚未统一 |
| 健康与治理 | 清单盘点、许可证、漂移、审计证据、发布检查、审批记录、例外、回滚计划、签名/来源报告 | 实现覆盖很广；应验证数据来源、报告失败语义和执行闭环，治理报告不等于外部系统执行完成 |
| 工具链 / 凭据 | 全局及项目级工具路径、系统安全存储、凭据元数据 | 已实现；命令超时/取消、并发写入及安全存储不可用时的策略待加强 |
| 工程验证 | 严格 TypeScript 检查、构建、管理器专项验证、历史框架回归 | 已有基础；缺少仓库内 CI、桌面 E2E、真实 CLI 与故障恢复覆盖 |

注册表共有 **62 个管理器条目：8 stable、19 preview、35 planned**。

其中 19 个 preview 为 pnpm、Yarn、Bun、Deno、uv、Poetry、Pipenv、Conda、NuGet、Composer、Bundler、SwiftPM、CocoaPods、Helm、Docker、Helmfile、Terraform、OpenTofu、Ansible。另有 Kustomize、Skaffold、Argo CD、Flux 被实际适配器覆盖为 preview，但注册表仍为 planned。这种矛盾本身就是待修缺陷。

对现有 `.zcode/plans/` 计划的核对：

- 最近项目、路径恢复、npm 读取错误展示等已经落地，但项目切换与缓存错误残留的回归尚不完整。
- Cloud/Platform/Infra 已增加独立实现文件和专项脚本，但注册表状态、契约验证与执行链路没有全部同步。
- Helmfile 已有解析、健康检查及计划生成；原计划要求的可靠执行、失败回滚、受限清单编辑等不能按完成处理。专项脚本目前主要检查 inventory、plan 和 health，没有证明这些执行能力。

## 3. 已确认的功能缺陷

### F1 / P1：操作预览与实际执行不一致

证据位置：

- `electron/managers/profiledAdapter.ts:87` 的计划使用 `operationPlanner`。
- 同文件 `:124` 的默认执行回到 `ExtendedManagerService.execute()`，重新走另一套命令映射。
- `electron/managers/groups/cloud/helmfileOperations.ts:4` 与 `electron/services/extendedManager.ts:585` 的 Helmfile 分支不一致。

在临时目录中替换底层命令执行器，直接调用真实 `ManagerWorkspaceService.plan/execute`，得到：

| 请求 | 预览 | 执行器收到的命令 |
| --- | --- | --- |
| Helmfile sync | `helmfile sync` | `helmfile template` |
| Helmfile install | `helmfile apply` | `helmfile template` |

这会使用户误以为已同步/安装，实际仅完成渲染。旧 `unsupported()` 只是增加 warning，仍返回可执行 fallback，并不阻止执行。

修复方向：使用同一个强类型操作计划驱动预览与执行；包含 manager、项目路径、参数、前置条件、变更范围和风险。执行端重新校验计划和项目状态，但不得切换另一套命令语义。不支持的操作应返回明确的不可执行结果。

验收：逐个 advertised operation 检查预览参数与实际执行参数相同；不支持操作不启动进程；高风险远程操作需单独定义确认与恢复边界。

### F2 / P1：切换项目后旧请求覆盖新项目数据

证据：`src/stores/packageStore.ts:160` 发起请求后，在 `:267` 无条件写回全局 `projectPackages`；没有请求序号、路径校验或取消机制。扩展工作区也存在同类无保护异步写回模式。

对真实 store 注入可控延迟的 npm API，复现：

```text
启动 A 请求 → 启动 B 请求 → B 返回 → A 返回
currentProjectPath = project-B
projectPackages = [package-a]
```

影响：用户在 B 项目的操作上下文中看到 A 的依赖，后续升级/卸载可能选中错误目标。

另一个已复现问题：C 项目读取失败后切回已缓存的 B，B 的列表恢复，但 `projectError` 仍保留 C 的错误；缓存分支没有清理错误状态。

修复方向：以规范化项目路径作为状态与请求边界，用 request ID 防止旧响应覆盖；加载、错误、缓存按项目管理。切换项目同时清理选择项和旧操作计划。

验收：A/B 乱序响应、失败后命中缓存、刷新中切换目录、操作完成后切换目录均不会串数据或残留错误。

### F3 / P1：npm 开发依赖被标记为生产依赖

证据：`electron/services/npm.ts:141` 原样返回 `npm list --json --depth=0`；`src/stores/packageStore.ts:197` 起将其中 `dependencies` 全部标为生产依赖，却另外期待顶层 `devDependencies`。

在当前项目实际运行 npm list：根节点只有 `version,name,dependencies`，没有顶层 `devDependencies`，且 Electron 出现在 `dependencies` 内；项目清单则将 Electron 声明在 `devDependencies`。

影响：依赖类型、筛选和统计错误；使用该类型推导的版本操作需要一并回归。

修复方向：以 package.json 的 dependencies/devDependencies/optionalDependencies/peerDependencies 为声明来源，以 npm list 补充安装版本、缺失和异常状态。损坏或未安装依赖时，也应能够展示清单盘点，不应完全依赖 npm list 的零退出码。

验收：开发、生产、optional、peer、未安装和 invalid/extraneous 状态有真实 fixture；批量升级保持声明位置。

### F4 / P1：变更识别、备份和失败恢复不完整

证据：`electron/services/extendedManager.ts:340`、`:363`、`:390`、`:1030`。

- `commandMutatesProjectFiles()` 与适配器内 `inferMutatingCommand()` 是两套规则，容易分歧。
- 隔离调用 Helm lock：计划得到 `helm dependency build`，但 `mutating=false`、没有备份。该命令可能生成锁文件和下载 chart，不应统一视为纯读取。
- 普通 `runArgs()` 失败时没有回滚，也不把已建备份作为结构化失败结果交还界面；界面只在成功后接收 backup。
- `executeWithMutation()` 虽会恢复已备份文件，但快照仅记录执行前存在的文件。模拟 SwiftPM 失败：原有 Package.swift 恢复，新产生的 Package.resolved 仍存在。

修复方向：由操作描述显式声明本地/环境/远程变更，统一执行与备份策略；快照记录文件是否存在、内容及校验信息；失败结果包含恢复状态和备份入口。恢复新增/删除文件时限定到该操作声明的文件集合，并处理并发修改冲突。

验收：成功、失败、取消、首次生成锁文件、文件删除、恢复失败均有测试；清单/锁文件恢复不应被宣称为环境包或远程集群状态完全回滚。

### F5 / P2：注册表、适配器、页面及诊断不是同一份能力事实

证据：`shared/managerRegistry.ts`、`electron/managers/groups/cloud/cloudAdapters.ts:14`、`electron/services/managerWorkspace.ts:58`、`scripts/verify-manager-contracts.mjs:11`。

- Kustomize/Skaffold/Argo CD/Flux 的注册表 status/health 与适配器不一致。
- `diagnostics()` 检查全部定义，但 registry 只注册扩展管理器，导致 8 个实际拥有独立服务的内置管理器全部被报为未注册。
- 契约脚本检查的主要是由注册表生成的 descriptor，并没有实例化工作区验证最终适配器能力、调用 provider、检查页面声明或计划/执行一致性。

修复方向：确定内置与扩展的明确边界；将能力分成“目标能力”和“已实现能力”，页面、诊断和测试使用实际能力。是否统一内置 adapter 可渐进决策，不应仅为消除诊断而机械重写所有服务。

验收：已实现 provider 可以调用，未实现操作不可误展示为可用；新增一个管理器不需要同步维护多份相互独立的状态定义。

## 4. 工程质量与优化项

### 4.1 / P1：代码规模已显著违反现有规范

按物理行统计 `src/electron/shared/scripts` 下 251 个 TS/TSX/JS/MJS 文件，共约 97,263 行。空行计入；嵌在字符串里的验证脚本不进行二次 AST 分析。

| 文件 | 行数 |
| --- | ---: |
| src/features/health/HealthCenter.tsx | 7,956 |
| src/types/global.d.ts | 5,843 |
| electron/services/workspaceGovernance.ts | 3,771 |
| electron/services/readinessGate.ts | 3,354 |
| electron/services/extendedManager.ts | 2,923 |
| scripts/verify-framework.mjs | 2,853 |
| electron/services/supplyChain.ts | 2,471 |
| electron/main.ts | 2,067 |

共 8 个文件超过 1,500 行，其中 6 个超过 2,500 行。TypeScript AST 检出 80 个带函数体的函数/方法超过 100 行；HealthCenter 组件函数约 7,550 行，setupIpcHandlers 约 1,490 行。约 698 个显式 any 类型节点，严格类型检查的收益因此受到限制。

建议按职责重构：

- HealthCenter 拆出领域数据 hooks、工作流容器、操作对话框和展示组件；现有 overview 目录可以复用，但数据协调不能继续全部留在顶层。
- readinessGate 拆为独立检查器与统一聚合器；workspaceGovernance 分离发现、继承策略、报告与导出。
- extendedManager 分离解析、计划、执行、备份；独立 adapter 承担生态差异。
- main 仅保留生命周期和模块注册，IPC 按领域注册；global.d.ts 仅保留 Window 声明，领域类型移到 shared 模块。
- 为既有超限文件建立递减基线，新增/修改函数按规范治理，避免仅为满足行数压缩代码或机械拆分。

### 4.2 / P1：测试门禁与实际风险不匹配

仓库没有 `.github` 目录；package scripts 中未设置 lint/format/coverage/桌面 E2E。已有 verify 脚本值得保留，缺少 `npm test` 本身不是主要问题；真正的问题是许多验证绕过真实命令边界，仅断言生成字符串或源码含某段文本。

例如 Helmfile 的 13 项检查可以全部通过，同时存在 F1。新增 cloud 验证主要覆盖 Helm，尚未建立 Kustomize/Skaffold/Argo CD/Flux 的完整行为矩阵。

建议分层：纯解析与计划测试 → adapter/executor 契约测试 → 临时项目真实 CLI 集成测试 → Electron 关键路径 E2E。真实生态按其支持平台测试，不在无 CLI 的环境把 mock 结果当真实集成通过。

历史框架脚本仅在全部断言结束时汇报检查总数，runner 的定时输出只说明进程仍存活，不能定位慢用例。应按领域拆分 fixture 和回归单元，输出当前用例、阶段耗时与单用例超时；先定位慢路径，再决定是否调整总时限。

### 4.3 / P2：性能链路与失败反馈需要治理

- npm 列表等待 outdated 和所有包元数据/大小查询完成才写入页面；每批最多 10 个，并且每包先 info 再 size。应先展示本地盘点，远程元数据逐步补齐。
- 元数据部分调用没有项目 cwd，包大小直接访问公共 registry；私有源、项目 `.npmrc` 与包版本上下文可能不一致。建议缓存键包含 registry/项目环境/包/版本。
- `HealthCenter.tsx:315` 在进入页面时并发发起 35 个报告/数据调用；许多错误转为 null，无法区分“无数据”和“加载失败”。应按工作流按需加载，复用同一批项目盘点快照，错误独立可重试。
- `commandRunner.ts` 没有通用 timeout/AbortSignal/取消协议；最大输出限制不能解决静默挂起。需要关联 operation ID、超时与进程树终止策略。
- 当前 FileWatcher 只监听 package.json 的 change；编辑器原子替换、锁文件变更及其他生态清单变更需要额外覆盖。

这些是源码中可见的设计问题；本次没有做启动时间、内存或大仓库 p95 的性能基准，不能给出未经测量的速度结论。

### 4.4 / P2：桌面边界与持久化策略待加强

- 已有 `nodeIntegration:false` 和 `contextIsolation:true`，这是正确基础。IPC handler 多为未进行运行时校验的参数透传；`open-external` 直接接收 URL，未看到统一的来源校验、导航约束和协议 allowlist。需要按实际入口补齐，并做负向测试。
- 系统安全存储不可用时退化为 Base64；设置页已有 warning，因此不能称为“静默明文”，但仍不满足强加密存储承诺。应明确是否禁止持久化、改为会话凭据或由用户选择。
- 凭据库使用固定 `.tmp` 文件且 read-modify-write 没有并发协调；审批/记录类 JSON 存储也需要审查并发丢失与损坏处理。采用存储层串行化、唯一临时文件及可靠替换，增加故障测试。
- 本地审批记录是用户录入的证据；若后续定位为多人或企业发布治理，再补身份、提交/制品绑定、撤销和可验证审计链。当前不应自动等同于外部审批系统。

上述是边界审查发现，不代表此次已复现远程攻击或凭据泄露。

### 4.5 / P2-P3：国际化和文档存在遗留问题

- RuntimeLocalizer 通过全局 MutationObserver 改写 React 管理的 DOM 文本，存在动态文本陈旧、额外遍历和渲染不一致风险。应逐步替换为组件内翻译 key。
- README 仍把部分已在当前工作区实现的管理器列为 planned，与现状脱节；Unreleased 没有当前开发记录。
- README 的多处行内代码/代码围栏带字面反斜杠，影响正常 Markdown 渲染。
- `.gitignore` 忽略整个 docs/，不利于跟踪架构说明、能力矩阵和长期计划；应明确文档与生成报告各自的存放策略。

## 5. 后续开发计划

以下为建议计划，未在本次执行代码修复。工期是单人集中开发的粗估，不包含全部生态安装、平台签名或外部评审等待；先完成第一阶段后重新估算。

| 阶段 | 目标与工作项 | 验收条件 | 粗估 |
| --- | --- | --- | --- |
| M0：能力基线 | 整理 62 条目的真实能力矩阵；对齐当前工作区与 README/Unreleased；确定下一轮重点生态 | 每个入口标明 inventory/search/plan/execute/health/restore、限制及测试证据；不以数量代替完成度 | 1–2 人日 |
| M1：核心正确性 | 修 F1–F5，先加可复现行为测试再改实现；修 npm 类型与缓存/请求隔离 | 计划等于执行；不支持即拒绝；A/B 切换不串数据；失败恢复完整；注册表/诊断一致 | 5–8 人日 |
| M2：执行与测试基础 | 统一 operation context、超时取消、项目写操作串行化、结构化失败；加入 CI/关键 CLI 集成和桌面冒烟 | 支持取消和超时；同项目写操作不竞争；CI 自动运行类型、构建、行为测试；失败日志可定位 | 5–8 人日 |
| M3：职责重构与体验 | HealthCenter、IPC、共享类型、extendedManager 按职责拆分；本地列表优先、健康按需加载、错误可重试 | 核心模块符合规模规范；无新增 any 逃逸；前述回归全通过；记录优化前后的相同场景基准 | 6–10 人日 |
| M4：重点生态闭环 | 优先 npm/pnpm/Yarn/Bun，再选择实际使用的 Python/backend；逐个完成真实安装、升级、失败恢复 | 临时真实项目端到端通过；Windows 优先，macOS/Linux 对各自支持能力跑矩阵；逐项决定能否升 stable | 5–10 人日，随生态数量调整 |
| M5：发布准备（需要交付时） | 安装包启动/升级/卸载、平台权限与签名、发布资产/文档/校验 | 干净环境安装和关键路径通过；完整性/签名/信任验证使用真实导出的证据通过 | 单独估算 |

依赖顺序：M0 → M1 → M2；M3 可按已建立回归保护的模块推进；M4 依赖统一执行与验证基础。不建议在 M1 完成前继续增加新的 planned 生态入口。

首批建议任务，可直接转 issue：

1. `fix(manager): unify plan and execution semantics`，覆盖 Helmfile 和 fallback 拒绝。
2. `fix(workspace): isolate asynchronous state by project`，覆盖乱序响应、缓存错误和选择项。
3. `fix(npm): classify dependencies from package manifest`，覆盖 dev/optional/peer/未安装状态。
4. `fix(operations): restore complete manifest and lockfile state`，覆盖新建/删除文件、失败备份入口。
5. `test(managers): verify effective adapter capabilities`，覆盖注册表、实际 adapter、页面与命令参数。

每阶段完成审查：问题是否被行为测试覆盖、错误路径是否清晰、是否新增第二套事实来源、是否符合职责和规模规范。避免一次性重写整个项目。

## 6. 本次验证记录与限制

- `npm run verify:framework -- --group legacy`：通过，退出码 0；framework verification passed (665 checks)，总耗时约 221.8s。阶段证据：`extended-parsers` 约 72.9s，`framework-main` 约 221.4s；此前阻塞由 workspace discovery 在 manager×workspace 重复读取目录造成，已通过单次 report 生命周期目录名缓存修复。
- Legacy verifier 的 5 个 CLI 子进程现在具备 5s timeout/killSignal；extended parser 和阶段日志会输出耗时及最慢阶段，便于后续性能回归定位。- Added `.github/workflows/quality.yml`, `cli-integration.yml`, `platform-build.yml`, and `release-gates.yml`. These workflows use native OS runners and explicit commands; they are configuration evidence only until GitHub Actions executes them.
- Added `scripts/verify-packaged-smoke.mjs` and `npm run verify:packaged-smoke`. It requires a real packaged executable and reports `packaged-gui` blocked when the artifact is absent; no local packaged smoke pass is claimed.
- Release gates now explicitly require integrity, signature, and trust commands with protected signing secrets. Current local release gates remain blocked because bundle/provenance/trust policy/signing evidence and production certificates are absent.
- 当前 Windows packaged smoke：`npm run verify:packaged-smoke -- "E:\\npmManager\\release\\win-unpacked\\DependencyHub Desktop.exe"`，退出码 0，输出 `evidence=packaged-gui,status=passed,startupObserved=true`。该门禁仅证明进程启动存活，不等价于 GUI/Electron E2E。
- 当前 release 哈希：installer SHA-256 `1297e027d0fcc526fbadf5aad1499dce54e24202014dad1980524102516e49e6`；portable SHA-256 `8962e0cd4c5a11d4174d8b4ae8b38dd9481580441d4d0dd08138235a5a0aedf0`；SHA-512 已由同一命令计算。digest 与现有 `release/SHA256SUMS.txt` 一致，但该文件含 BOM/文件名格式差异，不能将直接文本 diff 当作完整发布门禁。
- 当前 release verifier 真实结果：`verify-release-integrity --no-write --quiet` 退出 1，`blocked (0/0 verified)`；`verify-release-signature --json-only` 退出 1，`status=blocked, verificationStatus=not-signed, includedSourceCount=1/3`；`verify-release-trust --json-only` 退出 1，`status=blocked, missing=true, checkCount=0`。
- 当前 Authenticode 证据：Windows SignTool 可执行，但 installer 与 portable 均报告 `SignTool Error: No signature found`；没有证书/私钥或 `NPM_MANAGER_RELEASE_SIGNING_KEY`，不能宣称生产签名或 trust 通过。
- 当前原生 runner/CI 事实：本机为 Windows；`gh`、`act` 和 Playwright/WinAppDriver 等 GUI 工具不可用；`.github/workflows` 仍未跟踪，GitHub Actions API 未有可见 run。因此 platform-build、CI、macOS/Linux 原生构建和安装/卸载 smoke 没有真实执行证据。
- `npm run verify:core`：通过，25 项核心 F1–F4 行为检查，新增真实临时 npm fixture（missing、声明类型和 peer/problem 保留）、latest-only A/B scope、恢复并发冲突保护、timeout/取消 API 契约与备份恢复场景。
- `npm run verify:framework -- --group core --group contracts --group node --group python --group backend --group cloud --group swiftpm --group helmfile`：8 个组选定回归通过；contracts 54 个管理器，专项输出 Node 23、Python 34、Backend 34、Cloud 10、SwiftPM 17、Helmfile 13，core 25。
- F1–F4 当前行为验证已覆盖：unsupported 零进程、计划执行参数、真实临时 npm 状态/manifest、A/B scope 乱序拒绝、首次生成和删除文件恢复、备份入口以及并发恢复冲突不覆盖外部修改。
- 发布完整性（`--no-write`）、签名及 trust 验证：本地缺少发布 bundle/provenance/signature/trust 证据，仍为 blocked；不能据此判断线上版本。
- 当前工作树已有未提交开发改动，本轮未提交 commit，也未覆盖其他无关修改；`git diff --check` 通过。