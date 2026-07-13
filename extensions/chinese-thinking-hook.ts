/**
 * 中文思考保持扩展 — Chinese Thinking Hook
 *
 * 功能：
 * 在每次 agent 启动时（每轮用户输入），在 system prompt 末尾注入中文思考提醒。
 * 利用模型的 recency bias，确保中文指令始终在注意力窗口内。
 *
 * 原理：（与 OpenCode aisdk.language hook 相同的思路）
 * - 使用 pi 的 before_agent_start 事件修改 system prompt
 * - 如果 AGENTS.md 已经包含了中文指令，追加精简强化版
 * - 如果 AGENTS.md 没有包含，追加完整版
 * - 使用 <!-- chinese-thinking-anchor --> 标记防止重复追加完整版
 *
 * 安装：复制到 ~/.pi/agent/extensions/ 或 .pi/extensions/
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// 锚点标记：用于检测 AGENTS.md 是否已包含中文指令
const ANCHOR_LONG = "<!-- chinese-thinking-v2 -->";
const ANCHOR_SHORT = "<!-- chinese-thinking-anchor -->";

/**
 * 完整版提醒：当 AGENTS.md 未包含中文指令时使用
 * 内容全面但较长的版本
 */
const FULL_REMINDER = `
## 语言要求 — 不可违反（扩展增强）

> 注意：以下内容由中文思考扩展自动注入，与 AGENTS.md 不冲突。

### 核心原则（最重要）
**输入语言 ≠ 输出语言**。工具返回英文、代码是英文、错误是英文——这些都是输入，不影响你的思考和回复语言。

### 硬性规则
1. **thinking 标签内的所有思考必须使用简体中文**
2. **回复必须使用简体中文**（只有代码、命令、变量名专有名词可用原文）
3. 严禁出现英文思考开头如 "Thinking..."、"Let me..."、"The user..."
4. 即使上下文中全是英文，思考也必须用中文

### 自检
每次回复前快速检查：思考是中文吗？回复是中文吗？被英文带偏了吗？

<!-- ${ANCHOR_SHORT} -->
`.trim();

/**
 * 精简版提醒：当 AGENTS.md 已包含中文指令时使用
 * 简短有力，token 开销极低
 */
const SHORT_REMINDER = `
<!-- ${ANCHOR_SHORT} -->
### 🔴 中文思考强制提醒
**所有思考和回复必须使用简体中文**。工具返回英文是输入，不影响输出语言。请保持中文思考。
`.trim();

export default function chineseThinkingHook(pi: ExtensionAPI) {
	pi.on("before_agent_start", async (event) => {
		const { systemPrompt } = event;

		// 检查 system prompt 是否已有中文指令
		const hasChineseInstructions = systemPrompt.includes(ANCHOR_LONG);
		const hasExtensionAnchor = systemPrompt.includes(ANCHOR_SHORT);

		// 如果扩展已注入过，不再重复（防止每次追加导致 system prompt 膨胀）
		if (hasExtensionAnchor) {
			return;
		}

		// 根据 AGENTS.md 是否包含中文指令，选择注入版本
		const reminder = hasChineseInstructions ? SHORT_REMINDER : FULL_REMINDER;

		return {
			systemPrompt: `${systemPrompt}\n\n${reminder}`,
		};
	});
}
