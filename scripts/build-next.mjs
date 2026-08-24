import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const buildHomeRoot = join(process.cwd(), "cli", ".build-home");
mkdirSync(buildHomeRoot, { recursive: true });
const buildHome = mkdtempSync(join(buildHomeRoot, "build-"));
const appData = join(buildHome, "AppData", "Roaming");
const localAppData = join(buildHome, "AppData", "Local");
mkdirSync(appData, { recursive: true });
mkdirSync(localAppData, { recursive: true });

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
        APPDATA: appData,
        LOCALAPPDATA: localAppData,
      },
    },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(buildHome, { recursive: true, force: true });
}
