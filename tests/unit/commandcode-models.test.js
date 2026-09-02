import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCommandCodeModelCache,
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
});
