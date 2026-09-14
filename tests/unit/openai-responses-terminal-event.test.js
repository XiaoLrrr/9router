import { describe, expect, it } from "vitest";

import { FORMATS } from "../../open-sse/translator/formats.js";
import { createSSETransformStreamWithLogger } from "../../open-sse/utils/stream.js";

async function runTransform(input, sourceFormat = FORMATS.OPENAI_RESPONSES, targetFormat = FORMATS.OPENAI_RESPONSES) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(input));
      controller.close();
    },
  });

  const output = stream.pipeThrough(
    createSSETransformStreamWithLogger(
      targetFormat,
      sourceFormat,
      "codex",
      null,
      null,
      "gpt-5.5",
    ),
  );

  const reader = output.getReader();
  const decoder = new TextDecoder();
  let text = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return text;
}

describe("OpenAI Responses streaming termination", () => {
  it("emits a response.failed event when a Responses stream closes before a terminal event", async () => {
    const output = await runTransform([
      `event: response.created`,
      `data: ${JSON.stringify({ type: "response.created", response: { id: "resp_test", status: "in_progress" } })}`,
      "",
      `event: response.output_text.delta`,
      `data: ${JSON.stringify({ type: "response.output_text.delta", delta: "partial" })}`,
      "",
    ].join("\n"));

    expect(output).toContain("event: response.failed");
    expect(output).toContain('"type":"response.failed"');
    expect(output).not.toContain("data: null");
    expect(output).toContain("data: [DONE]");
  });

  it("does not add response.failed when a Responses stream already completed", async () => {
    const output = await runTransform([
      `event: response.completed`,
      `data: ${JSON.stringify({ type: "response.completed", response: { id: "resp_test", status: "completed" } })}`,
      "",
    ].join("\n"));

    expect(output).toContain("event: response.completed");
    expect(output).not.toContain("event: response.failed");
    expect(output).not.toContain("data: null");
    expect(output).toContain("data: [DONE]");
  });

  it("terminates a Responses-to-Chat-Completions stream with DONE", async () => {
    const output = await runTransform([
      `event: response.completed`,
      `data: ${JSON.stringify({ type: "response.completed", response: { status: "completed" } })}`,
      "",
    ].join("\n"), FORMATS.OPENAI);

    expect(output).toContain('"finish_reason":"stop"');
    expect(output.match(/data: \[DONE\]/g)).toHaveLength(1);
  });

  it("does not mark a prematurely closed Chat-Completions translation as done", async () => {
    const output = await runTransform([
      `event: response.output_text.delta`,
      `data: ${JSON.stringify({ type: "response.output_text.delta", delta: "partial" })}`,
      "",
    ].join("\n"), FORMATS.OPENAI);

    expect(output).toContain("partial");
    expect(output).not.toContain("data: [DONE]");
  });

  it("only terminates a CommandCode-to-Responses stream after upstream DONE", async () => {
    const chunks = [
      `data: ${JSON.stringify({ id: "chatcmpl_test", object: "chat.completion.chunk", choices: [{ index: 0, delta: { role: "assistant", content: "ok" }, finish_reason: null }] })}`,
      `data: ${JSON.stringify({ id: "chatcmpl_test", object: "chat.completion.chunk", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}`,
      "",
    ].join("\n");

    const completed = await runTransform(`${chunks}data: [DONE]\n\n`, FORMATS.OPENAI_RESPONSES, FORMATS.COMMANDCODE);
    const truncated = await runTransform(chunks, FORMATS.OPENAI_RESPONSES, FORMATS.COMMANDCODE);

    expect(completed).toContain("event: response.completed");
    expect(completed.indexOf("event: response.completed")).toBeLessThan(completed.indexOf("data: [DONE]"));
    expect(completed.match(/data: \[DONE\]/g)).toHaveLength(1);
    expect(truncated).not.toContain("data: [DONE]");
  });

  it("does not add response.failed when a Responses stream sends response.done", async () => {
    const output = await runTransform([
      `event: response.done`,
      `data: ${JSON.stringify({ type: "response.done", response: { id: "resp_test" } })}`,
      "",
    ].join("\n"));

    expect(output).toContain("event: response.done");
    expect(output).not.toContain("event: response.failed");
    expect(output).not.toContain("data: null");
    expect(output).toContain("data: [DONE]");
  });

  it("emits response.failed before DONE when a Responses stream sends DONE without a terminal event", async () => {
    const output = await runTransform([
      `event: response.created`,
      `data: ${JSON.stringify({ type: "response.created", response: { id: "resp_test", status: "in_progress" } })}`,
      "",
      "data: [DONE]",
      "",
    ].join("\n"));

    expect(output.indexOf("event: response.failed")).toBeLessThan(output.indexOf("data: [DONE]"));
    expect(output.match(/data: \[DONE\]/g)).toHaveLength(1);
    expect(output).not.toContain("data: null");
  });
});
