import { PROVIDERS } from "../providers/index.js";

const CACHE_TTL_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5_000;
let catalogCache = null;

export function parseCommandCodeModels(data) {
  const entries = Array.isArray(data) ? data : data?.data ?? data?.models ?? data?.results ?? [];
  if (!Array.isArray(entries)) return [];

  const seen = new Set();
  return entries.flatMap((raw) => {
    const item = typeof raw === "string" ? { id: raw } : raw;
    const id = typeof item?.id === "string" ? item.id.trim() : "";
    if (!id || seen.has(id)) return [];
    seen.add(id);

    const contextWindow = Number(item.context_length ?? item.contextLength);
    return [{
      id,
      name: item.name || id,
      ...(Number.isFinite(contextWindow) && contextWindow > 0
        ? { capabilities: { contextWindow } }
        : {}),
    }];
  });
}

export async function resolveCommandCodeModels(options = {}) {
  const now = Date.now();
  if (!options.forceRefresh && catalogCache?.expiresAt > now) {
    return { models: catalogCache.models };
  }

  try {
    const response = await (options.fetchFn || fetch)(PROVIDERS.commandcode.modelsUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: options.signal || AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const models = parseCommandCodeModels(await response.json());
    if (!models.length) return null;
    catalogCache = { expiresAt: now + CACHE_TTL_MS, models };
    return { models };
  } catch (error) {
    options.log?.warn?.("COMMANDCODE_MODELS", `Live model fetch failed: ${error?.message || error}`);
    return null;
  }
}

export function clearCommandCodeModelCache() {
  catalogCache = null;
}
