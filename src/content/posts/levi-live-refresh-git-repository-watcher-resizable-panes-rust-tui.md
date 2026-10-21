---
title: "Building levi, Monday: Keeping Up With Commits From Another Terminal, and Panes You Can Drag"
pubDatetime: 2026-10-23T09:00:00-05:00
description: "levi 0.17 and 0.18: a watcher that asks git every two seconds what changed, loads only new commits, and panes you resize by dragging their borders."
tags: ["levi", "rust", "git", "tui", "ratatui", "claude code", "ai coding agents"]
---

This is the seventh post in the [Building levi](/levi/) series. The [previous one](/posts/levi-syntax-highlighting-terminal-tints-herdr-coding-agent-plugin/) ended on Sunday with 0.16.0: syntax colors, tints and a herdr plugin that hands a commit to your agent. On Monday, October 19, two short stretches of work shipped two releases. 0.17.0 at 13:43 made levi follow the repository while it's open. 0.18.0 at 17:21 let you resize the panes with the mouse.

The test suite grew from 115 tests to 130.

## The problem: a log frozen at startup

Until 0.17.0, levi read the history once, when it started. A commit, pull, amend or rebase made in another terminal, or by an agent, needed a restart to show. That matters more when an agent is committing while you read.

The plan's new Refresh section sets the bar: levi follows the repository without a restart, "without a key or a setting."

## Asking git instead of watching files

The obvious tool is a file watcher on `.git`. The commit rejects it: it would add a dependency and miss worktrees, packed refs and bare repositories. Instead, a watcher thread asks git every 2 seconds what the history on screen resolves to:

- **For a normal log,** `git rev-parse <rev> --`, which prints one line per tip, with `^` in front of excluded ones. `HEAD` by default.
- **Under `/r`, the reflog,** the newest reflog entry with `git log -g -1 --date=raw`. Its selector carries a timestamp, so checking out the same commit again still counts as a change.

Each look costs a few milliseconds of git. The watcher also checks at once when the terminal regains focus, through focus reporting (terminals without it ignore the request), and when `Ctrl-O`'s editor returns. `levi --filter` doesn't watch: it runs once and exits.

## Load only what's new

Knowing that something changed is half the job. Reloading a big history every time someone commits would throw away the work levi does to load fast. So the watcher tells two cases apart:

- **Growing:** every old tip is an ancestor of its new one, and the excluded tips stayed the same. That's a commit, a pull or a fast-forward. levi loads only `<new tips> ^<old tips> <excluded>`, in one `git log`, and puts those commits on top of the list.
- **Anything else:** an amend, rebase, reset, another branch checked out, or any reflog change. levi reloads in full, the way switching to `/r` does.

The check is one function:

```rust
/// The revisions that cover just the new commits, if `old` only grew into
/// `new`: the same excluded tips, and each tip an ancestor of its new one.
/// `None` for anything else, like an amend or a rebase.
fn grown(root: &Path, old: &[String], new: &[String]) -> Option<Vec<String>> {
    let split = |tips: &[String]| -> (Vec<String>, Vec<String>) {
        tips.iter().cloned().partition(|t| !t.starts_with('^'))
    };
    let ((old_tips, old_excluded), (new_tips, new_excluded)) = (split(old), split(new));
    if old_excluded != new_excluded || old_tips.len() != new_tips.len() {
        return None;
    }
    for (o, n) in old_tips.iter().zip(&new_tips) {
        if o != n && !git::is_ancestor(root, o, n).ok()? {
            return None;
        }
    }
    let mut revs = new_tips;
    revs.extend(old_tips.iter().map(|t| format!("^{t}")));
    revs.extend(new_excluded);
    Some(revs)
}
```

`git::is_ancestor` wraps `git merge-base --is-ancestor`. Any error falls through to `None`, which means a full reload: the safe answer.

New commits go on top, not in date order. The plan explains why: a pull that brings older-dated commits shows them first, as what just arrived.

### Keeping your place

A refresh that loses your search or your scroll position is worse than no refresh. So the query, the focused pane and the diff cache all stay. The cache is keyed by `(sha, path)`, and commits never change, so its entries stay valid.

The selected commit stays selected by sha. After a prepend that happens at once. After a full reload it happens as soon as the batch holding it arrives, with its file and diff scroll. If a rewrite dropped the commit, the selection rests on the top commit.

