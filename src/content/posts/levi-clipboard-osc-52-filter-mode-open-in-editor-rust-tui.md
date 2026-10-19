---
title: "Building levi, Saturday Evening: Getting a Find Out to Your Clipboard, Your Editor and Your Agent"
pubDatetime: 2026-10-21T09:00:00-05:00
description: "levi 0.13 to 0.14.1: copying over SSH with OSC 52, drag to copy, levi --filter for scripts and coding agents, and Ctrl-O to open a file at the line you're reading."
tags: ["levi", "rust", "git", "tui", "cli", "neovim", "claude code", "ai coding agents"]
---

This is the fifth post in the [Building levi](/levi/) series. The [previous one](/posts/levi-day-two-rust-tui-polish-mouse-no-color-release-binaries/) ended with 0.12.0 at 14:02 on October 17: a fast, polished viewer. Until then, the only thing you could take out of levi was the sha that `Enter` prints. The session that evening, from 19:34 to 21:27, opened three more ways out: the clipboard, a headless search for scripts and agents, and your editor.

It shipped three releases, 0.13.0 through 0.14.1, and grew the test suite from 86 tests to 102.

## Paths that keep their file name

The first commit of the evening fixed a small annoyance in deep repositories. A path like `app/frontend/src/components/frontend/...` filled the files column before the file name ever showed. Long paths now lose their start instead, whole leading directories first:

```
…/components/frontend/Button.tsx
```

Renames follow `git diff --stat` and write the shared directories once, as in `src/{old.rs → new.rs}`. When even the part in braces can't fit, the row shows only the new path, so a cut never lands inside the rename. The fuzzy-match highlights move with the visible text.

## Copying: Ctrl-Y and the mouse

### Two ways at once

`Ctrl-Y` copies the full sha of the selected commit and keeps levi open. `Enter` prints it and quits. The status line says what was copied until the next key.

Copying from a terminal program has no single right way, so levi's new clipboard module uses two, together:

- **OSC 52 through the terminal.** An escape sequence asks the terminal itself to set the clipboard. It works over SSH and in Ghostty, iTerm2, kitty, WezTerm, Alacritty and Windows Terminal.
- **The platform's own tool:** `pbcopy` on macOS, or `wl-copy`, `xclip` or `xsel` on Linux. This covers terminals without OSC 52, such as macOS Terminal.app.

Neither one reports back, so levi doesn't try to choose:

```rust
/// Copies `text`. Neither way reports back, so this can't fail; at worst the
/// clipboard is left as it was.
pub fn copy(text: &str) {
    // stderr is the terminal levi draws on.
    let mut terminal = io::stderr();
    let _ = write!(terminal, "\x1b]52;c;{}\x07", base64(text.as_bytes()));
    let _ = terminal.flush();

    let text = text.to_owned();
    thread::spawn(move || {
        for tool in tools() {
            if pipe(tool, &text) {
                break;
            }
        }
    });
}
```

The sequence goes to stderr because levi draws there. stdout stays reserved for the sha. The app state only records what to copy, and the main loop, which owns the terminal, sends it.

### Drag to copy

Day two's mouse support dropped drag events to keep the mouse cheap, which also took away the terminal's native selection. Four minutes after `Ctrl-Y`, levi got its own:

- **In the diff,** a drag selects text precisely, character by character across lines, shows it in reverse video and copies it on release. Past the top or bottom edge, the diff scrolls along.
- **In the commits and files lists,** whose rows are shortened to fit, a drag selects whole rows and copies their full values: complete paths, and commits as `<short sha> <subject>`, like `git log --oneline`.
- **A click selects nothing.** The pointer has to move first, so clicking still only picks a row.

The selection lives in content coordinates, so scrolling doesn't move it. Only left-button drags reach the app. Motion and other drags are still dropped in the input thread, as before.

## levi --filter: the same search, no TUI

