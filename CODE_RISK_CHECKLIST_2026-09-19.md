# 代码库风险与缺陷审查清单（2026-09-19）

> **审查对象**：`e:/npmManager`（DependencyHub Desktop，Electron + React；主进程 172 个 TS 文件 / 渲染层 193 个文件）
> **审查方式**：只读静态审查（6 路并行独立审查 + 关键点人工二次复核），未修改任何业务代码
> **版本基线**：本次备份提交（见 `git log -1`）
> **锁定版本核对**：`package-lock.json` 中 antd 6.4.2 / electron 42.11.4 / esbuild 0.28.2 / fast-xml-parser 5.11.0 / react-dom 19.2.6 / semver 7.8.0 / vite 8.3.0 / yaml 2.9.0
> **使用说明**：`[ ]` = 待人工复核；复核后自行勾选并可在行尾追加结论。本文档只列问题，不含修复建议。
> **限制说明**：未做运行时验证与 `npm audit`；行号基于本清单提交时的快照，后续改动可能偏移。

## 统计概览

| 分类 | 高 | 中 | 低 | 信息 | 合计 |
|---|---|---|---|---|---|
| A. 安全漏洞 | 6 | 26 | 12 | - | 44 |
| B. 资源泄漏 | 1 | 5 | 6 | - | 12 |
| C. 并发问题 | 2 | 13 | 3 | - | 18 |
| D. 错误处理与静默失败 | 3 | 11 | 1 | - | 15 |
| E. 边界与空值 | 0 | 3 | 5 | - | 8 |
| F. 类型安全 | 1 | 1 | 1 | - | 3 |
| G. 代码质量 | 0 | 6 | 2 | - | 8 |
| H. 依赖 / 配置 / CI | 2 | 6 | 5 | 1 | 14 |
| **合计** | **15** | **71** | **35** | **1** | **122** |

**建议优先复核（高等级）**：A-01、A-02、A-03、A-04、A-22、A-23、B-01、C-01、C-13、D-01、D-02、D-13、F-01、H-01、H-02

---

## A. 安全漏洞

### A1. 命令执行与注入

- [ ] **A-01｜高｜任意程序执行** — `electron/services/toolchain.ts` L236-249、L255-265、L329-333（入口 `electron/main.ts` L682-684）｜触发：渲染进程把工具名指向任意本地 `.cmd/.exe`（校验仅为"文件存在"），后续所有命令通道启动该文件
- [ ] **A-02｜高｜任意文件写入+脚本执行链** — `electron/main.ts` L823-825；`electron/services/project.ts` L144-147；`electron/services/npm.ts` L293-296｜触发：先以任意路径写入带 `scripts` 的 package.json，再以同目录执行 `npm run-script`/`install`
- [ ] **A-03｜高｜暴露原始 shell 原语** — `electron/services/terminal.ts` L117-130、L72-84；`electron/main.ts` L2087-2097；`electron/preload.ts` L533-537｜触发：渲染进程调用 `terminal.create/write` 即可以 PowerShell `-ExecutionPolicy Bypass` 执行任意命令，`cwd` 无范围限制
- [ ] **A-04｜高｜命令行注入/任意子命令** — `electron/main.ts` L1417-1430（另 L1044/L1172/L1204/L1260/L1316/L1361）；`electron/services/splitCommandLine.ts` L9-59；`electron/services/extendedManager.ts` L346｜触发：`manager:run-custom` 等通道仅做分词，如 `npm exec <任意包>`、`cargo install --git <任意仓库>`
- [ ] **A-05｜中｜参数注入** — `electron/services/npm.ts` L169-174、L180、L294；`electron/services/pip.ts` L498-502；入口 `electron/main.ts` L622-633 等｜触发：以 `-` 开头的包名/版本/仓库 URL（含从项目清单读出的值）被当作 CLI 选项执行，无 `--` 分隔
- [ ] **A-06｜中｜全局配置篡改（供应链重定向）** — `electron/services/npm.ts` L239-241；`electron/services/maven.ts` L417-448；`electron/main.ts` L646-648、L994-996、L1072-1078｜触发：`npm:config-set`（registry/script-shell）、`pip:config-set`（index-url）、`maven:set-mirror` 直接改写用户级配置
- [ ] **A-07｜低｜参数注入（cmd 元字符）** — `electron/services/system.ts` L88-98、L106-121；`electron/main.ts` L819-821｜触发：`cwd` 中含 `&`、`|`、`^` 且同名目录存在时，`cmd.exe /K cd /d <cwd>` 解析为额外命令
- [ ] **A-08｜低｜破坏性命令无确认** — `electron/main.ts` L762-764、L1006-1008、L1112-1114｜触发：单次调用即可清空 npm/pip 缓存、purge Maven 本地仓库，`cwd` 不受限

### A2. 任意文件读写与路径穿越

