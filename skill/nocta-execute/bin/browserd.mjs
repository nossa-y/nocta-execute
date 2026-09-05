#!/usr/bin/env node
// Persistent browser daemon for the nocta-execute skill.
//
// Owns one Chromium context (the user's real Chrome, via a dedicated profile so
// logins persist across runs) and exposes simple commands over a local HTTP
// socket so the `agent-browser` CLI can drive it across separate invocations.
//
// Not launched directly - `agent-browser open` spawns it. See bin/agent-browser.mjs.

import http from "node:http";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error(
    "playwright is not installed. Run `npm install` in the skill directory first.",
  );
  process.exit(1);
}

const SESSION = process.env.AGENT_BROWSER_SESSION || "default";
const HEADED = process.env.AGENT_BROWSER_HEADED !== "0";
const IDLE_SHUTDOWN_MS = Number(process.env.AGENT_BROWSER_IDLE_MS || 15 * 60 * 1000);
const STATE_DIR = process.env.NOCTA_EXECUTE_HOME || path.join(os.homedir(), ".nocta-execute");
const PROFILE_DIR =
  process.env.AGENT_BROWSER_PROFILE || path.join(STATE_DIR, `profile-${SESSION}`);
const SESSION_FILE = path.join(STATE_DIR, `${SESSION}.json`);

mkdirSync(PROFILE_DIR, { recursive: true });

// A dedicated, non-throwaway Chrome profile keeps the user logged in between
// runs. `channel: "chrome"` uses the Chrome they already have installed.
const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  channel: "chrome",
  headless: !HEADED,
  viewport: HEADED ? null : { width: 1280, height: 900 },
  args: ["--no-first-run", "--no-default-browser-check"],
});

let page = context.pages()[0] || (await context.newPage());
let lastElements = []; // element handles from the most recent snapshot, for click-by-index

context.on("page", (p) => {
  page = p; // follow the newest tab (e.g. after a target=_blank click)
});

let idleTimer;
function touchIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => shutdown(0), IDLE_SHUTDOWN_MS);
}

const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "input:not([type=hidden])",
  "textarea",
  "select",
  "[role=button]",
  "[role=link]",
  "[role=menuitem]",
  "[role=tab]",
  "[role=checkbox]",
  "[role=option]",
  "[contenteditable=true]",
].join(",");

async function snapshot() {
  const title = await page.title().catch(() => "");
  const url = page.url();
  const handles = await page.$$(INTERACTIVE_SELECTOR);
  lastElements = [];
  const lines = [];
  for (const h of handles) {
    if (lines.length >= 200) break;
    const visible = await h.isVisible().catch(() => false);
    if (!visible) continue;
    const info = await h
      .evaluate((el) => {
        const t = (el.tagName || "").toLowerCase();
        const role =
          el.getAttribute("role") ||
          (t === "a" ? "link" : t === "button" ? "button" : t);
        const name = (
          el.getAttribute("aria-label") ||
          el.innerText ||
          el.value ||
          el.getAttribute("placeholder") ||
          el.getAttribute("title") ||
          ""
        )
          .trim()
          .replace(/\s+/g, " ")
          .slice(0, 100);
        return { role, name, type: el.getAttribute("type") || "" };
      })
      .catch(() => null);
    if (!info) continue;
    const idx = lastElements.length;
    lastElements.push(h);
    const typeStr = info.type ? ` type=${info.type}` : "";
    lines.push(`[${idx}] ${info.role}${typeStr} "${info.name}"`);
  }
  return `page: ${title}\nurl: ${url}\ninteractive elements (${lines.length}):\n${lines.join("\n")}`;
}

async function resolveTarget(arg) {
  if (arg === undefined || arg === null || arg === "")
    throw new Error("missing target");
  if (/^\d+$/.test(String(arg))) {
    const el = lastElements[Number(arg)];
    if (!el) throw new Error(`no element at index ${arg} - run snapshot first`);
    return el;
  }
  if (typeof arg === "object" && arg.selector) return page.locator(arg.selector).first();
  // treat as visible text / accessible name
  return page.getByText(String(arg), { exact: false }).first();
}

async function handle(cmd) {
  touchIdle();
  switch (cmd.cmd) {
    case "ping":
      return { ok: true, session: SESSION, headed: HEADED };
    case "goto": {
      await page.goto(cmd.url, { waitUntil: "domcontentloaded", timeout: 45000 });
      return { ok: true, url: page.url(), text: await snapshot() };
    }
    case "snapshot":
      return { ok: true, text: await snapshot() };
    case "click": {
      const el = await resolveTarget(cmd.target);
      await el.click({ timeout: 15000 });
      await page.waitForTimeout(300);
      return { ok: true, text: await snapshot() };
    }
    case "fill": {
      const el = await resolveTarget(cmd.target);
      await el.fill(cmd.text ?? "", { timeout: 15000 });
      return { ok: true };
    }
    case "type": {
      await page.keyboard.type(cmd.text ?? "", { delay: 40 });
      return { ok: true };
    }
    case "press": {
      await page.keyboard.press(cmd.key);
      await page.waitForTimeout(300);
      return { ok: true, text: await snapshot() };
    }
    case "text": {
      const body = await page.evaluate(() =>
        document.body ? document.body.innerText : "",
      );
      return { ok: true, text: body.slice(0, 20000) };
    }
    case "close":
      setTimeout(() => shutdown(0), 50);
      return { ok: true, closing: true };
    default:
      throw new Error(`unknown command: ${cmd.cmd}`);
  }
}

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", async () => {
    let out;
    try {
      const cmd = JSON.parse(body || "{}");
      out = await handle(cmd);
    } catch (error) {
      out = { ok: false, error: String(error?.message || error) };
    }
    res.writeHead(out.ok ? 200 : 500, { "content-type": "application/json" });
    res.end(JSON.stringify(out));
  });
});

async function shutdown(code) {
  try {
    rmSync(SESSION_FILE, { force: true });
  } catch {}
  try {
    await context.close();
  } catch {}
  process.exit(code);
}

process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));

server.listen(0, "127.0.0.1", () => {
  const { port } = server.address();
  writeFileSync(
    SESSION_FILE,
    JSON.stringify({ port, pid: process.pid, session: SESSION, headed: HEADED }),
  );
  touchIdle();
  // Signal readiness to the spawning CLI.
  console.log(`agent-browser daemon ready on 127.0.0.1:${port} (session=${SESSION})`);
});
