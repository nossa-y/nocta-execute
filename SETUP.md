# One-paste setup

Open Claude Code (in any folder) and paste the prompt below. Your agent will clone,
install, and verify the skill for you - no manual steps.

---

```
Set up the "nocta-execute" browser-agent skill on this machine from GitHub. Work
autonomously and only stop to ask me something if step 1 fails.

1. Check prerequisites: Node.js 18+ (`node -v`) and Google Chrome installed. If either
   is missing, tell me exactly how to install it for my operating system, then stop.
2. Clone https://github.com/nossa-y/nocta-execute into ~/tools/nocta-execute. If that
   folder already exists, `git pull` in it instead of cloning.
3. From that directory run: bash install.sh
   It installs Playwright, symlinks the skill into ~/.claude/skills/nocta-execute, and
   tries to put the `agent-browser` command on my PATH. If the PATH step is skipped for
   permissions, that is fine - the skill also calls the script by its full path.
4. Verify it drives a browser, headless so no window pops up:
     AGENT_BROWSER_HEADED=0 AGENT_BROWSER_SESSION=setuptest agent-browser open example.com
     AGENT_BROWSER_HEADED=0 AGENT_BROWSER_SESSION=setuptest agent-browser snapshot
     AGENT_BROWSER_HEADED=0 AGENT_BROWSER_SESSION=setuptest agent-browser close
   The snapshot must list a "Learn more" link. If `agent-browser` is not found, use
   `node ~/.claude/skills/nocta-execute/bin/agent-browser.mjs <command>` for these checks.
5. Report the result, tell me to restart Claude Code so it loads the new skill, and give
   me three example commands to try with /nocta-execute.
```

---

After it finishes, restart Claude Code and try:

```
/nocta-execute go to Hacker News and give me the top 5 post titles
```