- [ ] **A-09｜中｜路径穿越/任意位置写入** — `electron/services/toolchain.ts` L317-319；`electron/services/pluginCatalog.ts` L125-127；`electron/main.ts` L666-676、L682-688、L823-825、L1128-1130｜触发：`projectPath` 传绝对路径/`..`/UNC/符号链接，即可在任意可写目录写 `.npmDesktopManager/*`、package.json、报告
- [ ] **A-10｜中｜任意文件读取** — `electron/services/auditEvidence.ts` L126-143、L533-540；`electron/services/ciEvidence.ts` L123-130；入口 `electron/main.ts` L1553-1555、L1569-1571｜触发：证据导入通道传入任意绝对路径，内容被读入并写入项目目录、回传渲染进程
- [ ] **A-11｜低｜任意目录监视+信息回传** — `electron/main.ts` L895-904；`electron/services/watcher.ts` L75-92｜触发：`watch:start` 传入任意存在目录，变更事件经 `file-change` 回传
- [ ] **A-12｜中｜依赖快照明文落盘 .npmrc** — `electron/services/supplyChain.ts` L2115-2139、L504-526｜触发：创建依赖快照时把 `configFiles`（含 `.npmrc` 的 `_authToken`）全文写入项目内快照 JSON

### A3. IPC 权限边界与守卫绕过

- [ ] **A-13｜中｜IPC 无 sender 校验** — `electron/ipcHandler.ts` L4-6（约 380 个通道）｜触发：任何进入 preload 桥的脚本可调用全部特权通道，无 `senderFrame`/origin 白名单
- [ ] **A-14｜中｜黑名单不完整（可执行关联绕过）** — `electron/services/shellGuard.ts` L10-14、L34-37；`electron/main.ts` L740-748｜触发：`shell.openPath` 指向 `.url/.inf/.msix/.appx/.msu/.settingcontent-ms/.chm` 等未列入黑名单的现有文件
- [ ] **A-15｜中｜UNC/网络路径未拦截+短路** — `electron/services/shellGuard.ts` L24-32｜触发：传入 `\\host\share` 触发 SMB 访问；路径不存在时扩展名检查被完全跳过；目录直接放行
- [ ] **A-16｜中｜写操作误判为只读（跳过备份/串行化）** — `electron/services/commandMutates.ts` L12-32；`electron/main.ts` L1405-1414｜触发：`npm ci`、`npm version`、`npm link`、`npm rebuild`、`npm publish` 未命中关键字即不入写队列、不建快照
- [ ] **A-17｜低｜恢复流程跳过前置校验** — `electron/services/commandRecovery.ts` L12-17；`electron/services/commandProcess.ts` L67-72｜触发：`processTreeStopped` 为 `undefined`（唯一赋值点为 `false`），"进程树已停止"从未被验证即执行文件恢复
- [ ] **A-18｜低｜桥接层暴露面过大** — `electron/preload.ts` L30、L241-242、L533-537（约 300 个方法）｜触发：渲染进程一次性获得 runCustom/terminal/writePackage/setToolPath/credentials 等原语，无通道分级
- [ ] **A-19｜中｜生产保留 DevTools 与重载菜单** — `electron/main.ts` L2120-2132、L543-547｜触发：打包版通过菜单打开 DevTools 后可在页面内执行任意 JS 并调用上述全部通道
- [ ] **A-20｜中｜Electron fuses 缺失** — `package.json` L101-121；`scripts/verify-packaged-smoke.mjs` L35-37｜触发：`--remote-debugging-port`/`--inspect`/`ELECTRON_RUN_AS_NODE` 对已安装程序仍可用（脚本已实证 CDP 可连）
- [ ] **A-21｜中｜maven:set-server 明文密码落盘** — `electron/services/maven.ts` L451-465；`electron/main.ts` L1080-1082｜触发：密码以明文 XML 写入 `~/.m2/settings.xml`

### A4. 凭据与敏感信息暴露

- [ ] **A-22｜高｜凭据明文等价落盘** — `electron/services/credentialVault.ts` L11-24；`electron/services/credentialVaultCore.ts` L256-275｜触发：Linux 无 keyring 时 `safeStorage` 不可用，回退 base64 保存
- [ ] **A-23｜高｜URL 内嵌凭据写入报告** — `electron/services/registryReachability.ts` L359-380、L487-492、L108-132、L414-421；`electron/services/credentialUsage.ts` L162-173；`electron/services/credentialRotationPlan.ts` L200-206｜触发：注册表 URL 含 `user:token@host` 时，任意一次导出报告即原样落盘
- [ ] **A-24｜中｜命令输出外泄到渲染进程** — `electron/services/commandRunner.ts` L117-123；`shared/ipcFailure.ts` L16-17、L35｜触发：命令失败时完整 stdout/stderr（可能含 token 回显）随 IPC 失败信封跨进程返回
- [ ] **A-25｜中｜命令日志无脱敏推送** — `electron/services/commandLogger.ts` L19-39｜触发：原始 `formatCommand()`（含 `--password`/`--otp`）与原始输出推送到渲染窗口
- [ ] **A-26｜中｜脱敏规则覆盖不全** — `electron/services/operationHistory.ts` L269-281、L112-122（来源 `electron/services/npm.ts` L234-237、L308-315）｜触发：`npm config get //host/:_authToken`（裸值）、`config list --json`（键后紧跟引号）不被脱敏即落盘
- [ ] **A-27｜中｜位置参数密钥不脱敏** — `electron/services/operationHistory.ts` L252-267、L303-306｜触发：`docker login -p <pwd>`、`--with-token` 等非名单形式密钥进入历史
- [ ] **A-28｜中｜历史文件权限/轮转问题** — `electron/services/operationHistory.ts` L8、L112-133、L232-245｜触发：mkdir/appendFile 未指定 mode；轮转失败被吞；`command` 字段无长度上限；仅保留一代 `.1`
- [ ] **A-29｜中｜凭据库文件权限未收紧** — `electron/services/credentialVaultCore.ts` L229-249、L142、L153、L186｜触发：mkdir/writeFile 未传 mode（POSIX 下通常 0644/0755）
- [ ] **A-30｜中｜存储声明可被篡改降级** — `electron/services/credentialVaultCore.ts` L336-358；`electron/services/credentialVault.ts` L32-37｜触发：外部编辑 vault JSON 将 storage 置非法即按 base64 解密；`encrypted` 字段可直接改写影响门禁判定
- [ ] **A-31｜中｜凭据经环境变量注入子进程** — `electron/main.ts` L351-360；`electron/services/commandProcess.ts` L38-45；`electron/services/encoding.ts` L8-9；`electron/services/terminal.ts` L28-36｜触发：`NODE_AUTH_TOKEN` 进入子进程环境，被同用户进程读取并被终端继承
- [ ] **A-32｜中｜密码写入主进程全局 env** — `electron/services/pip.ts` L498-510｜触发：twine 发布把密码写入 `process.env.TWINE_PASSWORD`，窗口期内所有新子进程/终端继承
- [ ] **A-33｜低｜凭据后 4 位明文暴露** — `electron/services/credentialVaultCore.ts` L119-134、L309-313；`electron/main.ts` L709-711｜触发：`secretPreview` 随 `credentials:list` 返回渲染进程
- [ ] **A-34｜低｜密钥指纹/HMAC 落盘** — `electron/services/releaseSignature.ts` L321-328、L341-349、L203-217、L602｜触发：报告含 keyId（密钥 sha256 前 16 位）与 HMAC 值，可离线比对弱口令

