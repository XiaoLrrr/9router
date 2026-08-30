const IMAGE_TYPES = new Set(["image", "image_url", "input_image"]);

function payloadOf(body) {
  if (!body || typeof body !== "object") return {};
  return body.params && typeof body.params === "object" ? body.params : body;
}

function reasoningOf(payload) {
  const reasoning = payload.reasoning;
  if (reasoning && typeof reasoning === "object" && !Array.isArray(reasoning)) {
    return {
      field: "reasoning",
      enabled: reasoning.enabled !== false,
      effort: reasoning.enabled === false ? null : reasoning.effort || null,
    };
  }
  if (payload.reasoning_effort != null) {
    const effort = String(payload.reasoning_effort).toLowerCase();
    return { field: "reasoning_effort", enabled: effort !== "none", effort };
  }
  const thinking = payload.thinking;
  if (thinking && typeof thinking === "object" && !Array.isArray(thinking)) {
    const disabled = thinking.type === "disabled" || thinking.enabled === false;
    return {
      field: "thinking",
      enabled: !disabled,
      effort: thinking.effort || thinking.level || null,
      ...(Number.isFinite(thinking.budget_tokens) ? { budgetTokens: thinking.budget_tokens } : {}),
    };
  }
  if (payload.enable_thinking != null) {
    return { field: "enable_thinking", enabled: payload.enable_thinking !== false, effort: null };
  }
  return null;
}

function inputSummary(messages) {
  const formats = new Set();
  let imageCount = 0;
  for (const message of messages || []) {
    const content = message?.content;
    if (typeof content === "string") {
      if (content) formats.add("text");
      continue;
    }
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (typeof block === "string" || block?.type === "text" || block?.type === "input_text") {
        formats.add("text");
      } else if (IMAGE_TYPES.has(block?.type)) {
        formats.add("image");
        imageCount++;
      }
    }
  }
  return { inputFormats: [...formats], imageCount };
}

export function summarizeRequestConfig(body, streamOverride) {
  const payload = payloadOf(body);
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const { inputFormats, imageCount } = inputSummary(messages);
  return {
    shape: payload === body ? "root" : "commandcode.params",
    model: payload.model || body?.model || null,
    stream: payload.stream ?? body?.stream ?? streamOverride ?? null,
    reasoning: reasoningOf(payload),
    maxTokens: payload.max_tokens ?? payload.max_output_tokens ?? payload.max_completion_tokens ?? null,
    messageCount: messages.length,
    toolCount: Array.isArray(payload.tools) ? payload.tools.length : 0,
    inputFormats,
    imageCount,
  };
}

export function summarizeRequestFlow(receivedBody, forwardedBody, receivedStream, forwardedStream) {
  const received = summarizeRequestConfig(receivedBody, receivedStream);
  const forwarded = summarizeRequestConfig(forwardedBody, forwardedStream);
  const requestedEffort = received.reasoning?.effort;
  const forwardedEffort = forwarded.reasoning?.effort;
  let reasoningStatus = "provider-default";
  if (received.reasoning?.enabled === false) reasoningStatus = forwardedEffort ? "overridden" : "omitted";
  else if (requestedEffort && !forwardedEffort) reasoningStatus = "stripped";
  else if (requestedEffort === forwardedEffort) reasoningStatus = "forwarded";
  else if (requestedEffort && forwardedEffort) reasoningStatus = "normalized";
  else if (forwardedEffort) reasoningStatus = "injected";

  return {
    received,
    forwarded,
    result: {
      reasoning: reasoningStatus,
      stream: received.stream === forwarded.stream ? "forwarded" : "forced",
      images: received.imageCount === 0
        ? "none"
        : (received.imageCount === forwarded.imageCount ? "forwarded" : "stripped"),
    },
  };
}

export function summarizeResponseConfig(response) {
  const thinking = response?.thinking || response?.reasoning_content || null;
  const content = response?.content || null;
  return {
    hasThinking: Boolean(thinking),
    thinkingChars: typeof thinking === "string" ? thinking.length : 0,
    contentChars: typeof content === "string" ? content.length : 0,
  };
}
