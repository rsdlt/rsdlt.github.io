---
title: "Building levi, Day Two: The Polish That Makes a Terminal UI Usable"
pubDatetime: 2026-10-20T09:00:00-05:00
description: "Ten levi releases of polish: changed-word diffs, mouse support, narrow terminals, NO_COLOR, a demo GIF, a crate name clash and release binaries for every platform."
tags: ["levi", "rust", "tui", "ratatui", "cli", "accessibility", "claude code", "ai coding agents"]
---

This is the fourth post in the [Building levi](/levi/) series. The [previous one](/posts/levi-code-search-git-log-parallel-55-seconds-to-016/) ended at 01:07 on October 16, with a code search that answers in a fraction of a second. levi was fast by then, but it wasn't pleasant to use yet. Two more sessions fixed that: the afternoon of October 16 (13:07 to 17:14) and the morning of October 17 (09:45 to 14:02). Together they shipped ten releases, 0.5.0 through 0.12.0, and grew the test suite from 63 tests to 86.

This post covers that polish, grouped by what it fixed rather than strictly by time.

## Diffs that read like git show

### The commit message on top

Until 0.5.0, the diff pane showed only the patch. Now it opens with the commit's header and full message, laid out like `git show`. Fetching it costs nothing extra: the same `git show` call that returns the patch also prints the message, separated by a NUL byte, so it lands in the same cache entry.

### Only the changed words

When a line is edited, the diff shows the old and new versions as a `-` line and a `+` line, and your eye has to find the difference. levi now marks just the words that changed, in reverse video, like git's `diff-highlight` script:

- **Lines are paired in order.** In a block of removed lines followed by added ones, the first `-` pairs with the first `+`, and so on.
- **Each pair is compared token by token** (words, runs of whitespace, single punctuation marks). The shared start and end are trimmed, and the middle goes through a longest-common-subsequence comparison.
- **Mostly rewritten lines aren't marked.** If less than half of a line survives, lighting up most of it tells you nothing, so levi skips it.

The comparison is quadratic, which is a problem for huge rewrites. Each diff gets a fixed budget:

```rust
/// Word-by-word comparison is quadratic in the tokens a pair differs in, so
/// one diff gets this many steps of it. Past that, or for a single pair that
/// would cost more, the whole span between the shared ends is marked instead.
const BUDGET: usize = 1 << 20;
```

Past the budget, levi falls back to marking everything between the shared ends, which is what `diff-highlight` does and costs linear time. From the plan's measurements:

| Input | Without a budget | With it |
| --- | --- | --- |
| 5,000 pairs of 200-word lines | 2 s | 39 ms |
| 20,000 typical code pairs | n/a | 18 ms |

## The mouse, without the cost

0.6.0 added clicks and the scroll wheel. A click selects a commit or file, and the wheel moves whichever list is under the pointer, or scrolls the diff, without moving focus.

Capturing the mouse has two costs, and levi deals with both:

- **Every mouse movement becomes an event.** Each one would trigger a redraw, so levi drops motion and drag events in the input thread, before they reach the app. Moving the mouse costs nothing.
- **Native text selection stops working.** You have to hold a modifier while dragging: `Option` in iTerm2, `Fn` in Terminal.app, `Shift` in most others. The README lists them, and the sha, the thing you usually want to copy, already comes out on stdout.

The same afternoon brought levi's first crash fix. In a terminal too small for any list rows, keeping the selection in view moved the scroll offset past it, and the row arithmetic underflowed. The fix is one condition. It came with a test that draws levi at 0×0, 10×3 and 100×5.

## Fitting real terminals

- **Sideways scrolling (0.7.0).** levi doesn't wrap long lines; the diff scrolls sideways instead. `Shift-Left` and `Shift-Right` move the diff 8 columns, as do horizontal scrolling and `Shift` plus the wheel. levi uses `Shift` because `Alt`-arrows are word jumps in macOS terminals. When a `/c` match ends past the right edge, the diff shifts to show it.
- **Key hints on the bottom row (0.8.0).** The keys and the `/c` and `/r` commands used to live only in `--help` and the README. A single row now lists them, most useful first. Whatever doesn't fit the terminal's width is dropped from the end, never cut in the middle of a hint.
- **A stacked layout for narrow terminals (0.10.0).** Below 120 columns, such as a split pane, three side-by-side panes leave the diff too narrow to read. The lists move above a full-width diff instead:

```rust
let [commits, files, diff] = if body.width < STACK_BELOW {
    let [lists, diff] =
        Layout::vertical([Constraint::Percentage(35), Constraint::Percentage(65)]).areas(body);
    let [commits, files] =
        Layout::horizontal([Constraint::Percentage(55), Constraint::Percentage(45)])
            .areas(lists);
    [commits, files, diff]
} else {
    Layout::horizontal([
        Constraint::Percentage(25),
        Constraint::Percentage(20),
        Constraint::Percentage(55),
    ])
    .areas(body)
};
```

The layout follows the terminal's width on every frame, so there's no toggle key. Every printable key belongs to the search bar anyway.

- **Jumping between hunks (0.11.0).** `Shift-Down` puts the next `@@` hunk at the top of the diff, and `Shift-Up` the previous one. With `/c` on, the same keys step through the matching lines instead.

## Browsing a revision: levi main..HEAD

