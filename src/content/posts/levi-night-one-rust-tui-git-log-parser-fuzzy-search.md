---
title: "Building levi, Night One: From First Commit to 0.1.0 in 90 Minutes"
pubDatetime: 2026-10-18T09:00:00-05:00
description: "The first session of building levi with Claude Code: parsing git log as a stream, a three-pane TUI on stderr, background loading, fuzzy search on every core, and CI."
tags: ["levi", "rust", "git", "tui", "ratatui", "performance", "claude code", "ai coding agents"]
---

This is the second post in the [Building levi](/levi/) series. The [first one](/posts/building-levi-rust-git-diff-viewer-claude-code/) covers what levi is and the decisions behind it. This one covers the first session: the night of October 15.

levi's commit log for that night runs from 22:14 to 23:43. In those 90 minutes it went from the first commit to a tagged 0.1.0 with a README, a license, a changelog and CI. The first commit wasn't a blank slate, though: it already included `docs/plan.md` and a 470-line git layer with tests. Here's what got built, in order, and how I worked with Claude Code along the way.

## 1. A git layer that streams

levi doesn't link a git library. It runs the `git` you already have, so your config, such as rename detection and diff algorithm, applies. The whole branch comes from one `git log` call:

```rust
const LOG_FORMAT: &str = "--format=%x1e%H%x00%h%x00%an%x00%ar%x00%s";

git(root).args([
    "log",
    "--no-color",
    "--no-show-signature",
    "--diff-merges=first-parent",
    "--name-status",
    "-z",
    LOG_FORMAT,
])
```

Three details matter here:

- **`-z` makes the output unambiguous.** Fields are separated by NUL bytes, which can't appear in a path or commit subject. Each record starts with `0x1e`, the ASCII record separator, so the parser can split commits without guessing.
- **The output is read as a stream.** levi parses commits as git prints them instead of waiting for git to finish. On a big repository, that's the difference between a screen in milliseconds and a screen in seconds.
- **Every command runs with `--literal-pathspecs`.** Without it, a file named `glob*.txt` would be treated as a pattern.

Diffs are fetched one file at a time, only when you select a file. Merges are diffed against their first parent, which is why levi needs git 2.31: that's the release that added `--diff-merges`.

## 2. Three panes, drawn on stderr

