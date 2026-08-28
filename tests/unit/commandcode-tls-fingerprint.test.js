import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalFetch = globalThis.fetch;
const nativeFetch = vi.fn();
const sessionFetch = vi.fn();
const createSession = vi.fn();

vi.mock("wreq-js", () => ({ createSession }));

describe("CommandCode TLS fingerprint transport", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    globalThis.fetch = nativeFetch;
    createSession.mockResolvedValue({ fetch: sessionFetch });
    sessionFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("isolates two provider keys in separate Chrome 124 sessions", async () => {
    const { proxyAwareFetch } = await import("../../open-sse/utils/proxyFetch.js");
    const response = await proxyAwareFetch(
      "https://api.commandcode.ai/alpha/generate",
      { method: "POST", headers: { Authorization: "Bearer test" }, body: "{}" },
      null,
      { browser: "chrome_124", os: "macos", sessionScope: "connection-a" },
    );
    await proxyAwareFetch(
      "https://api.commandcode.ai/alpha/generate",
      { method: "POST", headers: { Authorization: "Bearer test-2" }, body: "{}" },
      null,
      { browser: "chrome_124", os: "macos", sessionScope: "connection-b" },
    );

    expect(response.status).toBe(200);
    expect(createSession).toHaveBeenCalledTimes(2);
    expect(createSession).toHaveBeenNthCalledWith(1, { browser: "chrome_124", os: "macos" });
    expect(createSession).toHaveBeenNthCalledWith(2, { browser: "chrome_124", os: "macos" });
    expect(sessionFetch).toHaveBeenCalledTimes(2);
    expect(nativeFetch).not.toHaveBeenCalled();
  });

  it("does not fall back to native fetch after a TLS POST starts", async () => {
    sessionFetch.mockRejectedValueOnce(new Error("socket closed"));
    const { proxyAwareFetch } = await import("../../open-sse/utils/proxyFetch.js");

    await expect(proxyAwareFetch(
      "https://api.commandcode.ai/alpha/generate",
      { method: "POST", body: "{}" },
      null,
      { browser: "chrome_124", os: "macos", sessionScope: "connection-b" },
    )).rejects.toMatchObject({ tlsFingerprintFailed: true });

    expect(nativeFetch).not.toHaveBeenCalled();
  });
});
