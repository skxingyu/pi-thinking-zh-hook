/**
 * 中文思考保持扩展 — Chinese Thinking Guardian
 *
 * 默认关闭，通过 /zhthinking 命令手动开启/关闭。
 *
 * 开启后双层防御：
 * L1 — System Prompt 注入（before_agent_start）
 * L2 — Context 消息注入（context）
 *
 * 用法：
 *   /zhthinking            — 切换开关
 *   /zhthinking on         — 开启
 *   /zhthinking off        — 关闭
 *   /zhthinking status     — 查看当前状态
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ─── 状态 ────────────────────────────────────────────────────

let enabled = false;

// ─── 锚点标记 ────────────────────────────────────────────────

const ANCHOR_LONG = "<!-- chinese-thinking-v2 -->";
const ANCHOR_SHORT = "<!-- chinese-thinking-anchor -->";
const PULSE_MARKER = "<!-- chinese-thinking-pulse -->";

// ─── L1: System Prompt 消息 ──────────────────────────────────

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

const SHORT_REMINDER = [
  `<!-- ${ANCHOR_SHORT} -->`,
  "### 🔴 中文思考强制提醒",
  "**所有思考和回复必须使用简体中文**。工具返回英文是输入，不影响输出语言。请保持中文思考。",
].join("\n");

// ─── L2: Context 消息 ────────────────────────────────────────

const HEAD_MESSAGE = `${PULSE_MARKER} 所有思考和回复必须使用简体中文。英文工具结果是输入，不影响输出。`;
const TAIL_MESSAGE = `${PULSE_MARKER} 重申：思考和回复必须用简体中文。严禁英文思考开头。`;

// ─── 工具函数 ────────────────────────────────────────────────

function toggle(on?: boolean): boolean {
  if (on !== undefined) {
    enabled = on;
  } else {
    enabled = !enabled;
  }
  return enabled;
}

function statusText(): string {
  return enabled ? "✅ 中文思考模式 — 已开启" : "❌ 中文思考模式 — 已关闭";
}

// ─── 导出 ────────────────────────────────────────────────────

export default function chineseThinkingGuardian(pi: ExtensionAPI) {
  // ════════════════════════════════════════════════════════════
  // 注册 /zhthinking 命令
  // ════════════════════════════════════════════════════════════
  pi.registerCommand("zhthinking", {
    description: "切换中文思考强制模式。用法: /zhthinking [on|off|status]",
    handler: async (args, ctx) => {
      const arg = args.trim().toLowerCase();

      if (arg === "status") {
        ctx.ui.notify(statusText(), "info");
        return;
      }

      if (arg === "on") {
        toggle(true);
      } else if (arg === "off") {
        toggle(false);
      } else {
        toggle();
      }

      ctx.ui.notify(
        enabled
          ? "✅ 中文思考模式已开启 — 将在下次请求时注入中文指令"
          : "❌ 中文思考模式已关闭 — 不再注入中文指令",
        enabled ? "info" : "warning",
      );
      ctx.ui.setStatus("zh-thinking", enabled ? "中文思考 ✅" : undefined);
    },
  });

  // ════════════════════════════════════════════════════════════
  // L1 — System Prompt 注入
  // ════════════════════════════════════════════════════════════
  pi.on("before_agent_start", async (event) => {
    if (!enabled) return;

    const { systemPrompt } = event;

    const hasLongAnchor = systemPrompt.includes(ANCHOR_LONG);
    const hasShortAnchor = systemPrompt.includes(ANCHOR_SHORT);

    if (hasShortAnchor) {
      return;
    }

    const reminder = hasLongAnchor ? SHORT_REMINDER : FULL_REMINDER;

    return {
      systemPrompt: `${systemPrompt}\n\n${reminder}`,
    };
  });

  // ════════════════════════════════════════════════════════════
  // L2 — Context 消息注入（每次 LLM 调用前）
  // ════════════════════════════════════════════════════════════
  pi.on("context", async (event) => {
    if (!enabled) return;

    const { messages } = event;

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
        { role: "system" as const, content: HEAD_MESSAGE },
        ...messages,
        { role: "system" as const, content: TAIL_MESSAGE },
      ],
    };
  });
}
