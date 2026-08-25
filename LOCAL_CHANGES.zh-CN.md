# 9Router 本地变更说明

本文档记录 `fix/commandcode-vision` 分支相对上游
`decolua/9router@699edac3`（v0.5.55）的本地改动，便于后续同步上游、排查回归或按提交移植。

## 提交概览

| 提交 | 类型 | 说明 |
| --- | --- | --- |
| `40897527` | 修复 | 保留 OpenAI 请求中的图片内容块并转发给 CommandCode |
| `d85f670c` | 功能 | 补充 CommandCode 模型能力、思考档位转发和请求诊断 |
| `885b00e0` | 构建 | 隔离 Next.js 生产构建与本地运行状态，降低构建 OOM 风险 |
| `1b412d17` | 修复 | 将请求配置和响应证据真正写入请求详情存储 |
| 当前补丁 | 功能 | 固化 CommandCode Go 全量模型及逐模型能力、推理档位 |

## 40897527：保留图片内容块

### 问题

OpenAI 格式请求转换为 CommandCode 格式时，图片会被替换成
`[image omitted]`，导致上游模型收不到实际图像。

### 实现

- 解析 `data:` URI，将 MIME 类型和 Base64 数据转换成 CommandCode 图片源。
- 保留远程图片 URL。
- 对已经带有 `source` 的图片块直接透传。
- 将原先标记为已知失败的图片测试改为正常断言。

### 主要文件

- `open-sse/translator/request/openai-to-commandcode.js`
- `tests/translator/bugs-gemini-cursor-commandcode.test.js`

### 影响

仅改变 OpenAI 到 CommandCode 的图片输入转换；纯文本请求行为不变。

## d85f670c：能力元数据、思考档位和诊断证据

### 问题

CommandCode 的 DeepSeek 模型缺少可供 Hermes 等客户端读取的上下文、输出、输入格式和
思考档位元数据。即使客户端发送了思考强度，原转换器也不会将其稳定地转成
CommandCode 的 `reasoning_effort`，调用详情中也无法判断参数是被转发、归一化还是丢失。

### 实现

1. 模型能力元数据

   - 为 `deepseek/deepseek-v4-pro` 和 `deepseek/deepseek-v4-flash` 声明视觉、思考、
     `1,000,000` 上下文和 `384,000` 最大输出能力。
   - 新增 CommandCode 思考格式，公开 `low`、`medium`、`high`、`max` 四档。
   - `/v1/models` 同时输出 `context_length`、`max_completion_tokens`、
     `max_output_tokens`、输入/输出模态、支持参数和思考档位，兼容不同客户端的读取方式。

2. 请求转换

   - 接受 OpenAI `reasoning_effort`、对象形式 `reasoning.effort` 和模型名思考后缀。
   - 将 `minimal` 映射为 `low`，将 `xhigh`、`ultra` 映射为 `max`；原生四档保持不变。
   - 移除模型名上的思考后缀后再转发，避免把本地控制后缀当成上游模型名。
   - 无效或明确关闭的思考参数不注入上游请求。
   - 保留无法解析的工具参数原文，避免静默变成空对象。

3. 请求诊断

   - 分别摘要记录收到的请求和实际转发请求，包括模型、流式开关、思考字段与档位、
     最大 Token、消息数、工具数、输入格式和图片数。
   - 标记思考参数是 `forwarded`、`normalized`、`stripped`、`injected`、`omitted`
     还是使用提供商默认值。
   - 只保存配置摘要，不保存消息正文。
   - 请求和响应日志中的授权、Cookie、Token、Secret 等敏感请求头统一替换为
     `[REDACTED]`。
   - 调用详情 API 和面板显示 Request Configuration 与 Response Evidence。

4. 兼容修复

   - 保留 Gemini system prompt。
   - 保留 CommandCode 中格式异常但仍有诊断价值的工具参数。

### 主要文件

- `open-sse/providers/capabilities.js`
- `open-sse/providers/thinkingLevels.js`
- `open-sse/translator/request/openai-to-commandcode.js`
- `open-sse/utils/requestDiagnostics.js`
- `open-sse/utils/requestLogger.js`
- `open-sse/handlers/chatCore.js`
- `open-sse/handlers/chatCore/requestDetail.js`
- `src/app/api/v1/models/route.js`
- `src/app/api/usage/request-details/route.js`
- `src/app/(dashboard)/dashboard/usage/components/RequestDetailsTab.js`

