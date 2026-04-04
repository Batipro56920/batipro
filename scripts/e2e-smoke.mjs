import { spawn } from "node:child_process";

const host = "127.0.0.1";
const port = 4177;
const baseUrl = `http://${host}:${port}`;
const routes = ["/", "/login", "/dashboard", "/intervenant", "/acces/demo-token"];
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const devServerCommand = process.platform === "win32" ? "cmd.exe" : npmCmd;
const devServerArgs =
  process.platform === "win32"
    ? ["/d", "/s", "/c", npmCmd, "run", "dev", "--", "--host", host, "--port", String(port), "--strictPort"]
    : ["run", "dev", "--", "--host", host, "--port", String(port), "--strictPort"];

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status} sur ${baseUrl}`);
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }

  throw lastError instanceof Error ? lastError : new Error(`Serveur indisponible sur ${baseUrl}`);
}

async function assertRoute(route) {
  const response = await fetch(`${baseUrl}${route}`);
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Route ${route} KO: HTTP ${response.status}`);
  }
  if (!body.includes('<div id="root"></div>')) {
    throw new Error(`Route ${route} KO: shell React introuvable`);
  }
  if (!body.includes("/src/main.tsx")) {
    throw new Error(`Route ${route} KO: script Vite introuvable`);
  }

  console.log(`[OK] ${route}`);
}

function stopServer(child) {
  if (!child.pid) return Promise.resolve();

  if (process.platform !== "win32") {
    child.kill("SIGTERM");
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
    });
    killer.on("close", () => resolve());
    killer.on("error", () => resolve());
  });
}

async function main() {
  const child = spawn(devServerCommand, devServerArgs, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      BROWSER: "none",
      VITE_DISABLE_INTERVENANT_LEGACY_FALLBACK: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  let serverOutput = "";
  child.stdout.on("data", (chunk) => {
    serverOutput += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    serverOutput += String(chunk);
  });

  try {
    await waitForServer();
    for (const route of routes) {
      await assertRoute(route);
    }
    console.log("Smoke E2E OK.");
  } catch (error) {
    if (serverOutput.trim()) {
      console.error(serverOutput.trim());
    }
    throw error;
  } finally {
    await stopServer(child);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
