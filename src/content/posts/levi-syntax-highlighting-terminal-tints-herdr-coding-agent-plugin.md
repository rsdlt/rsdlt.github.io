---
title: "Building levi, Sunday Morning: Syntax Colors, a Logo, and a Pick That Lands in Your Agent's Input"
pubDatetime: 2026-10-22T09:00:00-05:00
description: "levi 0.15 and 0.16: syntax colors that follow your terminal's theme, tints mixed from its background, a measured README, and a herdr plugin that hands a commit to a coding agent."
tags: ["levi", "rust", "git", "tui", "ratatui", "herdr", "claude code", "ai coding agents"]
---

This is the sixth post in the [Building levi](/levi/) series. The [previous one](/posts/levi-clipboard-osc-52-filter-mode-open-in-editor-rust-tui/) ended on Saturday night with 0.14.1. You could copy what you found, open it in your editor, and let an agent search with `levi --filter`. The session on Sunday morning, October 18, from 09:04 to 12:47, did two things: it made diffs easier to read, and it closed the loop from you to your agent.

It shipped 0.15.0 and 0.16.0, grew the test suite from 102 tests to 115, and gave levi a logo, a shorter README and a plugin for [herdr](https://herdr.dev).

## Syntax colors, in the terminal's own palette

Syntax highlighting was out of scope in levi's plan from day one. The commit that added it says why that changed: reading a big repository under heavy agent-driven change showed how much colors matter. The scope stayed tight anyway: no themes, no settings, no per-language tweaks.

- **[syntect](https://github.com/trishume/syntect) for parsing only.** levi uses its bundled grammars and its pure-Rust regex engine, so there's no C library to build.
- **Each side of a hunk is colored on its own.** The old lines are parsed as the old version of the file reads, and the new lines as the new one.
- **The terminal's 16 colors, one fixed mapping.** Comments, strings, keywords, functions and types each get one of the terminal's own colors, so they follow its theme, dark or light.
- **A colored bar marks the change.** With the code in syntax colors, a solid green or red bar in the `+`/`-` column says added or removed, and removed lines are dimmed. Changed words and `/c` matches stay on top. Languages syntect doesn't know keep the plain green and red look.

Coloring isn't free: about a second for a 30,000-line diff. So the diff worker sends every diff plain at once, then colored right after, replacing it in place. A newer request cuts the coloring short, and up to 16 interrupted diffs are finished when the worker is idle. A 1 MiB budget per diff and a 1,000-byte cap per line bound the work, and the grammars load in the background at startup.

The cost shows up in the binary: from 1.7 MB to 4.3 MB, mostly grammars. syntect decodes them with bincode 1.3.3, which RustSec flags as unmaintained. The advisory is informational, its authors call the crate complete, and levi's `deny.toml` records the exception with that reasoning.

## Tints mixed from your background

Sixteen minutes later, changed lines got a soft background. On terminals that show truecolor, added and removed rows get a faint green or red across the whole row, and the changed words a stronger one in place of reverse video.

A fixed green looks loud on a light theme and murky on a dark one. levi mixes the tint from the terminal's actual background instead:

```rust
/// How much green or red goes into a changed line's background, and into the
/// background of the words that changed in it.
const LINE: f32 = 0.13;
const WORDS: f32 = 0.32;

/// `amount` of `hue` over `bg`.
fn mix(bg: Rgb, hue: Rgb, amount: f32) -> Rgb {
    let channel =
        |b: u8, h: u8| (f32::from(b) + (f32::from(h) - f32::from(b)) * amount).round() as u8;
    (
        channel(bg.0, hue.0),
        channel(bg.1, hue.1),
        channel(bg.2, hue.2),
    )
}
```

That needs the background's exact color, which only the terminal knows. levi asks once at startup, with two escape sequences:

1. **OSC 11** asks for the background color.
2. **DA1** asks for the device attributes, which every terminal answers. Terminals answer in order, so once the DA1 reply is in, any OSC 11 reply already is too. A terminal that ignores OSC 11 costs no wait, and levi gives up after 100 ms at most.

Both questions go out on stderr, never stdout, which in `$(levi)` carries the sha. No answer, no truecolor, or `NO_COLOR` set means no tints, and there's no setting.

### macOS poll() and the stolen keystroke

Reading the reply hit a platform quirk. levi read it from `/dev/tty`, waiting with `poll()`. On macOS, `poll()` doesn't support terminal devices and reports them readable at once, so the read blocked until you pressed a key, then swallowed that key as part of the "reply". The fix waits with `select()` instead, which works on terminals:

```rust
/// Waits up to `wait` for something to read. `select`, not `poll`: macOS's
/// `poll` doesn't support terminals and claims they're readable at once,
/// so the read would block until a key came and take it.
fn readable(tty: &File, wait: Duration) -> bool {
```

`libc` became a direct dependency on Unix. It was already in the tree through crossterm, so the binary didn't grow.

## A README with numbers

With colors in, the demo GIF was re-recorded with truecolor on, and the README got rewritten. It had grown to mix the user guide with internals and explained `/c` four times. The rewrite cut it to half the length. The Neovim recipe moved to `docs/neovim.md`, maintainer notes to `CONTRIBUTING.md`, and internals stayed in `docs/plan.md`.

It also gained a "Why levi" section and a "Speed" section, measured against the git command that does the same job. The setup is in the plan: git.git at 82,513 commits on an Apple M4 Pro (12 cores), median of 3 runs after a warm-up, all through `levi --filter`:

| Job | levi | git |
| --- | --- | --- |
| Load all history, with the files each commit touched | 0.86 s | 2.82 s, `git log --name-status` |
| Search every diff for a line of code | 6.6 s, 12 commits | 19.1 s, `git log -i -G`, 6 commits |
| Search one file's history | 1.12 s, 2 commits | 0.49 s, 1 commit |

The plan records the row where git wins, too. `--filter` loads all history first, and the fuzzy `parse.c` also matches `parse-options.c` and others. In the TUI, the history is already loaded. The README links the method so anyone can rerun the comparison on their own repository. The extra commits levi finds are merges: `git log -G` skips them, and levi diffs them against their first parent.

0.15.0 nearly shipped with a stray file. `Cargo.toml` listed what to exclude from the crate, so any untracked file went into the package, and `cargo publish` caught a local skill folder on its way to crates.io. The manifest now lists what goes in instead, anchored at the root: sources, tests, the Cargo files, README, changelog and license.

## A logo and a title card

levi got a logo at 11:37: two slim blades crossed over a commit graph, in levi's cyan, as a 4 KB SVG. It draws both blades out in full instead of reusing one through `<use>`, so every renderer shows it the same, and it reads on GitHub's light and dark themes.

The demo GIF now opens with a two-second title card of the logo, the name and the tagline. A script builds it in three steps: [vhs](https://github.com/charmbracelet/vhs) records the demo, `rsvg-convert` renders the card from an SVG that pulls in the logo, and ffmpeg fades one into the other with a single palette, so the syntax colors and tints keep their look.

## Handing a find to your agent

### The options

The session opened at 09:04 with a plan commit, before any code: how should what you see in levi reach a coding agent? `levi --filter` already covered the agent asking. The other direction, you telling the agent "look at this", had three candidate shapes:

- **`levi --focus`, agents pull.** A running levi keeps a small note of what it shows, and `levi --focus` prints it, so "look at what I have open in levi" works with any agent that runs commands.
- **Copy a reference.** One key copies the commit, path and lines for you to paste. Small, but still a paste.
- **Launch the agent,** like `Ctrl-O` launches the editor. That starts a new session each time, and needs agent-specific command lines: the least levi-like.

Typing into an agent that's already running wasn't on the list, because Claude Code has no public way for another program to do it.

### herdr can type into an agent

I run my agents in herdr, a terminal workspace manager for AI coding agents, and herdr can type into an agent's pane. That made the missing option possible, and it superseded `--focus`. It took two pieces.

**`levi --pick-context`** changes only what `Enter` prints: one line naming the commit, and, with a file selected, its path and the file lines in view, or under the drag selection:

```
commit d3a93ab ("Stack the lists above the diff on narrow terminals"), src/ui.rs lines 27-40
```

The line numbers come from the hunk headers, as `Ctrl-O`'s do, and from the old side for a deleted file. One small change made the drag selection usable: keys used to clear the selection before they were handled, and now they clear it after, so `Enter` still sees it.

**A herdr plugin** builds on it. From an agent's pane, a key opens levi in a popup, in the agent's repository. On `Enter`, the reference goes into the agent's input, unsent, and you finish the question:

```
In commit d3a93ab ("Stack the lists above the diff on narrow terminals"), src/ui.rs lines 27-40: why 120?
```

The plugin is a manifest and a POSIX shell script, so there's nothing to build. The heart of the script is a few lines:

```sh
# Simplified from herdr/levi-herdr.sh
picked=$(levi --pick-context)
case $? in
    0) ;;
    130) exit 0 ;; # quit without picking
    *) fail "" ;;  # levi said why on the screen already
esac

"$herdr" pane send-text "$target" "In $picked: " >/dev/null
```

It refuses a pane that isn't running an agent and says why, does nothing when you quit levi without a pick, and keeps the popup open on errors until you've read them. The exit code 130 for "quit without picking" came from night one, copied from fzf, and paid off here. herdr plugins can't bind keys, so the README shows the three lines to add to herdr's `config.toml`.

0.16.0 shipped at 12:16. The demo GIF then got a herdr segment, with a stand-in "agent" that's only an input line and never answers, so the GIF doesn't pass off a made-up reply as an agent's. The plugin got its own README for visitors who land in its folder from herdr's marketplace.

The next morning, levi also got a social preview image for GitHub, which Reddit, Slack and other sites use as the link thumbnail.

## How Claude Code fit in

- **The plan came first, and kept the rejected options.** The agent-handoff options went into `docs/plan.md` before any code. When herdr made a better one possible, `--focus` was marked superseded instead of deleted, with its reasoning kept.
- **Scope stayed written down.** Syntax colors went in with an explicit "no themes, no settings" in the commit and the plan, and the binary size cost is in the commit message.
- **Benchmarks the reader can rerun.** Every number in the README comes from `levi --filter`, with the setup and the row where git wins recorded in the plan.
- **Testing near real agents, never on them.** The herdr plugin was tested against a throwaway herdr tab registered as an agent, never against a live session, and herdr validated the manifest before it shipped.
- **Packaging checks paid off.** `cargo publish`'s own packaging step caught the stray file, and the fix made the crate's contents explicit.

## Takeaways

- **Borrow the user's palette.** The terminal's 16 colors and a tint mixed from its background suit every theme without a single setting.
- **Ask the terminal a question it always answers.** Following OSC 11 with DA1 bounds the wait without guessing at timeouts.
- **Publish the benchmark you lose.** The one-file row makes the other numbers more believable.
- **List what goes into a package, not what stays out.** An allowlist can't pick up a stray file.
- **Use the platform that can do what yours can't.** No agent accepts input from another program, but herdr can type into its pane, so a 61-line shell script closed the loop.

levi is at 0.16.0, and the series continues as it grows.

---

*I'm Rodrigo Santiago, a product leader who builds. I co-founded [Foambyte](https://foambyte.com) with my brother Diego, a brewmaster who leads the product as CPO, and I designed and built the platform: architecture, frontend, backend, mobile and infrastructure. If you need someone who can own both the product and the code, [let's talk on LinkedIn](https://www.linkedin.com/in/rsdlt).*
