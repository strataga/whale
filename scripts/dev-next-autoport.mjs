import net from "node:net";
import { spawn, execFile } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

function parseArgs(argv) {
  const out = { port: null, host: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--port" || a === "-p") {
      const v = argv[i + 1];
      if (v) out.port = Number(v);
      i += 1;
      continue;
    }
    if (typeof a === "string" && a.startsWith("--port=")) {
      out.port = Number(a.slice("--port=".length));
      continue;
    }
    if (a === "--host" || a === "-H") {
      const v = argv[i + 1];
      if (v) out.host = String(v);
      i += 1;
      continue;
    }
    if (typeof a === "string" && a.startsWith("--host=")) {
      out.host = String(a.slice("--host=".length));
      continue;
    }
  }
  return out;
}

const STATE_FILE = ".dev-next.json";

function readState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    return null;
  }
}

function writeState(state) {
  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function pickFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    // Bind without host so we detect conflicts on ::/0.0.0.0 like Next does.
    srv.listen(0);
    srv.on("listening", () => {
      const addr = srv.address();
      if (!addr || typeof addr === "string") {
        srv.close(() => reject(new Error("Unable to determine free port")));
        return;
      }
      srv.close(() => resolve(addr.port));
    });
    srv.on("error", reject);
  });
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", (err) => {
      if (err && err.code === "EADDRINUSE") resolve(false);
      else resolve(false);
    });
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port);
  });
}

async function pickPreferredPort() {
  // Keep Whale off the 3000-range to avoid colliding with Strataga/OpenClaw projects.
  for (let p = 3100; p <= 3199; p += 1) {
    if (await isPortFree(p)) return p;
  }
  return pickFreePort();
}

function tryExecFile(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { encoding: "utf8" }, (err, stdout) => {
      if (err) return resolve(null);
      resolve(stdout);
    });
  });
}

async function getRunningNextPidHoldingLock() {
  const out = await tryExecFile("lsof", ["-nP", ".next/dev/lock"]);
  if (!out) return null;
  const lines = out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines.slice(1)) {
    const cols = line.split(/\s+/);
    const pid = Number(cols[1]);
    if (Number.isFinite(pid) && pid > 0) return pid;
  }
  return null;
}

async function getListeningPort(pid) {
  const out = await tryExecFile("lsof", [
    "-nP",
    "-a",
    "-p",
    String(pid),
    "-iTCP",
    "-sTCP:LISTEN",
  ]);
  if (!out) return null;
  const lines = out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines.slice(1)) {
    const m = line.match(/TCP\s+\S+:(\d+)\s+\(LISTEN\)/);
    if (m) return Number(m[1]);
  }
  return null;
}

const runningPid = await getRunningNextPidHoldingLock();
if (runningPid) {
  const runningPort = await getListeningPort(runningPid);
  const url = runningPort ? `http://localhost:${runningPort}` : null;
  console.error(
    `[dev] Next.js dev server is already running (pid ${runningPid})${
      url ? ` at ${url}` : ""
    }.`,
  );
  console.error(`[dev] Stop it with: pnpm dev:stop`);
  process.exit(1);
}

const existing = readState();
if (existing?.pid && isAlive(existing.pid) && existing?.port) {
  console.error(
    `[dev] Whale is already running (pid ${existing.pid}) at http://localhost:${existing.port}.`,
  );
  console.error(`[dev] Stop it with: pnpm dev:stop`);
  process.exit(1);
}

let port;
const cli = parseArgs(process.argv.slice(2));
const requestedRaw = cli.port ?? (process.env.PORT ? Number(process.env.PORT) : null);
const requested =
  requestedRaw && Number.isInteger(requestedRaw) && requestedRaw > 0
    ? requestedRaw
    : null;
if (requested && Number.isInteger(requested) && requested > 0) {
  port = (await isPortFree(requested)) ? requested : await pickPreferredPort();
  if (port !== requested) {
    console.warn(`[dev] PORT ${requested} is in use; picked ${port} instead`);
  }
} else {
  port = await pickPreferredPort();
}

const host = cli.host ?? process.env.HOST ?? "::";

console.log(`[dev] Next.js will start on:`);
console.log(`  http://localhost:${port}`);
console.log(`  http://127.0.0.1:${port}`);

const child = spawn(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  ["exec", "next", "dev", "-H", host, "-p", String(port)],
  { stdio: "inherit", env: { ...process.env, PORT: String(port) } },
);

writeState({ pid: child.pid, port, host, startedAt: new Date().toISOString() });

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
