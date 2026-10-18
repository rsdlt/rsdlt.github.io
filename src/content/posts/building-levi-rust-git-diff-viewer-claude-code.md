---
title: "Building levi: A Small, Fast Git Diff Viewer in Rust, Written with Claude Code"
pubDatetime: 2026-10-17T16:30:00-05:00
description: "Why I built levi, a terminal git diff viewer with fzf-style search, the design decisions behind it, and how I built it with Claude Code from a written plan."
tags: ["levi", "rust", "git", "tui", "cli", "claude code", "ai coding agents"]
---

[levi](https://github.com/rsdlt/levi) is a git diff viewer for the terminal. It does one thing: browse the commits on your branch, the files each one touched, and their diffs, with fzf-style search on top. It went from an empty repository to release **0.12.0** between the night of October 15 and the afternoon of October 17, and it's still growing. Every commit is written with **Claude Code**.

![levi browsing its own history: fuzzy search, a diff with changed words marked, a code search, and Enter handing the sha to git show](https://raw.githubusercontent.com/rsdlt/levi/main/docs/demo.gif)

This post opens an ongoing series about building it. It covers what levi is, the decisions that shaped it, and how I work with the agent. The posts after it follow the build session by session, and new posts will follow as levi grows.

## What levi does

Three panes and a search bar:

- **Commits** on the current branch, or on any revision you name: `levi main..HEAD` shows what your branch adds before you open the PR.
- **Files** each commit touched.
- **The diff**, opening with the commit's full message, with only the changed words highlighted in edited lines.

The search bar always has focus. As you type, commits and files narrow down together. A commit matches by subject, author, sha prefix or **any file it touched**, so typing `parse.rs` answers "which commits touched parse.rs?" right away.

Two slash commands go in the same bar:

- **`/c text`** searches the code: it keeps the commits whose diffs add or remove a line containing `text`. It answers "which commit put that line there?"
- **`/r`** switches to the reflog, including commits on branches you've since deleted.

`Enter` prints the selected sha to stdout, so levi also works as a picker:

```sh
git show $(levi)
```

## Why not tig or lazygit?

Those are full git clients. levi isn't. It doesn't stage, commit, rebase or push. It only reads history, and it's built to do that fast on large repositories. On git.git, with 82,500 commits, the first screen shows up in about 40 ms, the full history loads in under a second, and each search takes 5–12 ms. It's about 2,300 lines of Rust and a 1.6 MB binary.

The name fits the brief: Captain Levi from *Attack on Titan*, small, swift and precise. The README leans into it.

## The decisions that shaped it

Before the first line of code, there was a plan. The first commit already includes `docs/plan.md`, and it has a decisions table that held for the whole build:

| Decision | Choice | Why |
| --- | --- | --- |
| Git backend | Shell out to the `git` CLI, not `git2` or `gix` | Respects the user's git config, needs no C build, keeps the binary small. |
| Scope | The current branch, or one revision | No `--all`. |
| Merge commits | Diff against the first parent | History isn't first-parent only: commits from merged branches still show. |
| Uncommitted changes | Out, for now | No working-tree pseudo-commit. |
| Fuzzy matching | `nucleo-matcher` | fzf-compatible syntax: smart case, `^`, `$`, `'`, `!`. |
| Diff rendering | Simple colors, no syntax highlighting | The commit message on top and changed words marked, nothing more. |

Saying no to things up front is what kept levi small. Three runtime dependencies (`ratatui`, `nucleo-matcher` and `anyhow`) cover the whole app.

## How I built it with Claude Code

I've written about [how I use Claude Code on a production SaaS](/posts/claude-code-production-saas-ai-coding-guardrails/). levi was a chance to use the same approach on a project small enough to see end to end. It will come up in every post of this series. Here's the short version:

- **The plan is the contract.** `docs/plan.md` defines the layout, the git commands, the search semantics and a build order. The agent works from it, and 18 of the feature commits update the plan along with the code.
- **Every performance claim has a number.** Commit messages record measurements on git.git, such as "~9 s on 12 cores vs ~55 s single-process."
- **Gates that don't care who wrote the code.** CI runs the tests on Linux and macOS, rustfmt, clippy with warnings as errors, a check on the minimum Rust version, and `cargo-deny` for licenses and known vulnerabilities. That was in place before 0.2.0.
- **Small releases.** Every feature is its own commit and usually its own release: 0.1.0 to 0.12.0 in under two days.

## The series

1. **Why I built levi** (this post).
2. **Night one: from zero to 0.1.0 in 90 minutes.** The git layer, the three-pane TUI, background loading, fuzzy search on every core, and CI.
3. **After midnight: chasing a 55-second code search down to 0.16 seconds.** The reflog, `/c`, loading history on every core, and narrowing the search to only the commits and files that matter.
4. **Day two: the polish that makes a TUI usable.** Changed-word highlighting, mouse support, a layout for narrow terminals, `levi main..HEAD`, and shipping binaries for every platform.
5. **And more to come.** levi is still moving: 0.13.0 already added copying the selected commit's sha with `Ctrl-Y`, and copying text with a mouse drag. The series follows it as it grows, and the [series page](/levi/) lists every post.

## Try it

```sh
brew install rsdlt/tap/levi
# or
cargo binstall levi-git
```

Prebuilt binaries for macOS, Linux and Windows are on the [releases page](https://github.com/rsdlt/levi/releases/latest). levi needs git 2.31 or newer.

---

*I'm Rodrigo Santiago, a product leader who builds. I co-founded [Foambyte](https://foambyte.com) with my brother Diego, a brewmaster who leads the product as CPO, and I designed and built the platform: architecture, frontend, backend, mobile and infrastructure. If you need someone who can own both the product and the code, [let's talk on LinkedIn](https://www.linkedin.com/in/rsdlt).*