### A5. 网络传输与信任链

- [ ] **A-35｜中｜允许明文 http 端点** — `electron/services/registryHttp.ts` L29｜触发：任意调用方传入 `http://` registry 时自动明文传输
- [ ] **A-36｜中｜响应体无大小上限** — `electron/services/registryHttp.ts` L31-43｜触发：恶意/被劫持 registry 在超时窗口内持续返回数据直至内存耗尽
- [ ] **A-37｜中｜签名导出结果未校验即标 verified** — `electron/services/releaseSignature.ts` L352-369、L233-235｜触发：走 export 通道不做任何校验，`verified:true`；消费方误判
- [ ] **A-38｜中｜信任门禁仅降级不阻断** — `electron/services/releaseTrustPolicy.ts` L256-280、L430-436｜触发：`key-unavailable`/`unsigned` 仅 warning，仅 mismatch/invalid 才 blocked
- [ ] **A-39｜低｜远端响应体原文入错误消息** — `electron/services/registryHttp.ts` L39-41｜触发：HTTP ≥400 时整个响应体作为 Error.message 传播至 UI/历史
- [ ] **A-40｜低｜SSRF/内网探测面** — `electron/services/registryReachability.ts` L320-357、L139-147｜触发：项目清单声明任意 URL（含内网）即发起 HEAD/GET 且跟随重定向
- [ ] **A-41｜低｜弱哈希与非常量时间比较** — `electron/services/auditEvidence.ts` L916-918；`electron/services/releaseSignature.ts` L440-448；`scripts/verify-release-signature.mjs` L173-174｜触发：sha1 截断 16 位作 ID；HMAC 逐字符比较（时序侧信道）
- [ ] **A-42｜低｜非密码学随机** — `electron/services/commandLogger.ts` L11-13；`electron/services/supplyChain.ts` L2421｜触发：日志 ID/快照文件名使用 `Math.random()`
- [ ] **A-43｜低｜渲染层外部 URL 无 scheme 校验** — `src/features/search/Search.tsx` L413-437；`src/features/managers/npm/scopes/project/Project.tsx` L656-677；`src/features/managers/npm/scopes/global/Global.tsx` L480-501；`src/components/Package/PackageDetailModal.tsx` L207-227；`src/components/Package/SecurityAuditModal.tsx` L202-206、L344-348；`src/features/managers/extended/ManagerDiagnosticsPanel.tsx` L87-89；`src/features/managers/maven/MavenManagerPage.tsx` L1098；`src/features/managers/flutter/Flutter.tsx` L763-766｜触发：远端元数据/report 中的 URL 直接交 `openExternal`，`file:`/自定义协议未在渲染侧拦截
- [ ] **A-44｜中｜包名未编码拼 URL + 浮动 Promise** — `src/components/Package/DependencyTreeModal.tsx` L155-157；`src/features/search/Search.tsx` L435｜触发：依赖名含 `?`/`#`/`/` 时点击依赖标签，URL 结构被破坏

---

## B. 资源泄漏

