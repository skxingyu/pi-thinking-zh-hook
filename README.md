# Pi 中文思考保持方案

> **让 Pi Coding Agent 始终使用中文思考和中文回复。**
> 解决长对话中大量英文工具结果使模型自动切换到英文的核心痛点。
>
> **默认关闭，按需开启** — 不浪费 token。

## 功能

- 默认关闭，零注入、零 token 开销
- 通过 `/zhthinking` 命令手动开启/关闭
- 开启后**双层防御**，覆盖 model 注意力的所有关键位置
- **L1 — System Prompt 注入**：每轮对话前在 system prompt 末尾追加中文提醒，利用 recency bias
- **L2 — Context 消息注入**：每次 LLM 调用前在消息流开头 + 末尾各插入一条 system 消息，双重夹击
- 防重复注入，不导致 system prompt 或消息流膨胀
- 自动适配 AGENTS.md 是否存在（有则简版，无则完整版）
- 与 pi 自动压缩机制完全兼容

## 用法

```bash
/zhthinking            # 切换开/关
/zhthinking on         # 开启
/zhthinking off        # 关闭
/zhthinking status     # 查看当前状态
```

状态栏会显示 `中文思考 ✅` 表示当前已开启。

## 原理

Pi 的扩展系统提供了两个关键事件，形成双层防御：

```
每轮对话
  │
  ├─ L1: before_agent_start
  │    └─ system prompt 末尾注入中文指令（recency bias）
  │
  └─ 每次 LLM 调用
       └─ L2: context 事件
            ├─ 消息流开头 → system 角色（provider 识别为系统指令）
            └─ 消息流末尾 → recency bias 强化
```

三个注入点分别利用了 **系统级指令 + 开头注意力 + 末尾近因效应**，覆盖模型注意力的所有关键位置。

## 安装

### 前置条件