0.9.0 lets levi take one optional revision, anything `git log` understands:

```sh
levi main..HEAD      # what your branch adds to main, before you open the PR
levi v1.0..          # everything since a tag, for the changelog
levi other-branch    # another branch, without checking it out
```

This feature was small because of an earlier decision. The parallel loader from the [previous post](/posts/levi-code-search-git-log-parallel-55-seconds-to-016/) starts from `git rev-list HEAD`. Passing the revision there instead, as `git rev-list --end-of-options <rev> --`, narrows the whole pipeline at once. Search, `/c` and `Enter` all work unchanged on the smaller set, and `/c` gets faster too. The `--end-of-options` and `--` keep git from reading the argument as an option or a path. A bad revision or an empty range fails with one line before the TUI opens.

## The details that are easy to skip

October 17 went to the kind of work that rarely makes a demo:

- **The terminal's own cursor in the search bar.** levi drew a `█` block after the query and hid the real cursor. Using the real one keeps your cursor style, lets input methods for languages like Japanese compose characters in the right spot, and stops screen recorders from drawing a stray block.
- **`Ctrl-W` deletes the last word of the query,** as in a shell. `Ctrl-U` can't clear the line, because it already scrolls the diff.
- **`-v` works for the version,** along with `-V` and `--version`.
- **A clear message without a terminal.** Run from a script or with stderr redirected, levi used to fail with "Device not configured (os error 6)". It now checks stderr, where it draws, and says it needs a terminal.
- **`NO_COLOR` support (0.12.0).** With the [`NO_COLOR`](https://no-color.org) environment variable set, levi drops every color after drawing each frame. Anything a background color marked, like the selection or a code match, switches to reverse video so it still stands out:

```rust
/// Drops every color. What a background color marked, like the selection or a
/// code match, is shown in reverse video instead, so it still stands out.
fn strip_colors(buf: &mut Buffer) {
    for cell in &mut buf.content {
        if cell.bg != Color::Reset {
            cell.modifier.insert(Modifier::REVERSED);
        }
        cell.fg = Color::Reset;
        cell.bg = Color::Reset;
    }
}
```

Doing it once, on the finished frame, means no drawing code has to know about `NO_COLOR`.

## Shipping it for real

### A name clash

`levi` was already taken on crates.io. The package became `levi-git` with a binary named `levi`, so `cargo install levi-git` still installs a `levi` command. The README says why in one line.

### A demo GIF without personal data

The README's demo is recorded with [vhs](https://github.com/charmbracelet/vhs) from a script, on levi's own history. The first version showed the real author email in the commits, so the script now records a throwaway clone whose emails are rewritten to `levi@survey.corps`. The `/c` search in the demo is also typed in two halves, so the script file never contains the term it searches for and can't show up in its own results.

### Release binaries for every platform

Pushing a version tag now builds levi on GitHub Actions for five targets and attaches the archives, with their sha256 checksums, to the GitHub release:

| Target | Notes |
| --- | --- |
| macOS, Apple Silicon and Intel | |
| Linux x86_64 and ARM64 | Static musl builds that run on any distro |
| Windows x86_64 | Built, not yet battle-tested |

If the release doesn't exist yet, the workflow creates it, using that version's section of the changelog as the release notes. `cargo binstall levi-git` downloads the same archives, and Homebrew installs from a tap: `brew install rsdlt/tap/levi`.

## How Claude Code fit in

These sessions were less about algorithms and more about many small, careful changes. The same habits from the earlier sessions carried them:

- **The plan stayed the source of truth.** Nine commits in these sessions updated `docs/plan.md` along with the code, including the reasoning behind small choices like `Shift`-arrows over `Alt`-arrows and why `Ctrl-U` can't clear the search.
- **Every fix came with a test.** The crash fix shipped with the 0×0 terminal test, and `NO_COLOR` with a test that checks no cell keeps a color while the selection and match stay reversed. The suite went from 63 to 86 tests. The fixture repositories have names like `battlefield` and `titans`, in keeping with the Captain Levi theme.
- **Releases stayed small.** Ten releases across two sessions, most of them a single feature. Each one went through the same CI gates as night one.
- **Privacy got a review, too.** Removing the author email from the demo GIF was its own commit, 26 minutes after the GIF landed. A recorded demo is easy to publish without looking at every frame.

## Takeaways

- **Bound the expensive work.** A fixed budget with a cheaper fallback keeps the worst case fast without giving up the good result in the common case.
- **Drop events you don't need at the source.** Filtering mouse motion in the input thread made mouse support free.
- **Apply cross-cutting options once.** `NO_COLOR` as a pass over the finished frame touched one function instead of every widget.
- **Put the keys on screen.** A hint row makes features like `/c` discoverable without `--help`.
- **Check what you publish.** Demo recordings, release notes and package metadata reach more people than the code does.

The series continues as levi grows. The next post covers what came after 0.12.0.

---

*I'm Rodrigo Santiago, a product leader who builds. I co-founded [Foambyte](https://foambyte.com) with my brother Diego, a brewmaster who leads the product as CPO, and I designed and built the platform: architecture, frontend, backend, mobile and infrastructure. If you need someone who can own both the product and the code, [let's talk on LinkedIn](https://www.linkedin.com/in/rsdlt).*
