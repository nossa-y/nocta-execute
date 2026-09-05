# nocta-execute

A self-contained [Claude Code](https://claude.ai/code) skill that turns your agent into a
**computer-using browser agent**. You describe a task in plain language and it drives a
real Chrome window to do it - log into a site and grab something, fill and submit a form,
click through a flow, pull data off a page.

You invoke it with `/nocta-execute`.

```
/nocta-execute go to Hacker News and give me the titles of the top 5 posts
/nocta-execute log into my Reddit and download my saved posts
/nocta-execute fill out this signup form: name Jane, email jane@example.com
```

It's just a browser agent - no screen recording, no account, no cloud. Everything runs
locally and drives Chrome you can watch.

## How it works

- The skill (`SKILL.md`) teaches your agent how to drive a browser: open a page, read the
  interactive elements, click and type, expand collapsed content, work at a human pace.
- The browser itself is driven by a tiny bundled tool, `agent-browser`, built on
  [Playwright](https://playwright.dev). It opens **your installed Google Chrome** with a
  **persistent profile**, so once you log into a site you stay logged in on future runs.
- State persists between commands, so the agent works one step at a time and always reads
  the page before acting.

## Requirements

- macOS, Linux, or Windows
- [Node.js](https://nodejs.org) 18 or newer
- Google Chrome installed
- Claude Code (this is a Claude Code skill)

## Install

Two ways.

### A. Let your agent do it (easiest)

Open Claude Code and paste the prompt in [SETUP.md](SETUP.md). Your agent will clone this
repo, install it, and confirm `/nocta-execute` works.

### B. By hand

```sh
git clone https://github.com/nossa-y/nocta-execute.git
cd nocta-execute
bash install.sh
```

Then restart Claude Code so it picks up the new skill, and run `/nocta-execute <your task>`.

The installer:
1. runs `npm install` (Playwright - no separate browser download; it uses your Chrome),
2. symlinks the skill into `~/.claude/skills/nocta-execute`,
3. puts the `agent-browser` command on your PATH.

## Using the browser tool directly

The agent uses these, but you can too:

```sh
agent-browser open https://news.ycombinator.com   # open a page (launches Chrome)
agent-browser snapshot                             # list clickable/typeable elements, indexed
agent-browser click 3                              # click element #3 from the snapshot
agent-browser fill 1 "hello@example.com"           # type into an input
agent-browser press Enter
agent-browser text                                 # dump the page's visible text
agent-browser close
```

Options:
- `AGENT_BROWSER_HEADED=0` - run headless (invisible). Default is a visible window.
- `AGENT_BROWSER_SESSION=<name>` - run an isolated browser with its own window and profile,
  so two tasks or logins don't interfere.

## First-run logins

The first time a task needs a site you're not logged into, run it **visible** (the
default), log in inside the Chrome window that opens, and tell the agent to continue. The
profile is remembered, so you won't have to log in again.

## Where it keeps things

- Chrome profile + session state: `~/.nocta-execute/`
- Task patterns the agent writes as it learns your tasks: `~/.nocta-execute/actions/`

Nothing leaves your machine.

## License

MIT