The UI is [ratatui](https://ratatui.rs): a search bar over three panes for commits, files and the diff. One design choice shaped everything after it. levi draws on **stderr**, not stdout:

```rust
/// Draws on stderr so stdout stays free for the picked sha: `git checkout $(levi)`.
fn init() -> Result<Tui> {
    let hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        restore();
        hook(info);
    }));
    enable_raw_mode()?;
    execute!(io::stderr(), EnterAlternateScreen)?;
    Ok(Terminal::new(CrosstermBackend::new(io::stderr()))?)
}
```

Because stdout stays clean, pressing `Enter` prints the selected sha and levi works as a picker in any shell command. The panic hook matters just as much: if levi crashes, it restores your terminal before printing the error, so you aren't left in raw mode with no visible cursor.

## 3. Load in the background, drop stale work

A TUI that blocks on git feels broken. Thirteen minutes after the first commit, loading moved off the UI thread:

- **The log streams in batches** of up to 512 commits, but a batch never waits longer than 16 ms, about one frame. You can browse the newest commits while older ones are still arriving.
- **Diffs load on their own worker, which skips stale requests.** When you hold the down arrow, requests pile up. The worker drains the queue and only runs the newest:

```rust
while let Ok(mut req) = req_rx.recv() {
    while let Ok(newer) = req_rx.try_recv() {
        req = newer;
    }
    // ...run git show for `req` only
}
```

- **Parsed diffs go into a small LRU cache**, so moving back to a file you just viewed is instant.
- **The app state has no threads of its own.** It receives messages and hands out diff requests, so tests can play the worker's role synchronously.

The result on git.git, git's own repository with 82,500 commits: the first frame shows up in under 0.1 seconds.

## 4. fzf-style search on every core

Search is what levi is for, so it got the most attention. The search bar always has focus, and as you type, the commit and file columns narrow together. A commit matches by subject, author, sha prefix, or **any file it touched**. Typing `parse.rs` answers "which commits touched parse.rs?" with no extra syntax.

Matching uses [nucleo-matcher](https://crates.io/crates/nucleo-matcher), the engine behind the Helix editor's picker, so fzf syntax works: `'exact`, `^prefix`, `suffix$`, `!not` and smart case. Getting it fast took four techniques:

1. **Refilter once per frame,** not once per keystroke. A burst of typing costs one pass.
2. **Rescan only previous hits when the query narrows.** If the new query just extends the old one, nothing that failed before can match now. Negations, anchors and escapes break that rule, so they force a full pass:

```rust
// Appending only narrows: longer atoms and extra atoms both match less.
// Negations (`!`), anchors (`$`) and escapes can widen or reinterpret
// the query, so start over whenever they're involved.
const SPECIAL: [char; 3] = ['!', '$', '\\'];
```

3. **Match on every core.** Each thread gets its own matcher, since matchers hold scratch buffers. Below 4,096 commits per thread, spawning costs more than it saves, so small repositories stay single-threaded.
4. **Render only visible rows.** Drawing costs the same for 100 commits or 100,000.

On git.git, a refilter takes **5–12 ms**, down from 25–45 ms single-threaded.

One small decision made search feel right: **sha matching is prefix-only, not fuzzy.** Fuzzy-matching hex strings would make queries like `add` or `bad` match nearly every commit.

## 5. Fail before the TUI opens

A TUI that opens and then shows an error is worse than no TUI. levi runs a preflight check first and exits with a one-line message:

- `levi: needs git 2.31 or newer`
- `levi: not inside a git repository`
- `levi: no commits yet`

Bare repositories work too. Quitting without picking a commit exits with code **130**, like fzf, so `sha=$(levi) && git show "$sha"` stops cleanly when you change your mind. Integration tests run the real binary through every one of these paths.

## 6. Shipping it

The last 20 minutes went to making levi a real project, not just working code:

- **README and MIT license.** The README got some Captain Levi flavor: "Tch. Your history is filthy. Let's look at it properly."
- **`cargo-deny`** allows only the open-source licenses levi's dependencies actually use, and fails on any dependency with a known vulnerability.
- **A changelog** with a release routine: list the changes, bump the version, commit "Release x.y.z", tag it.
- **GitHub Actions CI** with four jobs:

| Job | What it checks |
| --- | --- |
| Test | `cargo test` on Linux and macOS |
| Lint | `rustfmt`, and clippy with warnings as errors |
| MSRV | Builds on Rust 1.88, the declared minimum |
| Deny | Licenses and security advisories |

At 0.1.0, levi was about 1,100 lines of Rust without tests, and a 1.6 MB binary.

## How Claude Code fit in

Every commit that night was written with Claude Code. Three things kept it on track:

- **The plan came first.** `docs/plan.md` was in the first commit with a layout sketch, a decisions table, the exact git commands, search semantics and a five-step build order. The night's commits followed that order: git layer, static UI, async loading, search, polish.
- **The plan stayed current.** Four of the five feature commits that night also updated `docs/plan.md`, so the next step always started from an accurate description of the code, not from memory.
- **Claims came with numbers.** Commit messages record measurements on git.git: "First frame on git.git (82.5k commits) <0.1s", "5-12 ms on git.git". A number in the commit message is easy to check later, and it keeps "faster" from becoming a feeling.

CI was the last commit of the night, but from then on every change had to pass it, whoever wrote it.

## Takeaways

- **Stream everything.** Parse git output as it arrives, load in batches, and render only what's visible. Size stops mattering.
- **Drop stale work.** When requests pile up, the newest one is the only one the user still wants.
- **Narrowing queries are cheap.** If the query only got more specific, rescan the previous hits.
- **Keep stdout clean in a TUI.** Drawing on stderr turns an interactive tool into a composable one.
- **Fail before you draw.** Check your preconditions and exit with one clear line.

The next post covers what happened after midnight, when a code search that took 55 seconds got down to 0.16.

---

*I'm Rodrigo Santiago, a product leader who builds. I co-founded [Foambyte](https://foambyte.com) with my brother Diego, a brewmaster who leads the product as CPO, and I designed and built the platform: architecture, frontend, backend, mobile and infrastructure. If you need someone who can own both the product and the code, [let's talk on LinkedIn](https://www.linkedin.com/in/rsdlt).*
