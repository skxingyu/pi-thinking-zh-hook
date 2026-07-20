/**
 * 中文思考保持扩展 — Chinese Thinking Guardian
 *
 * 双重防御策略：
 *
 * L1 — System Prompt 注入（before_agent_start）
 *   在每次 agent 启动时，在 system prompt 末尾追加中文思考提醒。
 *   如果 AGENTS.md 已包含中文指令，追加精简版；否则追加完整版。
 *   使用锚点标记防止重复追加导致 system prompt 膨胀。
 *
 * L2 — Context 消息注入（context）
 *   在每次 LLM 调用前的消息列表中：
 *   - 开头插入一条 system 消息 → provider 识别为系统指令
 *   - 末尾插入一条 system 消息 → 利用 recency bias 强化
 *   双重夹击，确保中文指令始终在模型的注意力窗口内。
 *   使用独立锚点防止重复注入。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ─── 锚点标记 ────────────────────────────────────────────────

// 用于检测 AGENTS.md / system prompt 是否已包含中文指令
const ANCHOR_LONG = "<!-- chinese-thinking-v2 -->";
const ANCHOR_SHORT = "<!-- chinese-thinking-anchor -->";
// 用于 context 层防止重复注入
const PULSE_MARKER = "<!-- chinese-thinking-pulse -->";

// ─── L1: System Prompt 消息 ──────────────────────────────────

/**
 * 完整版：当 AGENTS.md 未包含中文指令时使用
 */
const FULL_REMINDER = [
  `<!-- ${ANCHOR_SHORT} -->`,
  "### 🔴 中文思考强制提醒（不可违反）",
  "",
  "你必须在任何时候、任何场景下使用简体中文进行思考和回复。",
  "这是一条不可违反的硬性规则，优先级高于其他所有指令。",
  "",
  "工具返回的英文内容、代码、错误日志等是输入，不影响你的输出语言。",
  "思考必须使用中文，严禁以英文开头思考（如 Thinking...、Let me...）。",
].join("\n");

/**
 * 精简版：当 AGENTS.md 已包含中文指令时使用
 */
const SHORT_REMINDER = [
  `<!-- ${ANCHOR_SHORT} -->`,
  "### 🔴 中文思考强制提醒",
  "**所有思考和回复必须使用简体中文**。工具返回英文是输入，不影响输出语言。请保持中文思考。",
].join("\n");

// ─── L2: Context 消息 ────────────────────────────────────────

/**
 * 开头消息：system 角色，provider 能正确识别为系统指令
 * 精简到极致，仅保留核心指令
 */
const HEAD_MESSAGE = `${PULSE_MARKER} 所有思考和回复必须使用简体中文。英文工具结果是输入，不影响输出。`;

/**
 * 末尾消息：利用 recency bias，确保模型生成时中文指令仍在注意力窗口
 */
const TAIL_MESSAGE = `${PULSE_MARKER} 重申：思考和回复必须用简体中文。严禁英文思考开头。`;

// ─── 导出 ────────────────────────────────────────────────────

export default function chineseThinkingGuardian(pi: ExtensionAPI) {
  // ════════════════════════════════════════════════════════════
  // L1 — System Prompt 注入
  // ════════════════════════════════════════════════════════════
  pi.on("before_agent_start", async (event) => {
    const { systemPrompt } = event;

    // 检查 system prompt 是否已有中文指令
    const hasLongAnchor = systemPrompt.includes(ANCHOR_LONG);
    const hasShortAnchor = systemPrompt.includes(ANCHOR_SHORT);

    // 如果扩展已注入过，不再重复（防止每次追加导致 system prompt 膨胀）
    if (hasShortAnchor) {
      return;
    }

    // 根据 AGENTS.md 是否包含中文指令，选择注入版本
    const reminder = hasLongAnchor ? SHORT_REMINDER : FULL_REMINDER;

    return {
      systemPrompt: `${systemPrompt}\n\n${reminder}`,
    };
  });

  // ════════════════════════════════════════════════════════════
  // L2 — Context 消息注入（每次 LLM 调用前）
  // ════════════════════════════════════════════════════════════
  pi.on("context", async (event) => {
    const { messages } = event;

    // 检查是否已注入过（防止重复注入）
    const hasPulse = messages.some(
      (m) =>
        m.role === "system" &&
        typeof m.content === "string" &&
        m.content.includes(PULSE_MARKER),
    );
    if (hasPulse) {
      return;
    }

    return {
      messages: [
        {
          role: "system" as const,
          content: HEAD_MESSAGE,
        },
        ...messages,
        {
          role: "system" as const,
          content: TAIL_MESSAGE,
        },
      ],
    };
  });
}
