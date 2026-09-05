#!/usr/bin/env node
// agent-browser: a tiny command-line driver for a real Chrome window.
//
// State (the open page) is kept alive by a background daemon (browserd.mjs), so
// successive commands - open, snapshot, click, fill - act on the same page.
//
//   agent-browser open <url>        open a page (starts the browser if needed)
//   agent-browser snapshot          list the page's interactive elements, indexed
//   agent-browser click <index|text>  click an element (index from snapshot, or visible text)
//   agent-browser fill <index|text> <value>   type into an input
//   agent-browser type <value>      type at the current focus
//   agent-browser press <key>       press a key (e.g. Enter)
//   agent-browser text              dump the page's visible text
//   agent-browser close             close the browser
//
// Env:
//   AGENT_BROWSER_SESSION=<name>    isolate a named browser (default: "default")
//   AGENT_BROWSER_HEADED=0          run headless (default: visible)

import { spawn } from "node:child_process";
import { readFileSync, existsSync, rmSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SESSION = process.env.AGENT_BROWSER_SESSION || "default";
const STATE_DIR = process.env.NOCTA_EXECUTE_HOME || path.join(os.homedir(), ".nocta-execute");
const SESSION_FILE = path.join(STATE_DIR, `${SESSION}.json`);

function usage(code = 0) {
  console.log(
    `agent-browser <command> [args]

  open <url>            open a URL (launches Chrome if not running)
  snapshot              list interactive elements on the page, indexed
  click <index|text>    click an element by snapshot index or visible text
  fill <index|text> <value>   fill an input by index or its label/placeholder text
  type <value>          type text at the current focus
  press <key>           press a key (Enter, Tab, Escape, ...)
  text                  print the page's visible text
  close                 close the browser

Env: AGENT_BROWSER_SESSION=<name> (isolate a browser), AGENT_BROWSER_HEADED=0 (headless).`,
  );
  process.exit(code);
}

function post(port, payload, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method: "POST",
        path: "/",
        headers: { "content-type": "application/json", "content-length": Buffer.byteLength(data) },
        timeout: timeoutMs,
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body || "{}"));
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("request timed out")));
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function readSession() {
  if (!existsSync(SESSION_FILE)) return null;
  try {
    return JSON.parse(readFileSync(SESSION_FILE, "utf8"));
  } catch {
    return null;
  }
}

async function daemonAlive() {
  const s = readSession();
  if (!s?.port) return null;
  try {
    const r = await post(s.port, { cmd: "ping" }, 2000);
    return r?.ok ? s : null;
  } catch {
    return null;
  }
}

async function ensureDaemon() {
  const alive = await daemonAlive();
  if (alive) return alive;
  // Spawn the daemon detached so it outlives this CLI process.
  const child = spawn(process.execPath, [path.join(HERE, "browserd.mjs")], {
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  child.unref();
  // Wait for it to write its session file and answer a ping.
  for (let i = 0; i < 100; i += 1) {
    await new Promise((r) => setTimeout(r, 200));
    const s = await daemonAlive();
    if (s) return s;
  }
  throw new Error("browser daemon failed to start (is playwright installed? run `npm install`)");
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === "help" || cmd === "-h" || cmd === "--help") usage(0);

  if (cmd === "open") {
    const url = rest[0];
    if (!url) usage(1);
    const s = await ensureDaemon();
    const r = await post(s.port, { cmd: "goto", url: normalizeUrl(url) });
    return report(r);
  }

  if (cmd === "close") {
    const s = readSession();
    if (!s?.port) {
      console.log("no browser running.");
      return;
    }
    try {
      await post(s.port, { cmd: "close" }, 5000);
    } catch {}
    try {
      rmSync(SESSION_FILE, { force: true });
    } catch {}
    console.log("closed.");
    return;
  }

  // All other commands require a running daemon.
  const s = await daemonAlive();
  if (!s) {
    console.error("no browser open. Run `agent-browser open <url>` first.");
    process.exit(1);
  }

  switch (cmd) {
    case "snapshot":
      return report(await post(s.port, { cmd: "snapshot" }));
    case "text":
      return report(await post(s.port, { cmd: "text" }));
    case "click":
      return report(await post(s.port, { cmd: "click", target: rest[0] }));
    case "press":
      return report(await post(s.port, { cmd: "press", key: rest[0] || "Enter" }));
    case "type":
      return report(await post(s.port, { cmd: "type", text: rest.join(" ") }));
    case "fill": {
      const target = rest[0];
      const text = rest.slice(1).join(" ");
      return report(await post(s.port, { cmd: "fill", target, text }));
    }
    default:
      console.error(`unknown command: ${cmd}\n`);
      usage(1);
  }
}

function normalizeUrl(u) {
  if (/^https?:\/\//i.test(u)) return u;
  if (/^[\w.-]+\.\w{2,}([/?#].*)?$/.test(u)) return `https://${u}`;
  return u;
}

function report(r) {
  if (!r) return;
  if (r.ok === false) {
    console.error(`error: ${r.error}`);
    process.exit(1);
  }
  if (r.text) console.log(r.text);
  else console.log(JSON.stringify(r));
}

main().catch((e) => {
  console.error(`error: ${e?.message || e}`);
  process.exit(1);
});
