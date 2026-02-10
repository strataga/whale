import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";

function tryExecFile(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { encoding: "utf8" }, (err, stdout) => {
      if (err) return resolve(null);
      resolve(stdout);
    });
  });
}

function readState() {
  try {
    return JSON.parse(readFileSync(".dev-next.json", "utf8"));
  } catch {
    return null;
  }
}

function parseLsofPids(stdout) {
  const lines = stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const pids = new Set();
  for (const line of lines.slice(1)) {
    const cols = line.split(/\s+/);
    const pid = Number(cols[1]);
    if (Number.isFinite(pid) && pid > 0) pids.add(pid);
  }
  return [...pids];
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function killPid(pid) {
  if (!pid || !isAlive(pid)) return false;
  console.log(`Stopping Next.js dev server (pid ${pid})...`);

  try {
    process.kill(pid, "SIGTERM");
  } catch (e) {
    console.warn(`Failed to SIGTERM ${pid}: ${e?.message || e}`);
    return false;
  }

  const start = Date.now();
  while (Date.now() - start < 1500) {
    if (!isAlive(pid)) return true;
    await new Promise((r) => setTimeout(r, 150));
  }

  try {
    process.kill(pid, "SIGKILL");
  } catch (e) {
    console.warn(`Failed to SIGKILL ${pid}: ${e?.message || e}`);
    return false;
  }
  return true;
}

async function findNextPid() {
  const state = readState();
  if (state?.pid && isAlive(state.pid)) return state.pid;

  const out = await tryExecFile("lsof", ["-nP", ".next/dev/lock"]);
  if (!out) return null;
  const pids = parseLsofPids(out);
  return pids[0] ?? null;
}

const pid = await findNextPid();
const stopped = await killPid(pid);
if (!stopped) console.log("Nothing to stop.");