- [ ] **B-01｜高｜子进程未彻底终止** — `electron/services/commandProcess.ts` L67-72｜触发：`terminateProcessTree` 失败时仅 kill 直接子进程（Windows 上是 cmd.exe 包装层），真实 npm/node 继续写 manifest，同时回滚被跳过
- [ ] **B-02｜中｜备份磁盘无上限增长** — `electron/services/extendedManager.ts` L1118-1152（BACKUP_DIR L151）｜触发：每次变更类命令写全文备份，无清理/保留策略
- [ ] **B-03｜中｜临时文件残留** — `electron/services/atomicWrite.ts` L11-20｜触发：写 tmp 失败（EACCES/ENOSPC）时 tmp 留在项目根；调用方遍及 project/native/maven/gradle/flutter 等
- [ ] **B-04｜中｜临时文件残留+固定名** — `electron/managers/groups/platform/swiftpmManifestEditor.ts` L8-10、L47-52｜触发：两次 rename 均失败时含新内容的临时文件永久残留
- [ ] **B-05｜中｜终端会话无上限/fire-and-forget 清理** — `electron/services/terminal.ts` L21-39、L86-108；`electron/main.ts` L526｜触发：反复 create 不 kill；退出时 `killAll()` 不等待即退出
- [ ] **B-06｜中｜watcher 失效条目泄漏** — `electron/services/watcher.ts` L105-107｜触发：FSWatcher error 时不 close、不移除，仍上报"已监视"
- [ ] **B-07｜低｜watch 失败条目不回滚** — `electron/services/watcher.ts` L83-93｜触发：目录不存在提前 return，`requests` 条目保留且 Promise 正常 resolve
- [ ] **B-08｜低｜O(n²) 输出累积/主进程阻塞** — `electron/services/commandProcess.ts` L75-87；`electron/services/encoding.ts` L31-32、L47-48｜触发：大输出命令每 chunk 复制全量累积字符串
- [ ] **B-09｜低｜内存缓存无上限** — `src/stores/packageStore.ts` L22-27、L509-512；`src/hooks/useDependencyHealthReminder.ts` L6｜触发：浏览多个项目路径时 cache / Map 持续增长
- [ ] **B-10｜低｜渲染层终端缓冲 O(n²)** — `src/components/CommandLog/CommandLogWindow.tsx` L246-256、L56、L196-206｜触发：长会话每个 chunk 全量遍历求和+join；expandedLogs 无淘汰
- [ ] **B-11｜低｜性能/资源尖峰** — `electron/services/lockfileDrift.ts` L136-138、L281-288｜触发：大型 monorepo 无并发上限 + O(N²) 路径计算
- [ ] **B-12｜低｜并发进程峰值无限制** — `electron/services/toolchain.ts` L305-307、L336-354｜触发：`checkTools` 一次性并发 62 个工具（pip 再×5 候选）探测，无并发上限/AbortSignal

---

## C. 并发问题（竞态 / 死锁 / 挂起）

- [ ] **C-01｜高｜终止顺序失效竞态** — `electron/services/processTree.ts` L3、L6-13｜触发：SIGKILL 投递即 resolve，调用方在进程未死时释放变更锁/恢复文件
- [ ] **C-02｜中｜审批对象漂移** — `electron/services/dependencyHealth.ts` L114、L136-145、L163｜触发：渲染端持有旧 action id，期间重扫后同 id 指向另一依赖/另一命令
- [ ] **C-03｜中｜读-改-写 TOCTOU** — `electron/services/toolchain.ts` L236-249、L321-327｜触发：并发保存 `toolchain.json` 后写覆盖前写；写入中断后读取端静默丢弃全部配置
- [ ] **C-04｜中｜计划与执行不一致** — `electron/managers/profiledAdapter.ts` L88-92、L132-141｜触发：确认框展示的 args 与实际执行各自独立规划一次
- [ ] **C-05｜中｜全局共享状态无互斥** — `electron/services/system.ts` L60-76｜触发：`setCachePath/clearCache/update-npm` 绕过已有的全局 npm 串行化队列（`electron/main.ts` L418）
- [ ] **C-06｜中｜子进程管道挂起** — `electron/services/commandProcess.ts` L50-58｜触发：孙进程持有 stdout/stderr 管道且未设 `timeoutMs` 时命令 Promise 永不 resolve
- [ ] **C-07｜中｜taskkill 无超时挂起** — `electron/services/processTree.ts` L14-24｜触发：taskkill 不报错也不结束时 Promise 永不 settle，IPC 与活动条目永久挂起
- [ ] **C-08｜中｜重试被永久拒绝** — `electron/services/operationContext.ts` L76-77、L88-91｜触发：一次操作卡住后 finally 不执行，注册表条目不删除，同 operationId 重试被拒
- [ ] **C-09｜低｜历史轮转竞态** — `electron/services/operationHistory.ts` L112-133、L322-331｜触发：stat 与 rename 之间无锁，append 与 rename 并发导致整行 JSON 解析失败被丢弃
- [ ] **C-10｜低｜定时器回调竞态** — `electron/services/watcher.ts` L121-128；`electron/main.ts` L896-903｜触发：250ms 去抖期间窗口销毁，回调内 `webContents.send` 抛未捕获异常
- [ ] **C-11｜低｜同步 realpath 阻塞主进程** — `electron/services/projectMutation.ts` L13；`electron/services/projectIdentity.ts` L8；`electron/services/operationContext.ts` L102、L105｜触发：项目位于慢速/断网盘时每次入队/取消同步阻塞
- [ ] **C-12｜中｜并发操作共用同一 loading 标志** — `src/stores/packageStore.ts` L427-505；`src/features/settings/Settings.tsx` L19-24、L229-268；`src/features/managers/pip/PipManagerPage.tsx` L70、L181-205、L224-273｜触发：同时安装 A+卸载 B 时，先完成者清除后完成者的 loading（无计数/令牌）
- [ ] **C-13｜高｜破坏性操作无 in-flight 守卫** — `src/components/Package/NpmVersionPicker.tsx` L117-139；`src/features/search/Search.tsx` L400-404、L956-976；`src/features/managers/npm/scopes/project/Project.tsx` L630-654｜触发：快速连点版本标签触发并行安装（无 loading/disabled/确认）
- [ ] **C-14｜中｜请求无竞态保护** — `src/components/Package/SecurityAuditModal.tsx` L56-81、L60-64｜触发：切换 scope/projectPath 后旧审计响应覆盖新状态；卸载后 setState
- [ ] **C-15｜中｜自动补全无防抖/竞态序号** — `src/features/managers/go/Go.tsx` L194-211；`src/features/managers/cargo/Cargo.tsx` L205-222；`src/features/managers/gradle/Gradle.tsx` L204-225；`src/features/managers/pip/PipManagerPage.tsx` L563-577；`src/features/managers/flutter/Flutter.tsx` L285-302；`src/pages/PluginComponents/PluginComponents.tsx` L239-280｜触发：安装弹窗每次按键触发后端搜索，旧响应覆盖新结果
- [ ] **C-16｜中｜文件监听无节流** — `src/features/managers/npm/scopes/project/Project.tsx` L98-146；`src/stores/packageStore.ts` L209-231｜触发：编辑器保存多次 fs 事件 → 多次全量 list/outdated + 逐包详情请求
- [ ] **C-17｜中｜批量操作无限并发** — `src/components/Package/BatchVersionPreviewModal.tsx` L42-52；`src/features/health/healthReportCatalog.ts` L34-77｜触发：一键"更新全部"或进入健康中心同时对全部包/42 个报告块发起 IPC
- [ ] **C-18｜中｜发布改写 package.json 失败不回滚** — `src/features/managers/npm/scopes/publish/Publish.tsx` L100-157｜触发：`npm publish` 失败后本地磁盘与状态仍是被改写的版本

