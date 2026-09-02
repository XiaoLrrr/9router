import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCommandCodeModelCache,
  isCommandCodeModelAllowed,
  normalizeCommandCodePlan,
  resolveCommandCodeModels,
} from "../../open-sse/services/commandCodeModels.js";

describe("Command Code live models", () => {
  beforeEach(clearCommandCodeModelCache);

  it("normalizes and caches the official catalog", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [
        { id: "new/model", name: "New Model", context_length: 1_000_000 },
        { id: "new/model", name: "Duplicate" },
        { nope: true },
      ],
    }), { status: 200 }));

    await expect(resolveCommandCodeModels({ fetchFn })).resolves.toEqual({
      models: [{
        id: "new/model",
        name: "New Model",
        capabilities: { contextWindow: 1_000_000 },
      }],
    });
    await resolveCommandCodeModels({ fetchFn });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("fails open when the catalog is unavailable", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("no", { status: 503 }));
    await expect(resolveCommandCodeModels({ fetchFn })).resolves.toBeNull();
  });

  it("enforces Go, Pro, and Max model access", () => {
    expect(normalizeCommandCodePlan("invalid")).toBe("go");
    expect(isCommandCodeModelAllowed("gpt-5.6-luna", "go")).toBe(true);
    expect(isCommandCodeModelAllowed("claude-sonnet-5", "go")).toBe(false);
    expect(isCommandCodeModelAllowed("claude-sonnet-5", "pro")).toBe(true);
    expect(isCommandCodeModelAllowed("claude-opus-5", "pro")).toBe(false);
    expect(isCommandCodeModelAllowed("sakana/fugu-ultra", "pro")).toBe(false);
    expect(isCommandCodeModelAllowed("claude-opus-5", "max")).toBe(true);
  });
});