[Claude Code](https://claude.com/claude-code) and other coding agents run commands, but they can't work a TUI. `levi --filter` gives them levi's search anyway. It runs a query the way the search bar would and prints one `<sha> <subject>` line per match, best first, like `fzf --filter`:

```sh
$ levi --filter 'ui.rs /c STACK_BELOW'
d3a93ab5f5c98621cbaf9079d0c952786239d221 Stack the lists above the diff on narrow terminals
```

The whole syntax works: fuzzy terms, `/c` code search and `/r` for the reflog, plus an optional revision. Three details make it usable from scripts:

- **No terminal needed.** The same app state runs headless, fed by the log loader and the code searcher until both finish. A `/c` search starts as soon as the log is in, with no debounce, since nobody is typing.
- **Exit codes follow grep:** 0 found, 1 nothing, 2 error. An agent can tell an empty search from a broken one.
- **A closed pipe ends the output quietly,** so `levi --filter … | head` doesn't print an error.

The README gained a short brief to paste into `CLAUDE.md` or `AGENTS.md`, so an agent knows the tool exists and how to query it.

`--filter` also turned out to be a benchmark harness. The [speed numbers in the README](https://github.com/rsdlt/levi#speed) all run through it, so anyone can rerun them with a stopwatch and no terminal tricks.

## Hunk jumps across files

`Shift-Down` jumped to the next hunk, but stopped at the end of the file. Now it carries on to the next file's first hunk, and `Shift-Up` from the first hunk goes back to the previous file's last one, like `]c` in Vim. Only the ends of the commit stop it.

The next file's diff may still be loading when you press the key. The jump waits as a pending move that lands when the diff arrives, and any other key cancels it.

## Ctrl-O: open the file at the line you're reading

`Ctrl-O` opens the selected file in your editor, at the line showing at the top of the diff. levi works out that line from the hunk headers.

- **Inside Neovim's terminal** (`$NVIM` is set), levi asks that Neovim to open the file in a new tab. Nothing nests, and levi keeps its own tab.
- **Everywhere else,** levi runs `$VISUAL`, `$EDITOR` or `vi` through `sh`, as git does, and hands it the terminal until it quits. Most editors take `+N file`. levi knows the few that want `file:N` (Helix, Zed, Sublime) or `--goto` (VS Code, VSCodium, Cursor).

Handing over the terminal needed a change in the input thread. It used to block on reads, and a blocked read would steal the editor's first keystroke. It now polls in 100 ms spells and can be paused: it parks, and says so, before the editor starts.

### Files that aren't there anymore

Seventeen minutes later, `Ctrl-O` learned to open files that are gone from the working tree: deleted, renamed since, or in a bare repository. levi writes the file as git has it in that commit (or in its parent, for a file the commit deletes) to a temporary directory, keeping its name so the editor still highlights it. The status line says it's read-only history. The copy is removed when the editor quits. Neovim's copy stays, since its buffer may still be open, and levi marks the buffer `nomodifiable`.

The same evening, levi got a recipe for running it in a Neovim floating window on `<leader>gl`, tested in a real Neovim. It's now in [docs/neovim.md](https://github.com/rsdlt/levi/blob/main/docs/neovim.md).

## The bug the demo found

0.14.0 shipped at 21:03. Re-recording the demo GIF to show `Ctrl-O` broke it within the half hour, because the demo runs levi as a picker, inside `git show $(levi)`.

In that command, levi's stdout is the pipe that carries the sha. Two things leaked into it:

- **The editor inherited stdout.** It drew its whole screen into the pipe, so it never appeared.
- **Coming back from the editor,** levi's redraw cleared the terminal through ratatui, which asks for the cursor position. crossterm writes that query, `ESC[6n`, to stdout, so it landed in front of the sha.

The fix, in 0.14.1, gives the editor the terminal levi draws on, and `/dev/tty` for input when stdin isn't a terminal:

```rust
// Simplified from src/editor.rs (the Unix half)
pub fn on_terminal(cmd: &mut Command) -> Result<()> {
    cmd.stdout(io::stderr().as_fd().try_clone_to_owned()?);
    if !io::stdin().is_terminal() {
        cmd.stdin(std::fs::File::open("/dev/tty")?);
    }
    Ok(())
}
```

The redraw now clears the screen on stderr and starts a fresh terminal handle, so nothing but the sha reaches stdout. No unit test had caught it, because the bug needed a real pipe, a real editor and a real terminal at once. The demo had all three.

## How Claude Code fit in

- **Each feature landed as its own commit and release.** Copying shipped as 0.13.0, the editor and `--filter` as 0.14.0, the fix as 0.14.1, all within two hours, each through the same CI gates.
- **Commit messages carry the reasoning.** The `--filter` commit explains the exit codes and why `/c` skips the debounce. The fix commit says how the bug was found: "Found by recording the demo, which runs levi inside $(...)."
- **Real tools, not only tests.** The Neovim recipe was tried in a real Neovim before it went in the README, and its commit says so. The test suite grew by 16 tests, but the release-blocking bug came from running levi the way users do.
- **The plan kept up.** `docs/plan.md` records the clipboard's two paths, the editor rules and `--filter`'s exit codes, next to the code that implements them.

## Takeaways

- **When you can't detect what works, do both.** OSC 52 plus the platform tool covers SSH and Terminal.app without asking the user to configure anything.
- **Give agents a plain-text door.** A headless mode with grep's exit codes makes a TUI usable by scripts, agents and benchmarks alike.
- **Guard stdout in a picker.** Anything a child process or a library writes there corrupts the one value you promised to print.
- **Record your demo the way people use the tool.** The demo GIF found the bug that 102 tests missed.

The next post covers the morning after: syntax colors, a logo, and handing a find straight to an agent's input.

---

*I'm Rodrigo Santiago, a product leader who builds. I co-founded [Foambyte](https://foambyte.com) with my brother Diego, a brewmaster who leads the product as CPO, and I designed and built the platform: architecture, frontend, backend, mobile and infrastructure. If you need someone who can own both the product and the code, [let's talk on LinkedIn](https://www.linkedin.com/in/rsdlt).*