A `/c` code search follows too. After a prepend, a finished search runs on the new commits only and adds their hits. An unfinished one starts over on its whole scope, keeping the hits it had. A reload reruns it.

The status line says what happened, until the next key or click: `2 new commits`, `history changed, reloaded` or `reflog updated`.

### The race

A watcher and a loader running side by side can miss a commit. The fix is to take the baseline in the main thread right before each full load starts. Anything committed after that shows up as a change on the next look. A commit that lands after the baseline but before the load's `rev-list` gets loaded twice at worst, and prepends skip shas already on screen. A change during any load reloads in full rather than stacking partial loads.

The commit says how it was tested: in a real terminal under tmux, with commits, an amend and a checkout under `/r`.

## Panes you can drag

0.18.0 came that evening. levi's layout has three panes: commits, files and the diff, side by side on wide terminals and stacked on narrow ones. The splits were fixed. Now you drag the border between two panes to move it.

- **Seams.** Every pane draws its own border, so where two panes meet there are two border columns side by side. A left press on either one starts a resize. The outer edges aren't seams. A click on a border used to only focus its pane, so the drag takes nothing away.
- **Only the two neighbors move.** In the wide layout, dragging the commits|files seam leaves the diff's width alone. A resize doesn't move focus, the selection or any scroll.
- **Floors.** No pane gets narrower than 12 columns or shorter than 5 rows. The seam stops there.
- **Proportions, not cells.** Splits are kept as fractions of the body, so resizing the terminal keeps them. The wide and stacked layouts each keep their own, so crossing 120 columns and back doesn't lose either.
- **Double-click a seam** to put its layout back to the defaults.

The layout code moved out of `ui.rs` into its own `layout.rs`, which now owns where the panes go and which seams a drag moves:

```rust
const MIN_WIDTH: u16 = 12;
const MIN_HEIGHT: u16 = 5;

/// Where the seams sit, as fractions of the body, so a terminal resize keeps
/// the proportions. Each layout keeps its own.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Splits {
    /// Side by side: where the commits end and where the files end, across.
    wide: [f32; 2],
    /// Stacked: where the lists end, down; where the commits end, across.
    stacked: [f32; 2],
}
```

### What it doesn't do

The plan records what was left out, and why:

- **No saved sizes.** Quitting forgets them. Keeping them would need a config file, and levi has no settings.
- **No resize keys.** Printable keys belong to the search, and someone who doesn't use the mouse has the defaults, which are what levi was laid out for.
- **No drag, no resize.** Terminals that report clicks but not drags just don't resize.

## How Claude Code fit in

- **The commit message carries the design.** The watcher's commit explains the rejected file watcher, the growth rule, what stays across a refresh and the race, in plain words. The plan got a new Refresh section with the same reasoning.
- **Constraints decided the shape.** "Without a key or a setting" ruled out a refresh key, and "no settings" ruled out saving pane sizes. Both are written down where the next session will find them.
- **Safe fallbacks by default.** Every uncertain case in the watcher, including a git error, falls back to a full reload instead of guessing.
- **Real-terminal testing.** Unit tests cover telling growth from rewrites and a range that grows only while its base stays. The behavior on screen was checked in tmux with real commits.
- **Small releases.** Each feature shipped as its own minor version within the same day.

## Takeaways

- **Ask the tool, not the filesystem.** Polling `git rev-parse` every 2 seconds costs a few milliseconds and handles worktrees, packed refs and bare repositories that a file watcher would miss.
- **Split the common case from the rest.** Most changes are commits on top, so load only those, and let everything else take the slow, correct path.
- **Preserve state by stable keys.** Selecting by sha and caching by `(sha, path)` let a refresh keep your place.
- **Store layout as proportions.** Fractions survive a terminal resize, where cell counts don't.
- **Write down what you left out.** The plan explains the missing settings and keys, so they don't come back as bug reports.

The next post covers Tuesday's 0.19.0, which shows the changes you haven't committed yet.

---

*I'm Rodrigo Santiago, a product leader who builds. I co-founded [Foambyte](https://foambyte.com) with my brother Diego, a brewmaster who leads the product as CPO, and I designed and built the platform: architecture, frontend, backend, mobile and infrastructure. If you need someone who can own both the product and the code, [let's talk on LinkedIn](https://www.linkedin.com/in/rsdlt).*
