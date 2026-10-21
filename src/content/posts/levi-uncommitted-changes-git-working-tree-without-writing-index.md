---
title: "Building levi, Tuesday: Watching an Agent's Uncommitted Changes Without Touching the Index"
pubDatetime: 2026-10-24T09:00:00-05:00
description: "levi 0.19: uncommitted changes as a row on top of the log, live as an agent edits, read with git plumbing so levi never writes to .git."
tags: ["levi", "rust", "git", "tui", "ratatui", "claude code", "ai coding agents"]
---

This is the eighth post in the [Building levi](/levi/) series. The [previous one](/posts/levi-live-refresh-git-repository-watcher-resizable-panes-rust-tui/) covered Monday's 0.17.0 and 0.18.0: levi following the repository while it's open, and panes you resize by dragging. On Tuesday, October 20, one commit at 17:06 and a release at 18:45 shipped 0.19.0. It shows what isn't committed yet, as a row on top of the log.

The test suite grew from 130 tests to 147.

## Out of scope, then in

When levi started, the plan had a line for this. The [first post](/posts/building-levi-rust-git-diff-viewer-claude-code/) listed it in the scope table: uncommitted changes, "Out, for now. No working-tree pseudo-commit."

The plan now records why that changed. It came in "once agents made 'what has it changed but not committed?' the most common question." An agent edits files for minutes before it commits, if it commits at all. A history viewer that only shows commits misses all of that.

## One red row

While the working tree differs from HEAD, the commits column starts with a row that reads `working uncommitted changes`, all in red, the way `git status` shows what isn't committed. Select it and it works like any commit: the files it touched, their diffs, search and the same keys.

- **One row, not two.** Staged and unstaged changes count as one, against HEAD. The question is what changed since the last commit, and two rows would bring in git's index.
- **Untracked files count.** Agents create files all the time, so untracked files that git doesn't ignore are in the row, marked `?`. At most 1,000, so a big directory nobody ignored can't flood the files column.
- **A header like a commit's.** The diff opens with `Uncommitted changes on <branch>` and `On top of <short> <subject>`, colored as a commit header.
- **Only where it makes sense.** The row appears only when the history on screen ends at HEAD: no revision, or one whose tip is HEAD's commit, like `main..HEAD`. Not in the reflog, not in a bare repository and not in `levi --filter`, whose `<sha> <subject>` lines must stay readable by `git show`.
- **Gone when clean.** Commit everything and the row disappears, and the top commit is selected.

## Live, as the agent writes

Monday's watcher already asked git every 2 seconds whether the history moved. Now it also runs `git status` on the same schedule, and reports when a fingerprint changes. Status alone isn't enough: editing a file that's already modified doesn't change its status. So the fingerprint covers the status output plus each listed file's size and modification time.

The plan measured the cost on git.git's tree, with 4,857 files: 17 ms a look.

Every new state gets a new id, `working:<n>`, with `n` counting the reports. It isn't hex, so no sha prefix you type can match it. Because a new state is a new key, diffs and `/c` results for an older state can't be mistaken for the current one, and the diff cache needs no eviction. While the new diff loads, the old one stays on screen, so the pane doesn't flicker as the agent writes. The selection, file and scroll position stay too.

On the first report, levi selects the row if the selection is still on top, so it opens on what changed since the last commit. Otherwise, the commit you picked stays selected.

## Never writing to .git

levi never writes to your repository. Reading the working tree puts that at risk.

`git status` and `git diff` both refresh the index, which writes to `.git`. A viewer that polls every 2 seconds would write to `.git` every 2 seconds, while an agent works in the same repository. The fix has two parts:

1. **The file list** comes from `git --no-optional-locks status --porcelain=v2 -z --untracked-files=all`. The flag stops `git status` from refreshing the index.
2. **The diffs and `/c`** use the plumbing command `git diff-index`, which never refreshes it. Porcelain `git diff` does, with `--no-optional-locks` or without it.

Untracked files have no history to diff against, so levi uses `git diff --no-index /dev/null <path>`.

A test pins the promise down. It touches a file after the index was written, so any refresh would rewrite it, then reads the working tree, a diff and a code search, and checks that the index is byte for byte the same, with the same modification time:

```rust
#[test]
fn reading_the_working_tree_never_writes_the_index() {
    let repo = Repo::new();
    repo.write("a.txt", "1\n");
    repo.commit("one");
    // Touched after the index was written, so a refresh would rewrite it.
    std::thread::sleep(std::time::Duration::from_millis(1100));
    repo.write("a.txt", "1\n");
    repo.write("b.txt", "needle\n");
    let index = repo.path().join(".git/index");
    let stamp = || fs::metadata(&index).unwrap().modified().unwrap();
    let (bytes, modified) = (fs::read(&index).unwrap(), stamp());
    working(repo.path()).unwrap();
    diff(
        repo.path(),
        "working:1",
        Some(&change(Status::Modified, "a.txt")),
    )
    .unwrap();
    working_code_search(repo.path(), "needle", None).unwrap();
    assert_eq!(fs::read(&index).unwrap(), bytes);
    assert_eq!(stamp(), modified);
}
```

## Searching changes that keep changing

`/c` searches the code in every diff. On git.git, a full search takes about 6 seconds. The working tree can change every few seconds while an agent works, so restarting the whole search on each change would never let it finish.

So the row gets its own search, beside the commits' one:

- **Tracked files** go through `git diff-index -G`, with the same literal, smart-case pattern.
- **Untracked files** are read and matched line by line, skipping binary files and files over 8 MiB.
- **It reruns on its own.** It searches when the commits' search starts and again whenever the tree changes, keeping the last result until the new one is in. A result for an older state is dropped.

## Keys on a row without a sha

The row has no sha, so the keys that print or copy one needed a decision:

| Key | On a commit | On the uncommitted changes |
| --- | --- | --- |
| `Enter` | prints the sha and quits | the status line says it has no sha, and levi stays |
| `Ctrl-Y` | copies the full sha | the status line says it has no sha |
| `Enter` with `--pick-context` | `commit d3a93ab (...), src/ui.rs lines 27-40` | `the uncommitted changes, src/ui.rs lines 27-40` |
| `Ctrl-O` | opens the file at the line in view | opens the working tree's file, or HEAD's copy read-only if it was deleted |

Printing nothing beats printing something `git show` can't read. With `--pick-context`, the herdr plugin from Sunday now hands an agent a reference to its own unfinished work.

## How Claude Code fit in

- **The plan kept the old "out of scope".** The scope table changed from "Out for now" to the row's design, with a note on what made it come in. The decision's history stays readable.
- **A test for a promise, not a feature.** "levi never writes to your repository" is now checked byte for byte, with a sleep that makes a refresh happen if anything triggers one.
- **Plumbing chosen for a reason the docs bury.** That porcelain `git diff` refreshes the index even with `--no-optional-locks` is written in a code comment, the commit and the plan, so nobody swaps it back.
- **Built on the day before.** The watcher from 0.17.0 and `--pick-context` from 0.16.0 did most of the work. The new row plugs into both.
- **Numbers in the plan.** The 17 ms cost per look on git.git sits next to the design it justifies.

## Takeaways

- **Revisit "out for now".** A scope cut made on day one can be wrong a week later, once you see how the tool is used. Record why it came back in.
- **Read-only tools must prove it.** If you promise not to write, test the bytes and the modification time, not just the absence of write calls.
- **Know which git commands write.** `git status` and `git diff` refresh the index; `--no-optional-locks` and plumbing like `diff-index` don't.
- **Give a moving target new keys.** A new id for each state makes stale results impossible to mix up and the cache simple.
- **Search the fast-changing part separately.** A small, frequent search beside a large, slow one lets both finish.

levi is at 0.19.0, and the series continues as it grows.

---

*I'm Rodrigo Santiago, a product leader who builds. I co-founded [Foambyte](https://foambyte.com) with my brother Diego, a brewmaster who leads the product as CPO, and I designed and built the platform: architecture, frontend, backend, mobile and infrastructure. If you need someone who can own both the product and the code, [let's talk on LinkedIn](https://www.linkedin.com/in/rsdlt).*