---

## D. 错误处理缺失与静默失败

- [ ] **D-01｜高｜失败伪装成"无问题"** — `electron/services/dependencyHealth.ts` L682-699、L204-214｜触发：`npm ls`/`mvn dependency:tree`/`pub outdated` 启动失败/超时被 catch 转为空结果，"scan failed"分支为死代码，UI 显示全 0 即"健康"（已人工复核）
- [ ] **D-02｜高｜报告缺失返回 0 漏洞** — `electron/services/maven.ts` L515-527｜触发：审计命令成功但报告文件未落盘时返回 `{issues:[]}` 且无 error 字段
- [ ] **D-03｜中｜降级伪造依赖名** — `electron/services/pip.ts` L408-433、L426、L772-778｜触发：pipdeptree 不可用时 `Requires:` 按逗号切分，`>=2`/`!=1.5.7` 成为包名
- [ ] **D-04｜中｜读取失败→全部依赖误判** — `electron/services/npm.ts` L118-133、L217-231｜触发：package.json 不可读/非法 JSON 时 `{}` 为真值，已安装依赖全标 extraneous、声明全标 missing
- [ ] **D-05｜中｜插件禁用状态被清空并回写** — `electron/services/pluginCatalog.ts` L129-138、L78-91｜触发：`plugin-components.json` 读失败后开/关任一插件，此前禁用列表被静默重置
- [ ] **D-06｜中｜单文件损坏中止整个清单读取** — `electron/managers/groups/infra/infraInventory.ts` L26-44｜触发：`.tf.json` 非法或遍历中文件消失，无单文件隔离（与 python 清单策略不一致）
- [ ] **D-07｜中｜manifest 存在性检查与 stat 间消失** — `electron/services/project.ts` L200-223（L211）｜触发：inventory 期间用户删除/重命名文件，ENOENT 直接上抛
- [ ] **D-08｜中｜变更命令缺 cwd/packageName 校验** — `electron/services/npm.ts` L167-203；`electron/services/publish.ts` L72-86；`electron/services/commandProcess.ts` L39｜触发：缺 cwd 时回退主进程工作目录执行 install/publish；packageName 为 undefined 时 Windows 分支抛 TypeError
- [ ] **D-09｜中｜OSV 响应未包裹 JSON.parse** — `electron/services/flutter.ts` L389｜触发：代理返回 200 但非 JSON（HTML 错误页）时整个 securityAudit 抛错
- [ ] **D-10｜中｜静默吞错清单** — `electron/services/cargo.ts` L64-95；`electron/services/go.ts` L68-70、L90-91、L99-100、L116-117；`electron/services/gradle.ts` L68-94；`electron/services/npm.ts` L243-250、L298-315、L362-369、L611-636；`electron/services/toolchain.ts` L321-327；`electron/services/native.ts` L110-121、L183-216；`electron/managers/groups/ai/mcpInventory.ts` L116-124（同 `skillsInventory.ts` L62-69、`agentsInventory.ts` L57-64）；`electron/services/lockfileDrift.ts` L256-273、L314-323；`electron/services/dependencyHealth.ts` L245-254｜触发：CLI/网络/解析失败与"无结果"不可区分；诊断修复失败以正常字符串返回，快照/回滚不触发；锁文件 stat 失败误报 blocked；包管理器 pin 读取失败误报
- [ ] **D-11｜中｜成功与失败混淆** — `electron/services/go.ts` L126-144；`electron/services/flutter.ts` L199-207｜触发：`go get` 已改 go.mod 后 tidy 失败 → 整体报失败；pubspec 已写后 pub get 失败 → 报失败但清单已变
- [ ] **D-12｜低｜部分成功无感知** — `electron/services/native.ts` L423-471｜触发：本地库扫描 8000 条处静默截断，无截断标记
- [ ] **D-13｜高｜无错误边界** — `src/App.tsx` L48-102（L53）；`src/main.tsx` L19-36｜触发：任意路由组件渲染抛错直接白屏（全仓 ErrorBoundary 0 命中）
- [ ] **D-14｜中｜12+ 处 IPC 调用未 await/void/catch** — `src/components/Toolchain/ToolchainStatusModal.tsx` L148；`src/components/Toolchain/GlobalToolchainPanel.tsx` L143；`src/features/managers/npm/scopes/global/Global.tsx` L662、L672；`src/features/managers/maven/MavenManagerPage.tsx` L680；`src/features/managers/extended/WorkspaceCommandSection.tsx` L74；`src/features/managers/extended/ExtendedEcosystems.tsx` L527｜触发：openPath/openFile 等 reject 时产生 unhandled rejection
- [ ] **D-15｜中｜渲染层静默吞错** — `src/features/search/Search.tsx` L433-434；`src/components/Package/PackageDetailModal.tsx` L87-92；`src/features/settings/Settings.tsx` L106-122；`src/features/managers/npm/scopes/project/Project.tsx` L239-241、L575-583；`src/features/managers/npm/scopes/global/Global.tsx` L365-367、L448-456；`src/hooks/useDependencyHealthReminder.ts` L36-37｜触发：包信息失败显示"未知"；批量卸载失败仅计数不暴露原因；扫描失败无提示

