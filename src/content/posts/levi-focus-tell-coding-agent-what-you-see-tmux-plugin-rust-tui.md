---
title: "Building levi, Wednesday: Telling Any Coding Agent What You Have Open, With levi --focus and tmux"
pubDatetime: 2026-10-25T09:00:00-05:00
description: "levi 0.20: levi --focus prints what an open levi shows, so any agent can look at your screen, and a tmux plugin types a commit reference into an agent's pane."
tags: ["levi", "rust", "git", "tui", "tmux", "cli", "claude code", "ai coding agents"]
---

This is the ninth post in the [Building levi](/levi/) series. The [previous one](/posts/levi-uncommitted-changes-git-working-tree-without-writing-index/) covered Tuesday's 0.19.0: uncommitted changes as a row on top of the log, read without ever writing to `.git`. On Wednesday, October 21, one feature commit at 16:44 and a release at 19:06 shipped 0.20.0. It brought back an idea the plan had marked superseded, `levi --focus`, and added a tmux plugin next to the herdr one.

The test suite grew from 147 tests to 151.

## An option the plan kept

On [Sunday](/posts/levi-syntax-highlighting-terminal-tints-herdr-coding-agent-plugin/), the plan listed three ways to hand what you see in levi to a coding agent. One was `levi --focus`: a running levi keeps a note of what it shows, and `levi --focus` prints it, so any agent that runs commands can read it. The herdr plugin won instead, and `--focus` was marked "Superseded by the herdr plugin" in `docs/plan.md`, with its reasoning kept.

On Wednesday it came back. The herdr plugin only helps people who run their agents in herdr. `--focus` works for any agent, in or out of a terminal multiplexer, in the session you already have. The plan's entry now reads "Done three ways": the herdr and tmux plugins push a reference into the agent's input, and `--focus` lets the agent pull it.

## `levi --focus`

Keep levi open in one pane and your agent in another. The agent runs one command and gets what's on your screen:

```sh
$ levi --focus
commit d3a93ab ("Stack the lists above the diff on narrow terminals"), src/ui.rs lines 27-40
```

It's the same line `--pick-context` prints on `Enter`: the commit, and with a file selected, its path and the lines in view, or the ones under a drag. The README's suggested `CLAUDE.md` / `AGENTS.md` brief grew by one sentence:

```
When I say "what I have open in levi", run `levi --focus`: it prints the commit, file and lines I'm looking at.
```

So "why is the layout stacking in what I have open in levi?" works without copying a sha or a path. The exit codes follow `--filter`'s pattern: 0 with the reference on stdout, 1 when no levi is open in the repository, 2 outside one.

## A note that never touches the repository

The idea needed one change from its original sketch. On Sunday, the plan put the note "e.g. under `.git/`". Since Tuesday, levi promises it never writes to your repository, with a test that checks it byte for byte. So the note moved to the temp directory, one per repository:

```rust
/// Where the note for the repository at `root` goes. The name hashes the path,
/// so worktrees of one repository each get their own.
fn path(root: &Path) -> PathBuf {
    let root = root.canonicalize().unwrap_or_else(|_| root.to_owned());
    std::env::temp_dir().join(format!("levi-focus-{:016x}", fnv(&root)))
}
```

A few details from `src/focus.rs` and the plan:

- **A stable hash.** The file name uses FNV-1a of the canonical path, not Rust's standard hasher, which isn't stable across builds. Two levi binaries of different versions agree on where a repository's note lives.
- **Never half a note.** levi writes to a temporary name, then renames it into place, so `--focus` can't read a file mid-write. The file is mode 0600.
- **Written only on change.** The TUI rewrites the note after a frame whose reference changed, right after the draw, which measures the diff pane the line numbers come from.
- **The last levi wins.** With two levis open on one repository, the note belongs to whichever changed last, which is the one being used.

### Notes left behind

levi removes its note on exit. A levi that's killed, or whose terminal closes, skips that cleanup and leaves a stale note. So the note's first line is the process id, and `--focus` checks that the process still exists:

```rust
#[cfg(unix)]
fn alive(pid: u32) -> bool {
    let Ok(pid) = libc::pid_t::try_from(pid) else {
        return false;
    };
    // Signal 0 only asks whether the process exists. EPERM: it does, as
    // someone else's.
    let found = unsafe { libc::kill(pid, 0) } == 0;
    found || std::io::Error::last_os_error().raw_os_error() == Some(libc::EPERM)
}
```

