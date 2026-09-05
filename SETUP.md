# One-paste setup

Open Claude Code (in any folder) and paste the prompt below. Your agent will install the
skill and verify it.

---

```
Set up the "nocta-execute" browser-agent skill on my machine from its GitHub repo.

Do this:
1. Clone https://github.com/nossa-y/nocta-execute into ~/tools/nocta-execute
   (create the folder if needed; if it already exists, git pull instead).
2. Run `bash install.sh` in that directory. It installs Playwright, symlinks the skill
   into ~/.claude/skills/nocta-execute, and puts the `agent-browser` command on PATH.
3. Confirm Node.js is 18+ and Google Chrome is installed; if either is missing, tell me
   how to install it and stop.
4. Smoke-test it headless without touching my real Chrome windows:
     AGENT_BROWSER_HEADED=0 AGENT_BROWSER_SESSION=setuptest agent-browser open example.com
     AGENT_BROWSER_HEADED=0 AGENT_BROWSER_SESSION=setuptest agent-browser snapshot
     AGENT_BROWSER_HEADED=0 AGENT_BROWSER_SESSION=setuptest agent-browser close
   The snapshot should list a "Learn more" link. Then report success.
5. Tell me to restart Claude Code so it loads the new skill, and give me three example
   commands I can try with /nocta-execute.

Don't ask me questions unless step 3 fails - just set it up and report back.
```

---

After it finishes, restart Claude Code and try:

```
/nocta-execute go to Hacker News and give me the top 5 post titles
```