---

## E. 边界条件与空值处理

- [ ] **E-01｜中｜整行删除致数据丢失** — `electron/managers/groups/platform/swiftpmManifestEditor.ts` L32-44｜触发：`.package(...)` 与其它声明写在同一行时，删除依赖连带删除同行其它声明
- [ ] **E-02｜中｜非 JSON 响应/非法 pyproject/registry URL** — `electron/services/flutter.ts` L389；`electron/managers/search/pypiRegistry.ts` L63-76；`electron/managers/search/npmRegistry.ts` L35-38、L79-83｜触发：清单语法错误或 registry 无协议/含变量（`registry=registry.example.com`、`${NPM_REGISTRY}`）时抛 ERR_INVALID_URL 使搜索整体失败
- [ ] **E-03｜低｜semver 未包裹** — `electron/services/smartUpdate.ts` L71-73｜触发：`currentVersion` 为 `^1.2.3`/`workspace:*` 等非 semver 时 `semver.gt` 抛 Invalid Version（同函数 L57 同类比较在 try 内）
- [ ] **E-04｜低｜解码器只定型一次** — `electron/services/encoding.ts` L35-47｜触发：首块为 ASCII 后混入 GB18030 中文块时乱码（选择后不再重评估）
- [ ] **E-05｜中｜repository.url 可能 undefined** — `src/components/Package/PackageDetailModal.tsx` L214-227｜触发：包 `repository` 无 `url` 字段时点击"仓库"抛 TypeError
- [ ] **E-06｜低｜非空断言直接用于 URL/路由** — `src/components/Package/SecurityAuditModal.tsx` L203、L345；`src/components/Package/PackageDetailModal.tsx` L209；`src/features/managers/extended/ManagerDiagnosticsPanel.tsx` L88；`src/features/managers/maven/MavenManagerPage.tsx` L1098；`src/features/managers/extended/ExtendedManagerWorkspace.tsx` L323｜触发：字段为空时 JSX 内断言失败直接抛渲染错误（叠加 D-13 白屏）
- [ ] **E-07｜低｜外部解析结果当 any 使用** — `electron/services/project.ts` L139-142；`electron/services/publish.ts` L11、L28-55；`electron/services/npm.ts` L123-129｜触发：package.json 为数组/标量等异常形状时静默变 `{}`，状态判断失真
- [ ] **E-08｜低｜依赖树递归无环/深度防护** — `src/components/Package/DependencyTreeModal.tsx` L93-108、L110-153、L198-217｜触发：后端返回含环依赖图时递归爆栈；每次渲染全量重建树

---

## F. 类型安全

- [ ] **F-01｜高｜localStorage 反序列化未校验** — `src/features/managers/maven/MavenManagerPage.tsx` L81-87、L104-106、L125-127｜触发：`custom-maven-goals` 被写成非数组后进入页面，展开非可迭代对象→渲染期 TypeError→白屏（无错误边界）
- [ ] **F-02｜中｜`any` 高密度** — `src/features/managers/pip/PipManagerPage.tsx` 26 处；`src/features/managers/maven/MavenManagerPage.tsx` 21 处；`src/features/managers/npm/scopes/project/Project.tsx` 21 处（L65/L283/L473）；`src/features/managers/flutter/Flutter.tsx` 20 处；`src/features/settings/Settings.tsx` 16 处；`src/features/managers/cargo/Cargo.tsx` 14 处；`src/features/managers/npm/scopes/global/Global.tsx` 14 处；`src/features/search/Search.tsx` 13 处（L41/L134）；`src/pages/PluginComponents/PluginComponents.tsx` 24 处；`src/features/managers/npm/scopes/publish/Publish.tsx` L10/L15｜触发：IPC 返回体、表单值、表格 render 全被抹平，字段变更编译期不可发现
- [ ] **F-03｜低｜本地化包装 `as any`** — `src/utils/localizedFeedback.ts` L28-34、L46-54｜触发：antd 方法签名被断言绕过

