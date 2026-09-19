# 第三轮全项目审查报告（2026-09-18 下午）

范围与方法：全项目第三轮独立排查。4 个并行只读审查代理分别覆盖：①上轮 24 项修复的 diff 回归审查；②前两轮盲区（shared/、preload、打包配置、门禁脚本）；③清单解析器深挖（maven/native/conan/pip/cargo 等）；④src 剩余区域（domain、生态页、health、search、路由）。所有发现均经 file:line 人工抽查核实后才修复。

## 修复清单（19 项已全部修复）

### 上轮修复的残留问题（回归审查发现）
| 编号 | 严重度 | 问题 | 修复 |
|---|---|---|---|
| R1-1 | 高 | `commandRunner.ts` formatCmdArg 嵌入 `"` 用 `\"` 转义无效——cmd 不把 `\` 当转义符，参数可逃逸出引号（注入残留） | 嵌入 `"` 直接 throw（与换行同策略；Windows 文件名不可能含 `"`） |
| R1-2 | 高 | `Project.tsx` watcher stale 分支调用无参 `stop()` 会 `unwatchAll`，误杀新路径的 watcher | 改用 `stop(path)` 精确清除（main 侧本就支持） |
| R1-3 | 中 | `system.ts` 接入 runLoggedCommand 但未传 timeoutMs，system:update-npm 仍可永久挂起 | run() 增加 timeoutMs（默认 120s，updateNpm/clearCache 300s） |
| R1-4 | 中 | `commandMutatesProjectFiles` 动词表缺 `apply/destroy/rollback/deploy/up/down/cache`，`terraform apply`、`deno cache --reload` 仍绕过写队列与备份 | 补齐动词表（\b 边界；over-classification 为安全偏置，已注释） |
| R1-5 | 低 | `packageStore.mutating` 无消费方，安装 Modal 可重复提交 | Project/Global 安装 Modal 提交按钮接入 `disabled={mutating || loading}` |

### 前两轮盲区
| 编号 | 严重度 | 问题 | 修复 |
|---|---|---|---|
| R2-1 | P1 | 无单实例锁：双开实例时进程内互斥（vault 队列、projectMutation）全部失效，并发写静默丢数据 | `requestSingleInstanceLock` + second-instance 聚焦；清理抽为幂等函数，`closed` 与 `will-quit` 双挂载 |
| R2-2 | P2 | `verify-packaged-smoke.mjs` 恒真：进程存活 5 秒即 passed，白屏启动照样绿灯 | 重写为 CDP 探测：等待 DevTools `/json/list` 出现 page target（30s 超时判 blocked） |

### 清单解析器深挖
| 编号 | 严重度 | 问题 | 修复 |
|---|---|---|---|
| R3-1 | P1 | `maven.ts` upsertSettingsBlock 惰性正则可跨 `</mirror><mirror>` 边界，更新第二个 mirror 吞掉前面的条目（settings.xml 数据丢失） | 重写为逐块 matchAll，按含目标 `<id>` 块的精确 span 替换 |
| R3-2 | P1 | `native.ts` vcpkg.json 带 BOM 或语法错误时回退 stub 后被 writeFile 整体覆盖（用户清单全丢） | 解析前去 BOM；文件存在但解析失败时 throw，禁止回退写入 |
| R3-3 | P2 | `native.ts` conanfile.txt 写回 join('\n') 破坏 CRLF（B13 同型漏修点） | 抽出 `textLineEndings.ts` 共享工具，flutter/gradle/native 统一使用 |
| R3-4 | P2 | `pip.ts` 版本排序把 `2.0.0rc1` 排在 `2.0.0` 之上（预发布被当最新） | 手写 PEP440 风格比较（release 逐段数值、pre 在前），无新依赖 |

### src 剩余区域
| 编号 | 严重度 | 问题 | 修复 |
|---|---|---|---|
| R4-1 | P1 | `ExtendedEcosystems.tsx` lastBackup 切换项目不重置，"恢复备份"把 A 项目备份写入 B 项目 | 备份记录来源路径；path 变更时清空；恢复前校验，不匹配报错中止（新增 i18n key） |
| R4-2 | P1 | `WorkflowSectionNav` `<a href="#id">` 在 HashRouter 下击穿路由，内容区空白 | 改 button + scrollIntoView；路由加 `path="*"` 兜底重定向 /workspace |
| R4-3 | P2 | 六个生态页（maven/cargo/flutter/gradle/go/pip）currentPath 切换竞态，旧 list() 响应覆盖新项目（可致误升级/误删除） | 接入序号失效守卫（loadEpochRef / effect 内 bump 模式） |
| R4-4 | P2 | `appStore` persist 损坏无校验，recentPaths/currentPath 异常时首屏白屏 | 仿 packageStore 加 merge 守卫 |
| R4-5 | P2 | `Search.tsx` 两处竞态：切 searchType 旧响应写错列集；pip 详情连开慢者覆盖 | runSearch/pipDetail 加序号防护，打开时清旧数据 |
| R4-6 | P3 | `ExtendedEcosystems` detections/dependencies 共用 setLoading，先完成者提前解除 | 拆为独立 loading，派生合并值 |

## 审查中发现并否决的修复方案（重要）
- **preload 统一 unwrap `managers.execute/runCustom`**：实施后 `verify:ipc` 红灯暴露真问题——contextBridge 跨界抛出的 Error 会**丢失自定义属性**，`error.restore`/`error.backup` 到不了渲染层（`managerExecution.ts:70` 依赖它拼恢复提示）。已回退为"返回原始封套 + 渲染层 managerCommands 手工解包"，并在 preload 留注释说明原因。verify:ipc 断言恢复封套语义。

## 最终门禁（9/9 绿灯）
typecheck ✅、build ✅、test ✅、verify:core ✅、verify:hardening ✅、verify:ipc ✅、verify:manager-contracts ✅、verify:i18n ✅、verify:engineering-debt ✅（基线按实际值上调 11 个文件 2–24 行，均为修复必要增长，总债未增长）。

## 已知限制与遗留（不修，明确记录）
1. 混合行尾文件仍被归一（仅保证纯 CRLF/LF 文件不被改写）。
2. ToolName 三处平行定义漂移（preload/global.d.ts/服务端），建议后续统一 import shared——契约重构，单独处理。
3. `electron-builder-after-pack.js` 删除 SwiftShader：无 GPU 驱动机器失去软件渲染回退——产品决策项。
4. poetry 多约束依赖显示为 `*`；cargo target 级 dev/build-dependencies 漏报。
5. `mutating` 还有 4 处确认类弹窗未接入（卸载/批量/版本切换）。
6. 工作树仍混有此前遗留的未提交 i18n/重构改动，提交时务必与本轮修复分开。
