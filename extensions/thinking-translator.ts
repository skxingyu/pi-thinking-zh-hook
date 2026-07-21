/**
 * 思考翻译扩展 — Thinking Translator
 *
 * 将 assistant 的 thinking/reasoning 内容翻译为中文。
 * 通过 /zhtranslate 命令手动开启/关闭。
 *
 * 用法：
 *   /zhtranslate       — 切换开关
 *   /zhtranslate on    — 开启
 *   /zhtranslate off   — 关闭
 *   /zhtranslate status — 查看状态
 *   /zhtranslate model <provider/modelId> — 设置翻译模型
 *
 * 工作原理：
 *   监听 message_end 事件，提取 assistant 消息中的 thinking 文本，
 *   通过配置的翻译模型（默认 deepseek/deepseek-v4-flash）调用 OpenAI 兼容 API，
 *   将翻译结果显示在 widget 区域。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ─── 状态 ────────────────────────────────────────────────────

let enabled = false;
let translationProvider = "sensenova";
let translationModelId = "sensenova-6.7-flash-lite";
let abortController: AbortController | undefined;
let clearTimer: ReturnType<typeof setTimeout> | undefined;

// ─── 工具函数 ────────────────────────────────────────────────

function toggle(on?: boolean): boolean {
  enabled = on !== undefined ? on : !enabled;
  return enabled;
}

function statusText(): string {
  return enabled
    ? `✅ 思考翻译 — 已开启 (${translationProvider}/${translationModelId})`
    : "❌ 思考翻译 — 已关闭";
}

function parseModelArg(arg: string): { provider: string; modelId: string } | null {
  const parts = arg.trim().split("/");
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { provider: parts[0], modelId: parts[1] };
  }
  return null;
}

// ─── 翻译逻辑 ────────────────────────────────────────────────

async function translateThinking(
  text: string,
  ctx: { modelRegistry: { find: (p: string, m: string) => any; getApiKeyAndHeaders: (m: any) => Promise<any> } },
  signal?: AbortSignal,
): Promise<string | null> {
  // 查找模型
  const model = ctx.modelRegistry.find(translationProvider, translationModelId);
  if (!model) {
    return `⚠️ 未找到模型 ${translationProvider}/${translationModelId}`;
  }

  // 获取认证信息
  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
  if (!auth?.ok) {
    return `⚠️ 模型认证失败: ${auth?.error ?? "未知错误"}`;
  }

  // 构建请求 — 兼容 baseUrl 可能已含 /v1 路径的情况
  const baseUrl = model.baseUrl.replace(/\/+$/, "");
  const url = baseUrl.endsWith("/v1") || baseUrl.endsWith("/api") ?
    `${baseUrl}/chat/completions` :
    `${baseUrl}/v1/chat/completions`;

  const systemPrompt = [
    "你是一个翻译助手。请将以下英文思考内容翻译为简体中文。",
    "要求：",
    "- 保持原意的准确性和完整性",
    "- 技术术语保留英文（如文件名、变量名、API 名称等）",
    "- 代码片段、路径、命令保持原样不翻译",
    "- 只输出翻译结果，不要添加解释或注释",
    "- 如果原文已经是中文，直接返回原文",
  ].join("\n");

  const body = {
    model: translationModelId,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ],
    max_tokens: 1000,
    temperature: 0.1,
    reasoning_effort: "none",
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.apiKey}`,
        ...model.headers,
        ...auth.headers,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "未知错误");
      return `⚠️ 翻译请求失败 (${response.status}): ${errorText}`;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const translated = data.choices?.[0]?.message?.content?.trim();
    return translated || "⚠️ 翻译结果为空";
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return null; // 被取消，不显示错误
    }
    return `⚠️ 翻译出错: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// ─── 提取 thinking 文本 ──────────────────────────────────────

function extractThinkingText(message: {
  content?: Array<{ type: string; thinking?: string; text?: string }>;
}): string | null {
  if (!message.content) return null;

  const thinkingBlocks = message.content.filter(
    (c) => c.type === "thinking" && c.thinking && c.thinking.trim().length > 0,
  );

  if (thinkingBlocks.length === 0) return null;

  // 合并所有 thinking 块，取前 2000 字符（避免发送过多 token 导致翻译慢）
  const fullText = thinkingBlocks.map((b) => b.thinking!.trim()).filter(Boolean).join("\n\n");
  return fullText.length > 2000 ? fullText.slice(0, 2000) + "\n..." : fullText;
}

// ─── 导出 ────────────────────────────────────────────────────

export default function thinkingTranslator(pi: ExtensionAPI) {
  // ════════════════════════════════════════════════════════════
  // 注册 /zhtranslate 命令
  // ════════════════════════════════════════════════════════════
  pi.registerCommand("zhtranslate", {
    description: "切换思考翻译。用法: /zhtranslate [on|off|status|model <provider/modelId>]",
    handler: async (args, ctx) => {
      const arg = args.trim().toLowerCase();

      if (arg === "status") {
        ctx.ui.notify(statusText(), "info");
        return;
      }

      if (arg.startsWith("model ")) {
        const modelArg = arg.slice(6).trim();
        const parsed = parseModelArg(modelArg);
        if (!parsed) {
          ctx.ui.notify(
            "⚠️ 模型格式错误。请使用 provider/modelId 格式，如 deepseek/deepseek-v4-flash",
            "warning",
          );
          return;
        }
        translationProvider = parsed.provider;
        translationModelId = parsed.modelId;
        ctx.ui.notify(
          `✅ 翻译模型已设置为 ${translationProvider}/${translationModelId}`,
          "info",
        );
        ctx.ui.setStatus(
          "zh-translate-model",
          `翻译模型: ${translationProvider}/${translationModelId}`,
        );
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
          ? `✅ 思考翻译已开启 — 使用 ${translationProvider}/${translationModelId}`
          : "❌ 思考翻译已关闭",
        enabled ? "info" : "warning",
      );
      ctx.ui.setStatus("zh-translate", enabled ? "思考翻译 ✅" : undefined);

      // 关闭时清除 widget
      if (!enabled) {
        clearTimeout(clearTimer);
        ctx.ui.setWidget("zh-translation", undefined);
      }
    },
  });

  // ════════════════════════════════════════════════════════════
  // agent_start 时清除旧翻译（新回合开始）
  // ════════════════════════════════════════════════════════════
  pi.on("agent_start", async (_event, ctx) => {
    if (!enabled) return;
    clearTimeout(clearTimer);
    ctx.ui.setWidget("zh-translation", undefined);
  });

  // ════════════════════════════════════════════════════════════
  // 监听 message_end — 翻译 thinking 内容
  // ════════════════════════════════════════════════════════════
  pi.on("message_end", async (event, ctx) => {
    if (!enabled) return;

    const message = event.message as {
      role?: string;
      content?: Array<{ type: string; thinking?: string; text?: string }>;
      timestamp?: number;
    };

    if (message.role !== "assistant") return;

    // 提取 thinking 文本
    const thinkingText = extractThinkingText(message);
    if (!thinkingText) return;

    // 取消之前的请求（如果有）
    abortController?.abort();
    abortController = new AbortController();

    // 显示翻译中的状态
    ctx.ui.setStatus("zh-translating", "🔄 翻译中...");

    // 执行翻译
    const result = await translateThinking(thinkingText, ctx, abortController.signal);

    ctx.ui.setStatus("zh-translating", undefined);

    // 翻译被取消（新请求覆盖），不处理
    if (result === null) return;

    // 显示翻译结果，固定位置覆盖写，最多 5 行
    const lines = result.split("\n").filter(Boolean);
    const maxLines = 7;
    const displayLines = lines.length > maxLines
      ? [...lines.slice(0, maxLines - 1), `${lines[maxLines - 1]} 有折叠`]
      : lines;

    // 使用固定 key 覆盖写，不堆积
    ctx.ui.setWidget("zh-translation", displayLines, {
      position: "below",
    });

    // 重置自动清除定时器：30 秒后无新翻译则自动消失
    clearTimeout(clearTimer);
    clearTimer = setTimeout(() => {
      ctx.ui.setWidget("zh-translation", undefined);
    }, 30_000);
  });
}