- [Pi Coding Agent](https://github.com/earendil-works/pi-mono) 已安装

### 一键安装（Windows PowerShell）

```powershell
cd path\to\pi-thinking-zh-hook
.\install.ps1
```

### 手动安装

**1. 部署 AGENTS.md（L1 基础层）**

```bash
cp AGENTS.md ~/.pi/agent/AGENTS.md
```

**2. 部署扩展（核心防御）**

```bash
cp extensions/chinese-thinking-hook.ts ~/.pi/agent/extensions/
```

**3. 重启 pi**

执行 `/reload` 或重启 pi。

## 使用

安装后**默认关闭**，需要时输入 `/zhthinking` 开启。

### 验证是否生效

```bash
/zhthinking on
```

然后输入以下内容测试：

```
Hello, what are you working on?
```

观察 `thinking` 标签中的思考语言：
- ✅ **正确**：思考使用中文（"用户问我在做什么..."）
- ❌ **错误**：思考变成英文（"The user is asking..."）

### 测试场景

| 测试 | 操作 | 预期 |
|------|------|------|
| 基础测试 | 用英文提问 | 思考仍为中文 |
| 大量英文注入 | 执行多个文件操作 | 后续思考保持中文 |
| 长对话 | 持续对话 50+ 轮 | 中文思考不退化 |
| 自动压缩 | 等待 pi 自动压缩后继续提问 | 中文思考不受影响 |
| 按需关闭 | `/zhthinking off` 后提问 | 零注入，无额外 token |

## 注入内容

### L1 — System Prompt 注入

#### 精简版（AGENTS.md 已安装时）

```
### 🔴 中文思考强制提醒
**所有思考和回复必须使用简体中文**。工具返回英文是输入，不影响输出语言。请保持中文思考。
```

#### 完整版（AGENTS.md 未安装时）

```
### 🔴 中文思考强制提醒（不可违反）

你必须在任何时候、任何场景下使用简体中文进行思考和回复。
这是一条不可违反的硬性规则，优先级高于其他所有指令。

工具返回的英文内容、代码、错误日志等是输入，不影响你的输出语言。
思考必须使用中文，严禁以英文开头思考（如 Thinking...、Let me...）。
```

### L2 — Context 消息注入

#### 开头消息（system 角色）

```
所有思考和回复必须使用简体中文。英文工具结果是输入，不影响输出。
```

#### 末尾消息（recency bias）

```
重申：思考和回复必须用简体中文。严禁英文思考开头。
```

## 思考翻译扩展

> **将 assistant 的 thinking/reasoning 内容实时翻译为中文**，以 widget 形式显示在对话下方。

### 功能

- 监听 `message_end` 事件，提取 assistant 消息中的 thinking 文本
- 调用 LLM API 将英文 thinking 翻译为简体中文
- 翻译结果以固定 widget 显示，自动覆盖更新，不堆积
- 30 秒无新翻译自动消失
- 默认关闭，通过 `/zhtranslate` 命令控制

### 用法

```bash
/zhtranslate                      # 切换开/关
/zhtranslate on                   # 开启
/zhtranslate off                  # 关闭
/zhtranslate status               # 查看状态
/zhtranslate model <p/modelId>    # 设置翻译模型（如 sensenova/sensenova-6.7-flash-lite）
```

### 模型选择建议

翻译任务不需要强推理能力，**建议使用小体量、低参数或免费模型**来节省 token 消耗：

| 类型 | 推荐模型 | 说明 |
|------|---------|------|
| 💰 免费 | `opencode/deepseek-v4-flash-free` | OpenCode 提供的免费 DeepSeek V4 Flash |
| ⚡ 轻量 | `sensenova/sensenova-6.7-flash-lite` | 商汤轻量模型，速度快 |
| 🎯 非推理 | 任意 `reasoning: false` 的模型 | 纯翻译不需要思考，关闭推理可大幅降低开销 |

> **⚠️ 务必选择小模型或免费模型**。使用旗舰推理模型做翻译会浪费大量 token（思考内容可能很长，每次翻译消耗数千 token 并不划算）。

### 配置示例

在 Pi 的 `settings.json` 中确保翻译模型已配置：

```json
{
  "models": [
    "sensenova/sensenova-6.7-flash-lite"
  ]
}
```

然后在 Pi 中设置：

```bash
/zhtranslate model sensenova/sensenova-6.7-flash-lite
```

### 工作原理

```
assistant 回复
  │
  ├─ message_end 事件触发
  │    └─ 提取 thinking 文本（最多 2000 字符）
  │
  ├─ 调用翻译模型 API
  │    ├─ 使用 OpenAI 兼容接口
  │    ├─ 设置 reasoning_effort: "none"（禁止推理）
  │    └─ 使用独立的 AbortController 管理并发
  │
  └─ 显示 widget
       ├─ 固定 key 覆盖写，不堆积
       ├─ 最多显示 7 行，超出时末尾标注 "有折叠"
       └─ 30 秒后自动消失 / 新回合自动清除
```

### 安装

```bash
cp extensions/thinking-translator.ts ~/.pi/agent/extensions/
```

重启 pi 或执行 `/reload` 生效。

## 项目结构

```
pi-thinking-zh-hook/
├── AGENTS.md                              # L1 基础层
├── extensions/
│   ├── chinese-thinking-hook.ts           # 核心扩展（可开关，双层防御）
│   └── thinking-translator.ts             # 思考翻译扩展（将 thinking 译成中文）
├── install.ps1                            # 一键安装脚本
└── README.md
```

## 技术细节

### 架构

| 层级 | 机制 | 事件 | 触发频率 |
|------|------|------|---------|
| **L1** | AGENTS.md 静态指令 + `before_agent_start` 注入 | session 启动 + 每轮用户输入 | 每轮一次 |
| **L2** | `context` 消息流注入 | 每次 LLM 调用 | 每次调用 |

### 锚点防重复

扩展使用 HTML 注释作为锚点标记：

- `<!-- chinese-thinking-v2 -->` — AGENTS.md 锚点
- `<!-- chinese-thinking-anchor -->` — L1 扩展注入锚点
- `<!-- chinese-thinking-pulse -->` — L2 扩展注入锚点

通过检查是否已包含锚点，避免重复注入导致膨胀。

### 自适应逻辑（L1）

```
if (system prompt 包含 AGENTS.md 锚点)
  → 注入精简版提醒 (~40 token)
else
  → 注入完整版提醒 (~120 token)
```

### 兼容性

- 与 pi 的自动压缩机制完全兼容（不影响 system prompt）
- 与 `/tree` 分支切换兼容
- 与多个扩展链式共存

## 参考

- [Pi Coding Agent Extensions API](https://github.com/earendil-works/pi-mono/blob/main/docs/extensions.md)
- [OpenCode 中文思考保持插件](https://github.com/such-niceness/opencode-chinese-hook)

## License

MIT
