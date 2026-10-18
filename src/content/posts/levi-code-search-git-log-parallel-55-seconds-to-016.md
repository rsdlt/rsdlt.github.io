---
title: "Building levi, After Midnight: A 55-Second Code Search Down to 0.16 Seconds"
pubDatetime: 2026-10-19T09:00:00-05:00
description: "How levi's /c code search over git history went from 55 seconds to 0.16 on git.git: parallel git log -G, loading history on every core, and searching only what the query matches."
tags: ["levi", "rust", "git", "performance", "concurrency", "claude code", "ai coding agents"]
---

This is the third post in the [Building levi](/levi/) series. [Night one](/posts/levi-night-one-rust-tui-git-log-parser-fuzzy-search/) ended at 23:43 with levi 0.1.0: a fast fuzzy search over commits and files. The session didn't stop there. Between 00:05 and 01:07 on October 16, levi got its two slash commands and three releases. Its code search went from 55 seconds as a single git process to about 9 across every core, and a typical scoped query now comes back in 0.16 seconds.

All the numbers here come from levi's commit messages and plan, measured on git.git (git's own repository, 82,500 commits) on a 12-core machine.

## Slash commands in the search bar

levi has one input: the search bar, which always has focus. New features had to fit in it without a mode switch, so they became **slash commands**, parsed out of whatever you type:

- **`/r`** switches the commit list to the reflog, which shows every place `HEAD` has been, including commits on branches you've since deleted.
- **`/c text`** searches the code: it keeps the commits whose diffs add or remove a line containing `text`.

Everything else stays fuzzy, so they combine:

```text
parse.rs /c let x =        which commits in parse.rs changed this line?
/r /c experiment           that code from a branch you deleted
```

Commands only count as whole words. That's what keeps `src/config` and `/cache` working as normal fuzzy text:

```rust
//! Commands are whole words, so `src/config` or `/cache` stay fuzzy text.
// Simplified from src/query.rs
pub fn parse(raw: &str) -> Query {
    let (before, code) = match find_word(raw, "/c") {
        // Everything after `/c`, spaces included, is the text to find.
        Some(at) => (&raw[..at], Some(raw[at + 2..].trim_start().to_owned())),
        None => (raw, None),
    };
    // ...`/r` anywhere in `before` switches the source to the reflog
}
```

Switching to the reflog means reloading the commit list while the old load may still be running. Each load gets a **generation number**. Starting a new one kills the running git, and any late messages from the old generation are dropped. The same pattern shows up again in the code search.

## /c, first version: 55 seconds → 9

"Which commit put this line here?" is the question levi's README promises to answer. git can answer it: `git log -G <regex>` keeps the commits whose diffs add or remove a line matching the regex. On git.git, as a single process, it takes about **55 seconds**.

The first version of `/c` makes that bearable in four ways:

1. **Every core gets a share.** levi already knows every commit's sha, so it cuts them into chunks of 500 and feeds each chunk to its own `git log -G` through `--stdin --no-walk`. One thread per core pulls chunks off a shared queue, newest first.
2. **Matches stream in.** Each chunk reports its hits as soon as git prints them, with progress in the status line. The first hit for a common identifier shows up in about 0.15 seconds.
3. **It waits for a pause.** The search starts 300 ms after you stop typing, so it doesn't launch one search per keystroke.
4. **It cancels instantly.** Changing the pattern bumps the generation and kills every running git within 0.3 seconds.

The text is matched **literally**. `-G` speaks POSIX extended regex, so levi escapes the special characters, and it ignores case unless you type a capital, like the rest of the search:

```rust
/// Escapes POSIX extended regex syntax (what `-G` speaks) so `text` matches literally.
fn literal_regex(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for c in text.chars() {
        if r".[]()*+?{}|^$\".contains(c) {
            out.push('\\');
        }
        out.push(c);
    }
    out
}
```

A full search of all 82,500 commits: **about 9 seconds.** That shipped as 0.2.0 at 00:24.

## Loading the whole history on every core: 5–9 seconds → 0.9

`/c` only starts once the commit list has fully loaded, and loading it was itself slow: a single streaming `git log --name-status` takes 5–9 seconds on git.git. The first screen was already fast, but the full list wasn't.

The same idea applied. The loader became a pipeline with three roles:

- **A producer** streams `git rev-list HEAD`, which is fast because it only lists shas, and cuts them into chunks: 256 first, for a fast first screen, then 2,048.
- **One worker per core** runs `git log --no-walk --stdin --name-status` on a chunk at a time.
- **A coordinator** puts the results back in order, because chunks finish out of order:

```rust
// Chunks finish out of order; hold each until the ones before it are sent.
let (mut next, mut total, mut waiting) = (0, None, HashMap::new());
while total != Some(next) {
    match event_rx.recv().ok()? {
        LogEvent::Total(n) => total = Some(n),
        LogEvent::Chunk(_, Err(e)) => return Some(Err(e)),
        LogEvent::Chunk(index, Ok(commits)) => {
            waiting.insert(index, commits);
            while let Some(commits) = waiting.remove(&next) {
                tx.send(Msg::Commits(generation, commits)).ok()?;
                next += 1;
            }
        }
    }
}
```

