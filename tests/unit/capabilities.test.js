import { describe, expect, it } from "vitest";
import { getCapabilitiesForModel, PROVIDER_CAPABILITIES } from "../../open-sse/providers/capabilities.js";
import { getThinkingLevels } from "../../open-sse/providers/thinkingLevels.js";
import commandcode from "../../open-sse/providers/registry/commandcode.js";

describe("getCapabilitiesForModel", () => {
  const claudeSonnet5Expected = {
    contextWindow: 1000000,
    maxOutput: 128000,
    thinkingFormat: "claude-adaptive",
    reasoning: true,
    vision: true,
    search: true,
  };

  const kiroGpt56Expected = {
    contextWindow: 272000,
    maxOutput: 128000,
    thinkingFormat: "openai",
    reasoning: true,
    vision: true,
    search: true,
  };

  it("reports Kiro Claude Opus 5 variants as 1M adaptive-thinking models", () => {
    for (const model of [
      "claude-opus-5",
      "anthropic/claude-opus-5",
      "claude-opus-5-thinking",
      "claude-opus-5-agentic",
      "claude-opus-5-thinking-agentic",
    ]) {
      expect(getCapabilitiesForModel("kiro", model)).toMatchObject(claudeSonnet5Expected);
    }
  });

  it("reports Claude Fable 5.1 as a permanent adaptive-thinking model", () => {
    expect(getCapabilitiesForModel("claude", "claude-fable-5-1")).toMatchObject({
      ...claudeSonnet5Expected,
      thinkingCanDisable: false,
    });
  });

  it("reports Kiro Claude Opus 4.8 as a 1M context model", () => {
    expect(getCapabilitiesForModel("kiro", "claude-opus-4.8").contextWindow).toBe(1000000);
    expect(getCapabilitiesForModel("kiro", "anthropic/claude-opus-4.8").contextWindow).toBe(1000000);
    expect(getCapabilitiesForModel("kiro", "claude-opus-4-8").contextWindow).toBe(1000000);
    expect(getCapabilitiesForModel("kiro", "claude-opus-4.8-thinking").contextWindow).toBe(1000000);
    expect(getCapabilitiesForModel("kiro", "claude-opus-4-8-thinking").contextWindow).toBe(1000000);
  });

  it("reports Kiro Claude Sonnet 5 as a 1M adaptive-thinking model", () => {
    expect(getCapabilitiesForModel("kiro", "claude-sonnet-5")).toMatchObject(claudeSonnet5Expected);
    expect(getCapabilitiesForModel("kiro", "anthropic/claude-sonnet-5")).toMatchObject(claudeSonnet5Expected);
    expect(getCapabilitiesForModel("kiro", "claude-sonnet-5-thinking")).toMatchObject(claudeSonnet5Expected);
    expect(getCapabilitiesForModel("kiro", "claude-sonnet-5-agentic")).toMatchObject(claudeSonnet5Expected);
    expect(getCapabilitiesForModel("kiro", "claude-sonnet-5-thinking-agentic")).toMatchObject(claudeSonnet5Expected);
  });

  it("reports Kiro GPT 5.6 models with the Kiro 272k context window", () => {
    expect(getCapabilitiesForModel("kiro", "gpt-5.6-sol")).toMatchObject(kiroGpt56Expected);
    expect(getCapabilitiesForModel("kiro", "openai/gpt-5.6-sol")).toMatchObject(kiroGpt56Expected);
    expect(getCapabilitiesForModel("kiro", "gpt-5.6-terra-thinking")).toMatchObject(kiroGpt56Expected);
    expect(getCapabilitiesForModel("kiro", "gpt-5.6-luna-agentic")).toMatchObject(kiroGpt56Expected);
    expect(getCapabilitiesForModel("kiro", "gpt-5.6-sol-thinking-agentic")).toMatchObject(kiroGpt56Expected);
  });

  it("keeps the CommandCode Go catalog and metadata in sync", () => {
    const ids = commandcode.models.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => PROVIDER_CAPABILITIES.commandcode[id])).toBe(true);
    expect(Object.keys(PROVIDER_CAPABILITIES.commandcode).every((id) => ids.includes(id))).toBe(true);
  });

  it("reports CommandCode DeepSeek V4 metadata and native effort levels", () => {
    expect(getCapabilitiesForModel("commandcode", "deepseek/deepseek-v4-flash")).toMatchObject({
      vision: false,
      reasoning: true,
      thinkingFormat: "commandcode",
      thinkingCanDisable: true,
      contextWindow: 1000000,
      maxOutput: 384000,
    });
    expect(getCapabilitiesForModel("commandcode", "deepseek/deepseek-v4-flash-vision-exp").vision).toBe(true);
    expect(getThinkingLevels("commandcode", "deepseek/deepseek-v4-flash"))
      .toEqual(["none", "low", "high", "max"]);
  });

  it("uses native effort levels and conservative private-model defaults", () => {
    expect(getThinkingLevels("commandcode", "moonshotai/Kimi-K3"))
      .toEqual(["none", "low", "medium", "high"]);
    expect(getThinkingLevels("commandcode", "zai-org/GLM-5.2"))
      .toEqual(["none", "high", "max"]);
    expect(getThinkingLevels("commandcode", "gpt-5.6-luna"))
      .toEqual(["none", "low", "medium", "high", "xhigh", "max"]);
    expect(getThinkingLevels("commandcode", "Qwen/Qwen3.8-Max"))
      .toEqual(["none", "low", "medium", "xhigh"]);
  });

  it("uses Go-plan capability markers instead of broad family defaults", () => {
    expect(getCapabilitiesForModel("commandcode", "moonshotai/Kimi-K2.6")).toMatchObject({ vision: true, reasoning: false });
    expect(getCapabilitiesForModel("commandcode", "zai-org/GLM-5.2-Fast").reasoning).toBe(false);
    expect(getCapabilitiesForModel("commandcode", "Qwen/Qwen3.8-Max")).toMatchObject({ vision: true, reasoning: true });
    expect(getCapabilitiesForModel("commandcode", "Qwen/Qwen3.6-Plus").contextWindow).toBe(200000);
  });
});
