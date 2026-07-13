# Pi 中文思考保持方案

> **让 Pi Coding Agent 始终使用中文思考和中文回复。**  
> 解决长对话中大量英文工具结果使模型自动切换到英文的核心痛点。

---

## 功能

- 在每次 agent 启动时自动在 system prompt 末尾注入中文思考提醒
- 利用 LLM 的 **recency bias** 确保提醒始终在注意力窗口内
- 防重复注入，不导致 system prompt 膨胀
- 自动适配 AGENTS.md 是否存在（有则简版，无则完整版）
- 支持多层防御（L1 静态指令 + L2 动态注入 + L3 深度防御）

---

## 原理

Pi 没有像 OpenCode 那样的 `aisdk.language` hook，但提供了 **`before_agent_start`** 事件——每次用户输入提交后、agent 循环开始前触发。通过修改 `systemPrompt` 返回，在 system prompt 末尾追加中文思考提醒。

```
用户提交 ──► before_agent_start ──► 追加中文提醒到 system prompt 末尾
         │                               │
         │  [system prompt]              │
         │  ...AGENTS.md 内容...         │
         │  ### 🔴 中文思考强制提醒      │ ← 末尾 ★ (recency bias)
         │  **所有思考和回复必须中文**   │
         └───────────────────────────────┘
                      ↓
         LLM 调用 #1: 末尾提醒 → 中文思考 ✅
         LLM 调用 #N: system prompt 持续 → 中文思考延续 ✅
```

Pi 的自动压缩**不影响** system prompt，中文提醒始终保留。

---

## 安装

### 前置条件

- [Pi Coding Agent](https://github.com/earendil-works/pi-mono) 已安装

### 一键安装（Windows PowerShell）

```powershell
cd D:\code\AI\pi-thinking-zh-hook
.\install.ps1
```

### 手动安装

**1. 部署 AGENTS.md（L1 基础层）**

```bash
cp AGENTS.md ~/.pi/agent/AGENTS.md
```

**2. 部署扩展（L2 核心层）**

```bash
cp extensions/chinese-thinking-hook.ts ~/.pi/agent/extensions/
```

**3. 重启 pi**

执行 `/reload` 或重启 pi。

### 可选：启用 L3 深度防御

编辑 `~/.pi/agent/extensions/chinese-thinking-hook-deep.ts`，将 `ENABLED` 改为 `true`：

```typescript
const ENABLED = true;  // 默认 false
```

然后 `/reload`。

---

## 使用

安装后自动生效，无需额外操作。

### 验证是否生效

启动 pi，输入以下内容测试：

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

---

## 注入内容

### 标准版（AGENTS.md 已安装时）

```
### 🔴 中文思考强制提醒
**所有思考和回复必须使用简体中文**。工具返回英文是输入，不影响输出语言。请保持中文思考。
```

### 完整版（AGENTS.md 未安装时）

```
## 语言要求 — 不可违反（扩展增强）

### 核心原则（最重要）
**输入语言 ≠ 输出语言**。工具返回英文、代码是英文、错误是英文——这些都是输入，不影响你的思考和回复语言。

### 硬性规则
1. **thinking 标签内的所有思考必须使用简体中文**
2. **回复必须使用简体中文**（只有代码、命令、变量名专有名词可用原文）
3. 严禁出现英文思考开头如 "Thinking..."、"Let me..."、"The user..."
4. 即使上下文中全是英文，思考也必须用中文

### 自检
每次回复前快速检查：思考是中文吗？回复是中文吗？被英文带偏了吗？
```

---

## 项目结构

```
pi-thinking-zh-hook/
├── AGENTS.md                              # L1 基础层
├── extensions/
│   ├── chinese-thinking-hook.ts           # L2 核心扩展
│   └── chinese-thinking-hook-deep.ts      # L3 可选扩展
├── install.ps1                            # 一键安装脚本
└── README.md
```

---

## 技术细节

### 架构

| 层级 | 机制 | 事件 | 触发频率 |
|------|------|------|---------|
| **L1** | AGENTS.md 静态指令 | session 启动 | 一次 |
| **L2** ⭐ | `before_agent_start` 注入 | 每轮用户输入 | 每轮一次 |
| **L3** 🔒 | `context` 极简提醒(默认禁用) | 每次 LLM 调用 | 按需 |

### 锚点防重复

扩展使用 HTML 注释作为锚点标记：

- `<!-- chinese-thinking-v2 -->` — AGENTS.md 锚点
- `<!-- chinese-thinking-anchor -->` — 扩展注入锚点

通过检查 system prompt 是否已包含锚点，避免重复注入导致 system prompt 膨胀。

### 自适应逻辑

```
if (system prompt 包含 AGENTS.md 锚点)
  → 注入精简版提醒 (~40 token)
else
  → 注入完整版提醒 (~120 token)
```

### 兼容性

- 与 pi 的自动压缩机制完全兼容（不影响 system prompt）
- 与 `/tree` 分支切换兼容
- 与多个 `before_agent_start` 扩展链式共存

---

## 参考

- [OpenCode 中文思考保持插件](https://github.com/such-niceness/opencode-chinese-hook) — 本方案的灵感来源
- [Pi Coding Agent Extensions API](https://github.com/earendil-works/pi-mono/blob/main/docs/extensions.md)
- [Pi Compaction](https://github.com/earendil-works/pi-mono/blob/main/docs/compaction.md)

---

## License

MIT