### 影响

客户端现在可以发现 CommandCode 模型能力并选择思考档位；请求详情可以证明 9Router
实际收到了什么、向上游转发了什么。能力数值来自当前 CommandCode 路由的实测约束，
上游模型规格变化时应重新核验。

## 885b00e0：隔离 Next.js 生产构建

### 问题

生产构建会读取当前用户的 9Router 运行目录和数据库，并在静态页面生成阶段占用大量
内存。此前完整构建分别在 4 GB 和 8 GB Node heap 上限处 OOM，但没有出现代码编译错误。

### 实现

- 将 `next`、`@next/third-parties` 和 `eslint-config-next` 对齐到锁文件已有的
  `16.3.2`，避免同一构建中混用 Next 版本。
- 启用 Next.js webpack 内存优化。
- 用 Node 标准库脚本创建临时 HOME/AppData 后执行 `next build --webpack`。
- 无论构建成功或失败都清理临时目录，且不接触正在运行的本地实例数据。

### 主要文件

- `next.config.mjs`
- `package.json`
- `scripts/build-next.mjs`

### 影响

`npm run build` 的入口不变，但构建过程不再依赖用户真实 HOME 中的 9Router 状态。
完整生产构建已成功生成 135 个路由。

## 1b412d17：持久化请求诊断摘要

### 问题

请求链路已经生成 `requestFlow` 和 `responseConfig`，但写入数据库前的字段白名单没有
包含它们。面板读取历史请求时因此显示空值，看不到实际思考档位是否被转发。

### 实现

- 将记录组装集中到现有请求详情仓库内的 `buildStoredRecord`。
- 将 `requestFlow` 和 `responseConfig` 纳入存储记录，同时保留原有字段截断和请求头脱敏。
- 增加回归测试，直接断言两个诊断字段不会在落库前丢失。

### 主要文件

- `src/lib/db/repos/requestDetailsRepo.js`
- `tests/unit/request-diagnostics.test.js`

### 影响

新产生的请求详情会持久保存诊断摘要。旧记录若未保存这些字段，只能由仍存在的脱敏前
请求数据临时推导，不能凭空恢复历史上游请求。

## 当前补丁：CommandCode Go 模型目录

- 固化官网当前 Go 目录的 37 个模型，包括新增的 Ling 3.0 Flash Free。
- `contextWindow`、视觉和推理能力与 CommandCode 模型页服务端数据逐项校验。
- 官网公开的推理档位按模型返回；未公开档位的推理模型保守返回
  `low`、`medium`、`high`。
- DeepSeek V4 按原生接口返回 `low`、`high`、`max`，并将外部传入的
  `medium` 兼容映射为 `high`。
- `/v1/models` 同时返回顶层 `reasoning_efforts` 和嵌套
  `reasoning.supported_efforts`；`none` 只表示关闭思考，不作为强度返回。
- 此节覆盖上文 `d85f670c` 中仅针对两个 DeepSeek 模型和通用四档的旧说明。

## 验证记录

2026-08-24 在 Windows 本地环境完成以下验证：

- 针对性 Vitest：4 个测试文件通过，`32 passed`，`2 expected fail`。
- Next.js 生产构建：成功生成 135 个路由。
- 本机 Hermes 到本机 9Router 真实调用：`high` 和 `max` 请求均返回成功；请求详情中的
  `received.reasoning.effort` 与 `forwarded.reasoning.effort` 一致，并标记为
  `forwarded`。

针对性测试命令：

```bash
npx vitest run --config tests/vitest.config.js \
  tests/unit/request-diagnostics.test.js \
  tests/unit/openai-to-commandcode.test.js \
  tests/unit/capabilities.test.js \
  tests/translator/bugs-gemini-cursor-commandcode.test.js
```

## 后续同步上游

同步新的上游版本时，建议按上述四个提交分别检查冲突。若上游已原生支持某一能力，优先
删除对应本地补丁并采用上游实现；不要长期维护两套并行逻辑。
