import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const buildHome = mkdtempSync(join(tmpdir(), "9router-build-"));

try {
  const result = spawnSync(
    process.execPath,
    [join("node_modules", "next", "dist", "bin", "next"), "build", "--webpack"],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        HOME: buildHome,
        USERPROFILE: buildHome,
        APPDATA: buildHome,
        LOCALAPPDATA: buildHome,
      },
    },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(buildHome, { recursive: true, force: true });
}
