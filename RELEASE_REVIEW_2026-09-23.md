# v1.1.0 发布前审核（2026-09-23）

审核当前工作树与 v1.0.3 之后的功能，重点检查主进程写入/备份、命令生成、AI 服务商凭据、SwiftPM 编辑、渲染层异步状态、工程门禁与发布流程。采用源代码检查、回归测试及 Windows 打包烟测；不声称逐条执行所有生态的真实 CLI 或证明不存在缺陷。既有未提交修复一并验证、保留。

## 本轮发现并修复

| 级别 | 问题与影响 | 修复与验证 |
| --- | --- | --- |
| P1 | 写队列 60 秒超时覆盖正在执行的任务，等待者超时可能提前释放队列 | 等待结果与串行尾链分离，开始执行时清除等待定时器；假时钟覆盖长任务、超时等待者、后续写入、失败与重入 |
| P1 | R/Julia 模板仍直接拼接输入；旧报告所称转义仅定义未使用 | 实际模板接入独立转义模块，Julia 额外转义美元插值；直接验证服务生成的命令计划 |
| P1 | AI 连接探测默认跟随重定向，非标准 API Key 请求头可能发送到另一站点 | 探测拒绝重定向；请求参数回归测试 |
| P1 | npm 发布检查返回时已切换目录，旧项目结果可能用于新项目 | 请求代次校验、切换清空清单和表单、写入期间禁用目录切换；React hook 异步回归测试 |
| P2 | SwiftPM 缺少 dependencies 时插到 name 前，产生无效参数顺序；注释干扰结构扫描 | 按 Package 参数顺序插入、屏蔽注释与字符串、复用原子写入；复杂语法明确拒绝，覆盖无 targets 与行尾注释 |
| P2 | Azure OpenAI 使用 Bearer API Key 和 deployment/models 探测，配置正确仍失败 | 改为资源级 models 地址及 api-key 请求头，补测试 |
| P2 | 非 UTF-8 且不含 NUL 的清单仍可被备份转换损坏 | 检测 UTF-8 有效性，二进制与非 UTF-8 内容按 base64 无损往返，补字节级测试 |
| P2 | Windows 终端路径仍进入 cmd 源码并受百分号变量展开影响 | 通过 spawn cwd 选择目录，cmd /D /K 不含用户路径 |
| P2 | 基线更新脚本以 Math.max 自动接受新增工程债务 | 改为只收紧限制，超限拒绝写入；执行后工程门禁通过 |

历史 `BUG_REVIEW_ROUND6_2026-09-22.md` 已标记部分结论被本次复核纠正。

## 验证证据

- Renderer + Electron TypeScript 检查通过。
- Vitest：完整回归 26 文件 / 88 用例通过；之后增加的实际解释器命令计划回归 1 文件 / 1 用例通过（合计 89）。
- 构建脚本测试：5/5 通过。
- 完整 framework runner：16 组全部通过；包含 legacy 667 项检查、AI 116 项、hardening 68 项、core 33 项及各生态专项。
- 国际化：1027 个双语键一致；硬编码 CJK 门禁通过。
- 工程债务门禁：356 个生产 TypeScript 文件通过；本轮仅收紧基线。
- `npm audit --omit=dev --audit-level=high`：0 个已知生产依赖漏洞。
- Windows x64 安装版/便携版构建成功；打包 GUI 烟测确认 index.html 页面启动。Electron IPC 验证通过。
- 已跟踪文本的常见 GitHub token/私钥标记扫描未发现匹配（并非完整秘密检测证明）。

## 跨平台 CI 复核

首次远端 Windows CI 通过，Linux 在 hardening 的 cmd.exe 断言失败。根因是验证脚本对所有平台都要求 Windows 包装；生产代码只在 Windows 包装 .cmd/.bat，行为正确。验证已按平台检查：Windows 保留完整转义/真实 spawn 测试，非 Windows 检查命令及 argv 不经 cmd.exe 改写。修复后本地 hardening 68 项通过，提交后重跑双平台 CI。Linux 后续已通过框架门禁，但 IPC fixture 遇到 runner 的 /dev/shm 权限限制；Linux fixture 启动时传入 --no-sandbox / --disable-dev-shm-usage（原先在主脚本 appendSwitch 晚于 zygote 初始化），使用临时目录共享内存；该测试仅验证隔离 preload 的 IPC 数据，不证明 Linux OS sandbox 安全性。以上修复仅涉及验证脚本与报告，不改变已构建的应用代码。

## 发布范围与限制

- 发布 Windows x64 安装版、便携版、SHA-256 校验文件；本轮没有构建或实机验证 macOS/Linux 发行包。
- Windows 产物为未签名（Authenticode: NotSigned）；校验值用于核对下载内容，不代表代码签名或来源证明。
- SwiftPM 仅做清单编辑与适配器回归，未使用真实 Swift 编译器验证；计算式依赖、原始/多行字符串、嵌套注释等复杂清单要求手工编辑。
- 仍有 6 个既有超长文件、76 个超长函数、634 个显式 any。较大文件包括 extendedManager.ts（3051 行）、readinessGate.ts（3353 行）、workspaceGovernance.ts（3770 行）、global.d.ts（5848 行）。这些是应后续治理的存量债务，不因本轮发布被视为符合 1500/100 行规范。
- 本地助手新增记忆文件不提交；已跟踪的历史助手文件不在本轮移除。
