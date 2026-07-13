/**
 * 中文思考深度防御扩展 — L3 可选强化层（默认禁用）
 *
 * ⚠️ 警告：本扩展默认禁用。仅当 L2（before_agent_start）不足以维持中文思考时启用。
 *
 * 原理：
 * 在每次 LLM 调用前的 context 事件中，在消息流末尾注入一条极简的中文提醒。
 * 这比 before_agent_start（每轮一次）更激进，在每个 tool call 循环的 LLM 调用中都会触发。
 *
 * 风险：
 * - 每次 LLM 调用都会额外注入一条 user 消息（~10-15 token）
 * - 在长 tool call 链中会累积 token 开销
 * - 注入的消息不持久化到 session，每次 context 重建
 *
 * 启用方式：将下方 ENABLED 改为 true，然后重启 pi 或 /reload
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ============================================================
// 开关：设置为 true 以启用深度防御
// ============================================================
const ENABLED = false;

// 注入的消息内容（保持极简以节省 token）
const PULSE_MARKER = "<!-- chinese-thinking-pulse -->";
const PULSE_MESSAGE = `${PULSE_MARKER} 中文思考提醒：请用中文思考和回复。英文是输入不影响输出。`;

export default function chineseThinkingDeep(pi: ExtensionAPI) {
	if (!ENABLED) {
		// 禁用状态：注册空 handler，不影响性能
		pi.on("context", async () => {});
		return;
	}

	pi.on("context", async (event) => {
		const { messages } = event;

		// 检查最后一条消息是否已是我们的提醒（防止重复注入）
		const lastMsg = messages[messages.length - 1];
		if (
			lastMsg &&
			lastMsg.role === "system" &&
			typeof lastMsg.content === "string" &&
			lastMsg.content.includes(PULSE_MARKER)
		) {
			return;
		}

		return {
			messages: [
				...messages,
				{
					role: "system" as const,
					content: PULSE_MESSAGE,
				},
			],
		};
	});
}
