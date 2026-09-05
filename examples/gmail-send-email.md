# Example action pattern: send a Gmail email

This is a sample of the little pattern files the skill writes to
`~/.nocta-execute/actions/` as it learns your tasks. When you ask for the same kind of
task again, the agent reads the matching file and moves faster.

Copy this format for your own tasks.

---

**What it does:** Compose and send an email in Gmail (web).

**Prerequisite:** Logged into Gmail in the persistent browser profile. First time, run
visible and complete the login in the Chrome window.

**Steps:**

```bash
# Open a compose window directly (faster than clicking Compose):
agent-browser open "https://mail.google.com/mail/u/0/#inbox?compose=new"
agent-browser snapshot

# Fill the recipient, subject, and body by their snapshot indexes.
# (Re-snapshot after opening compose - indexes change per page.)
agent-browser fill <to-index> "someone@example.com"
agent-browser fill <subject-index> "Subject line here"
agent-browser fill <body-index> "Body of the message."

# Send with the keyboard shortcut Gmail supports:
agent-browser press "Meta+Enter"   # Cmd+Enter on macOS; use "Control+Enter" on Linux/Windows
agent-browser snapshot             # confirm the "Message sent" state
```

**Gotchas:**
- Gmail's compose fields are React-driven: use `fill`, not `type`.
- The body field is a `contenteditable`, not an `<input>` - it still shows up in the
  snapshot; fill it by its index.
- If the send shortcut doesn't fire, `snapshot` and click the "Send" button by index.