The first batch now arrives in about **40 ms**, and all 82,500 commits in about **0.9 seconds**. A test feeds the pipeline tiny chunks that finish out of order and checks that the result matches a single `git log` record for record. The reflog keeps the single streaming walk, since only a reflog walk knows each entry's action, such as "checkout" or "commit".

## Search only what the query matches: 9 seconds → 1.5

In practice, nobody searches all of history. You type something like `parse.c /c git_parse_ssize_t`: the fuzzy part narrows the commits to the ones that touched `parse.c`, and `/c` looks inside them. The first version of `/c` searched every commit and then filtered. The fix was to flip the order: **only search the commits the fuzzy part already matched.**

| Query | Commits searched | Time |
| --- | --- | --- |
| `/c …` | 82,500 | ~8.5 s |
| `parse /c …` | 22,600 | ~3.2 s |
| `parse.c /c …` | 2,700 | ~1.5 s |

Two details made it work well:

- **Results survive narrowing.** If you keep typing and the fuzzy query only gets more specific, the existing results stay valid, so there's no new search. Widening the query searches again after the usual pause. This is the same "narrowing is cheap" rule from night one's fuzzy search.
- **Chunk size follows the work.** Scoped sets are small and skew toward expensive merge commits, so chunks are sized to give every core about four of them, capped at 500 commits.

That shipped as 0.3.0 at 00:49.

## Diff only the matched files: 1.5 seconds → 0.16

1.5 seconds for 2,700 commits still seemed slow. The cause turned out to be **big merges.** A merge commit that touched `parse.c` might also touch hundreds of other files, and `git log -G` diffed all of them, even though levi would only ever show `parse.c`.

So commits that matched through their file names are now searched with a **pathspec** of just those files:

- **Commits matched by file name** get a pathspec of the matched files. levi also adds the old names of renamed files, so git still pairs them and a pure rename doesn't count as a code change.
- **Commits matched by subject or author** are diffed whole, since every file in them is relevant.
- **The two kinds go in separate chunks.** Scoped chunks share the union of their paths and fall back to a full diff past 512 paths.

The visible results are identical, because levi only shows the fuzzy-matched files anyway. `parse.c /c git_parse_ssize_t` went from **1.5 seconds to 0.16**. That's 0.4.0, at 01:07.

## What we measured and didn't ship

`docs/plan.md` keeps a list of ideas that were measured and rejected, so the same idea doesn't get tried twice:

| Idea | Result |
| --- | --- |
| `git log -S` instead of `-G` | 2.3× faster, but it misses edited lines: it found 34 of 48 hits |
| Scanning file contents directly with `git cat-file --batch` | No faster, and it misses merges and moved code |
| A bigger `core.deltaBaseCacheLimit` | About 4% faster |
| A commit-graph file | No change |
| `--no-renames` | About 3% faster |
| Prefetching diffs | Unnecessary: a diff already opens in about 3 ms |

`-S` is the instructive one. It's faster because it only finds commits where the number of occurrences changes, so a line that was edited in place doesn't count. Faster and wrong isn't faster.

## How Claude Code fit in

This session is where working with an agent paid off most:

- **Every optimization started from a measurement.** The commit messages record before-and-after numbers on the same repository and the same query, so each step had to prove itself.
- **Rejected ideas got written down.** Without a record, `-S` looks like an easy win every time someone, human or agent, rediscovers it. The "measured and rejected" list in the plan answers that with data.
- **Correctness had a test before speed did.** The parallel loader shipped with a test that compares it against a single `git log`, record for record. Rewriting core code at 1 a.m. is only safe with that kind of check.
- **Small releases.** Three releases in one hour, each one a complete, working step. If one had regressed, the previous one was minutes old.

## Takeaways

- **Do less before doing it faster.** Scoping the search to matched commits and files beat parallelism by an order of magnitude.
- **Parallelize at the process level when the tool is external.** Many small git processes, each on a chunk, scale with your cores.
- **Restore order explicitly.** If parallel work has to come back in order, hold early finishers until their turn.
- **Make cancellation a first-class feature.** Generation numbers plus killing child processes keep a live search responsive.
- **Keep a record of what didn't work.** It's as valuable as what did.

The next post covers day two: the polish that turned a fast tool into one that's pleasant to use.

---

*I'm Rodrigo Santiago, a product leader who builds. I co-founded [Foambyte](https://foambyte.com) with my brother Diego, a brewmaster who leads the product as CPO, and I designed and built the platform: architecture, frontend, backend, mobile and infrastructure. If you need someone who can own both the product and the code, [let's talk on LinkedIn](https://www.linkedin.com/in/rsdlt).*