---

## G. 代码质量隐患

- [ ] **G-01｜中｜超长文件/单组件** — `src/features/search/Search.tsx` 1303 行（组件 114-1032）；`src/features/managers/npm/scopes/project/Project.tsx` 1253 行（`ProjectPage` 42-1177，约 1136 行单函数）；`src/features/managers/pip/PipManagerPage.tsx` 1202 行；`src/features/managers/flutter/Flutter.tsx` 1163 行；`src/features/managers/maven/MavenManagerPage.tsx` 1107 行；`src/pages/PluginComponents/PluginComponents.tsx` 987 行；`src/features/settings/Settings.tsx` 954 行；`src/features/managers/npm/scopes/global/Global.tsx` 896 行｜均超 600 行/单函数 150 行阈值
- [ ] **G-02｜中｜高重复逻辑** — `src/features/managers/npm/scopes/project/Project.tsx` ↔ `src/features/managers/npm/scopes/global/Global.tsx`：`handleViewChangelog` 656-677↔480-501、`executeUpdate` 220-261↔346-387、`handleUninstallSelected` 556-605↔429-478、`loadPackageOptions/loadMorePackageOptions/loadInstallVersions` 379-447↔198-266、文件底部 8 个同名工具函数 1181-1252↔822-896（`renderPagedPopup` 1241-1252 与 885-896 逐行一致）｜同逻辑三份（`Search.tsx` L413-437 为第三份 changelog 处理）
- [ ] **G-03｜中｜废弃 antd API** — `Alert message=`（deprecated→title）：`PipManagerPage.tsx` L1076、`ManagerDiagnosticsPanel.tsx` L127、`ExtendedManagerWorkspace.tsx` L331/L399/L503、`Publish.tsx` L386、`MavenManagerPage.tsx` L973/L1044、`Flutter.tsx` L1087、`DependencyHealthModal.tsx` L221；`Select.Option`（19 处）：`Settings.tsx` L907-915、`Publish.tsx` L337-356、`Project.tsx` L1092-1099、`MavenManagerPage.tsx` L877-880；`onDropdownVisibleChange`：`PipManagerPage.tsx` L1051、`Publish.tsx` L369；`Collapse.Panel`：`PackageDetailModal.tsx` L260-292｜依据 antd 6.4.2 类型定义 `@deprecated` 标注；同仓写法自相矛盾（`Native.tsx` L392 用新 API）
- [ ] **G-04｜中｜无效 memo/渲染期重计算** — `src/features/search/Search.tsx` L469-504、L506-796；`src/components/Package/DependencyTreeModal.tsx` L198-208｜触发：依赖数组含每次渲染新建的函数，列定义每次重建；搜索框每次输入重跑全量树构建
- [ ] **G-05｜中｜直接改写 React 管理的 DOM** — `src/components/Localization/RuntimeLocalizer.tsx` L15-77、L82-116、L136-176（配合 `src/i18n.ts` L50-54）｜触发：MutationObserver 对 body 全量观察并 `textContent=`/`setAttribute` 改写，与 React 协调冲突风险 + 全局性能开销
- [ ] **G-06｜中｜副作用重放/无清理定时器** — `src/components/Notification/NotificationContainer.tsx` L13-25；`src/stores/appStore.ts` L48-52｜触发：通知变化时全部历史通知重新 push；store 内 setTimeout 无引用无清理（双路径 duration）
- [ ] **G-07｜低｜相对路径静态资源** — `src/components/Layout/MainLayout.tsx` L141-151｜触发：`src="../../../icon.jpg"` 在打包产物中不可靠
- [ ] **G-08｜低｜无挂载守卫的异步 setState** — `src/components/Toolchain/ToolchainStatusModal.tsx` L18-43；`src/hooks/useDependencyHealthReminder.ts` L25-41｜触发：卸载/竞态时 setState（常驻组件风险有限）

---

## H. 依赖、配置与 CI/CD