A note whose levi is gone counts as none. On exit, levi also removes the note only if it's still its own, so closing one levi doesn't erase another's.

Three of the four new tests cover this file: a note reads back until it's removed, each repository has its own note, and another levi's note stays until that levi is gone. That last test uses its own parent's process id as a "levi that's still running" and 4,000,000,000 as one that isn't, since no process has an id that high. The fourth, in `tests/cli.rs`, runs the real binary: exit 1 with "no levi is open in …" inside a repository, exit 2 outside one.

## A tmux plugin

The herdr plugin from Sunday types a reference into an agent's input. The tmux plugin does the same in [tmux](https://github.com/tmux/tmux) 3.2 or newer. With [TPM](https://github.com/tmux-plugins/tpm), it's one line in `tmux.conf`:

```tmux
set -g @plugin 'rsdlt/levi'
```

In your agent's pane, `prefix G` opens levi in a popup over it, in the pane's directory. Pick the commit, the file and the lines, press `Enter`, and the reference lands in the agent's input, unsent:

```
In commit d3a93ab ("Stack the lists above the diff on narrow terminals"), src/ui.rs lines 27-40: why 120?
```

TPM runs `levi.tmux` from the repository root, which binds the key:

```sh
# Simplified from levi.tmux
key=$(tmux show-option -gqv @levi-key)
[ -n "$key" ] || key=G

tmux bind-key "$key" display-popup -E -w 90% -h 85% -d '#{pane_current_path}' \
    "sh '$dir/tmux/levi-tmux.sh'"
```

The key is capital `G` because, per the plan, tmux 3.8 binds `g` already. `@levi-key` picks another one.

### Finding the pane under the popup

The script needs the id of the pane to type into, and tmux doesn't expand formats like `#{pane_id}` in a popup's command, only in its `-d` directory. The plan records the way around it: inside a popup, `tmux display-message -p '#{pane_id}'` answers with the pane under it.

```sh
# Simplified from tmux/levi-tmux.sh
target=$(tmux display-message -p '#{pane_id}')

picked=$(levi --pick-context)
case $? in
    0) ;;
    130) exit 0 ;; # quit without picking
    *) fail "" ;;  # levi said why on the screen already
esac

# -l types the text as it is, so nothing in it is read as a key name.
tmux send-keys -t "$target" -l "In $picked: "
```

The shape matches the herdr script, down to exit code 130 for "quit without picking". One difference: herdr knows which panes run an agent and refuses the others. tmux can't tell an agent from a shell, so the plugin types into whatever pane you pressed the key in. The plugin's README is upfront about it: the text is never sent, "so a wrong pane costs a `C-u`."

## A badge

The evening before, a one-line commit added a badge for The Terminal Index to the README, next to the CI badge, linking to levi's page there. It closed levi's issue #1.

## How Claude Code fit in

- **The rejected option was still on file.** `--focus` had been marked superseded, not deleted, with its design written out. Bringing it back meant updating that entry, not rediscovering it.
- **An old sketch, checked against a new promise.** The original plan put the note under `.git/`. Tuesday's "levi never writes to your repository" ruled that out, and the note moved to the temp directory.
- **Workarounds written where the next person looks.** That tmux won't expand `#{pane_id}` in a popup's command is in the plan and in a comment in the script, next to the line that works around it.
- **One feature commit, one release.** The commit carried the code, tests, plan, README, changelog and the tmux plugin's own README. The release commit only moved the version and the changelog heading.

## Takeaways

- **Keep rejected designs with their reasons.** A "superseded" entry, written out in full, is a ready design when the situation changes.
- **Offer both push and pull.** Plugins that type into an agent's pane suit people who use those tools. A command any agent can run covers everyone else.
- **Sign shared state files with a process id.** `kill(pid, 0)` turns a stale file from a crashed process into "nothing here" without a cleanup daemon.
- **Write to a temp name, then rename.** A reader never sees half a file, and it costs one extra call.
- **Use a stable hash for names that outlive a build.** Rust's standard hasher can change between builds; FNV-1a is a few lines and never does.

levi is at 0.20.0, and the series continues as it grows.

---

*I'm Rodrigo Santiago, a product leader who builds. I co-founded [Foambyte](https://foambyte.com) with my brother Diego, a brewmaster who leads the product as CPO, and I designed and built the platform: architecture, frontend, backend, mobile and infrastructure. If you need someone who can own both the product and the code, [let's talk on LinkedIn](https://www.linkedin.com/in/rsdlt).*
