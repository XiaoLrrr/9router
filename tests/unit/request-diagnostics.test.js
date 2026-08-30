import { describe, expect, it } from "vitest";
import { summarizeRequestFlow } from "../../open-sse/utils/requestDiagnostics.js";
import { __test__ as requestDetailsTest } from "../../src/lib/db/repos/requestDetailsRepo.js";

describe("request diagnostics", () => {
  it("shows normalized reasoning and preserved images without retaining content", () => {
    const received = {
      model: "cmc/deepseek/deepseek-v4-flash",
      stream: false,
      reasoning: { enabled: true, effort: "xhigh" },
      messages: [{ role: "user", content: [
        { type: "text", text: "secret prompt" },
        { type: "image_url", image_url: { url: "data:image/png;base64,SECRET" } },
      ] }],
    };
    const forwarded = {
      params: {
        model: "deepseek/deepseek-v4-flash",
        stream: true,
        reasoning_effort: "max",
        messages: [{ role: "user", content: [
          { type: "text", text: "secret prompt" },
          { type: "image", source: { type: "base64", data: "SECRET" } },
        ] }],
      },
    };

    const summary = summarizeRequestFlow(received, forwarded);
    expect(summary.result).toEqual({ reasoning: "normalized", stream: "forced", images: "forwarded" });
    expect(summary.received).toMatchObject({ inputFormats: ["text", "image"], imageCount: 1 });
    expect(summary.forwarded).toMatchObject({ reasoning: { effort: "max" }, imageCount: 1 });
    expect(JSON.stringify(summary)).not.toContain("secret prompt");
    expect(JSON.stringify(summary)).not.toContain("SECRET");
  });

  it("marks an unsupported disable request as omitted", () => {
    const summary = summarizeRequestFlow(
      { reasoning: { enabled: false }, messages: [] },
      { params: { messages: [] } },
    );
    expect(summary.result.reasoning).toBe("omitted");
  });

  it("keeps diagnostic summaries in the stored request record", () => {
    const requestFlow = { result: { reasoning: "forwarded" } };
    const responseConfig = { hasThinking: true };
    const stored = requestDetailsTest.buildStoredRecord(
      {
        id: "detail-1",
        timestamp: "2026-08-24T00:00:00.000Z",
        requestFlow,
        responseConfig,
      },
      5120
    );

    expect(stored.requestFlow).toEqual(requestFlow);
    expect(stored.responseConfig).toEqual(responseConfig);
  });
});