- [ ] **H-01｜高｜发布门禁形同虚设** — `.github/workflows/release-gates.yml` L24-35｜触发：证据目录缺失（新 checkout 必为空）时走 `--optional`，脚本以 0 退出（`scripts/verify-release-signature.mjs` L56-58/L74-76、`scripts/verify-release-integrity.mjs` L115-117、`scripts/verify-release-trust.mjs` L46-50）
- [ ] **H-02｜高｜产物无签名/公证/哈希校验** — `package.json` L122-153；`.github/workflows/platform-build.yml` L31-41｜触发：无 `certificateFile/hardenedRuntime/notarize/afterSign`；installer/portable 均 `No signature found`
- [ ] **H-03｜中｜CSP 含 `unsafe-inline`，无 object-src/base-uri** — `index.html` L6｜触发：出现 HTML 注入点时内联脚本不受 CSP 阻止
- [ ] **H-04｜中｜PR CI 对 node_modules 二进制 setuid root** — `.github/workflows/quality.yml` L4、L29-36｜触发：任何 PR 改动依赖后即对 `node_modules/electron/dist/chrome-sandbox` 赋权并执行
- [ ] **H-05｜中｜workflow 均未声明 `permissions:`** — `.github/workflows/release-gates.yml` L1-10；`.github/workflows/quality.yml` L1-16；`.github/workflows/platform-build.yml` L1-22；`.github/workflows/cli-integration.yml` L1-10｜触发：仓库默认令牌权限下，任何步骤（含三方 postinstall）持有超只读权限
- [ ] **H-06｜中｜校验脚本忽略 blocked 证据** — `scripts/verify-release-signature.mjs` L52-58、L74-76｜触发：信封 HMAC 正确但来源报告 blocked/缺失时退出码 0
- [ ] **H-07｜中｜证据链自证、无独立信任锚** — `scripts/verify-release-integrity.mjs` L7-10、L184-204；`electron/services/releaseProvenanceAttestation.ts` L304-306；`.gitignore` L9｜触发：同环境替换产物并重新导出 bundle/provenance 即可通过
- [ ] **H-08｜中｜发布脚本无校验/校验和产出** — `scripts/release.js` L18-31｜触发：`npm run release` 直接 build + 写 RELEASE_NOTES，不产出 SHA256SUMS、不调用 verify
- [ ] **H-09｜低｜.gitignore 密钥模式不完整** — `.gitignore` L25-28｜触发：新增 `.env.production`/`.npmrc`/`*.p12`/`*.pfx`/`*.pem`/`id_rsa*` 会被跟踪（`.env.*.local` 仅匹配 `.local`）
- [ ] **H-10｜低｜依赖宽松区间/类型与运行时不自洽** — `package.json` L72-100、L168-170｜触发：全 `^` 区间；`@types/node@^25.8.0` 与 `engines.node>=22.12.0`（CI 用 node 22）不一致
- [ ] **H-11｜低｜无依赖漏洞门禁/无 dependabot；生命周期脚本默认执行** — `.github/workflows/quality.yml` L22；`.github/workflows/cli-integration.yml` L17；无 `.npmrc`｜触发：4 个 workflow 无 `npm audit`；`npm ci` 执行全部 postinstall
- [ ] **H-12｜低｜安装器可写的启动期配置** — `build/installer.nsh` L1-13；`electron/main.ts` L2192-2194｜触发：`resources/default-language.json` 被低权限进程改写后下次启动读取
- [ ] **H-13｜低｜afterPack 删除官方运行时文件** — `scripts/electron-builder-after-pack.js` L6-12、L78-90｜触发：删除 vulkan/swiftshader/dxcompiler 等 DLL，GPU 回退路径被移除且无校验记录
- [ ] **H-14｜信息｜依赖已知漏洞核实结果** — `package-lock.json`（antd 6.4.2 L2708 / electron 42.11.4 L3749 / esbuild 0.28.2 L4016 / fast-xml-parser 5.11.0 L4149 / react-dom 19.2.6 L5954 / semver 7.8.0 L6244 / vite 8.3.0 L6813 / yaml 2.9.0 L7171）｜公开检索命中：fast-xml-parser CVE-2026-26278（影响 4.1.3–5.3.5）、CVE-2026-25128（影响 5.0.9–5.3.3）——当前锁定 5.11.0 **未命中**；Vite CVE-2025-30208/31125 仅影响旧版 dev server，当前 8.3.0 未命中。**其余依赖未能通过公开检索确认命中版本，需人工以官方公告/npm audit 复核**

---

## 附一、审查中确认"防御已存在"的区域（未列为问题）

- `electron/services/externalUrl.ts`：协议白名单（仅 http/https/mailto）
- `electron/services/commandRunner.ts`：Windows cmd 转义（拒绝换行/双引号，`%` 分段转义）
- `electron/main.ts` L479-483：`contextIsolation:true` + `nodeIntegration:false`，未关闭 `webSecurity`
- `electron/services/operationHistory.ts`：stdout/stderr/error 截断与 2MB 轮转
- `electron/services/registryHttp.ts`：20s 超时；`registryReachability.ts`：3s AbortController
- `electron/services/releaseSignature.ts`：HMAC-SHA256（非 SHA1）
- 渲染层：`dangerouslySetInnerHTML` 0 处、`eval/new Function` 0 处、`@ts-ignore/@ts-expect-error` 0 处
- `package.json`：`asar:true`；`files/extraResources` 未包含 `.env`/`.npmrc`/密钥/日志
- 无 `autoUpdater/setFeedURL`（不存在 http 更新源）

## 附二、已人工二次复核的条目

- A-03 / A-14 / A-15（shellGuard 黑名单缺陷属实，`shellGuard.ts` L10-14 全量核对）
- A-22（base64 回退属实，`credentialVault.ts` L11-24 全量核对）
- B-03（tmp 写入在 try 之外属实，`atomicWrite.ts` L10-21 全量核对）
- D-01（`runToolCapture` catch 转返回值属实，`dependencyHealth.ts` L682-699 全量核对）
- A-02 / A-09（IPC 入口无路径校验属实，`electron/main.ts` L682-684、L823-825 复核）
