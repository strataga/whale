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

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
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

async function statusNext() {
  const state = readState();
  if (state?.pid && isAlive(state.pid)) {
    return { running: true, pid: state.pid, port: state.port ?? null };
  }

  const out = await tryExecFile("lsof", ["-nP", ".next/dev/lock"]);
  if (!out) return { running: false };
  const pids = parseLsofPids(out);
  if (pids.length === 0) return { running: false };

  const pid = pids[0];
  const portsOut = await tryExecFile("lsof", [
    "-nP",
    "-a",
    "-p",
    String(pid),
    "-iTCP",
    "-sTCP:LISTEN",
  ]);
  let port = null;
  if (portsOut) {
    const lines = portsOut
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of lines.slice(1)) {
      const m = line.match(/TCP\s+\S+:(\d+)\s+\(LISTEN\)/);
      if (m) {
        port = Number(m[1]);
        break;
      }
    }
  }
  return { running: true, pid, port };
}

const next = await statusNext();

console.log("Dev status:");
console.log(
  `- next: ${
    next.running
      ? `running (pid ${next.pid}${next.port ? `, http://localhost:${next.port}` : ""})`
      : "not running"
  }`,
);
