---
title: "Building levi, Nine Days Later: A Neovim Plugin That Hands Your Coding Agent a Commit"
pubDatetime: 2026-10-31T09:00:00-05:00
description: "levi's Neovim plugin: :Levi opens the git log in a floating window, and :LeviSend types a commit, file and lines into your agent's Neovim terminal, unsent."
tags: ["levi", "neovim", "lua", "git", "tui", "claude code", "ai coding agents"]
---

This is the tenth post in the [Building levi](/levi/) series. The [previous one](/posts/levi-focus-tell-coding-agent-what-you-see-tmux-plugin-rust-tui/) covered 0.20.0: `levi --focus` and a tmux plugin. After nine quiet days, one commit on Friday, October 30, added a third way to hand what you find in [levi](https://github.com/rsdlt/levi) to a coding agent: a Neovim plugin with two commands, `:Levi` and `:LeviSend`.

It's the first change to reach levi's `main` through a pull request (#2) instead of a direct commit. It isn't in a release yet: the changelog lists it under Unreleased, and levi is still at 0.20.0. It doesn't need one, since a plugin manager installs it straight from the repository.

## From a snippet to a plugin

Until Friday, `docs/neovim.md` held a snippet to paste into your config: about 25 lines of Lua that opened levi in a floating window on `<leader>gl` and showed the commit you picked with `git show`. Using diffview.nvim instead meant swapping lines by hand, following a comment.

The commit replaces it with a plugin in two files:

- **`plugin/levi.lua`** (11 lines) defines the two commands. Neovim runs it at startup, so it stays small.
- **`lua/levi/init.lua`** (141 lines) does the work, and loads on first use.

Both sit at the repository root, not in a subfolder like the herdr and tmux plugins. The commit body says why: so lazy.nvim and `vim.pack` install `rsdlt/levi` as-is. The README's lazy.nvim spec is one line:

```lua
{ "rsdlt/levi", keys = { { "<leader>ga", "<cmd>LeviSend<cr>" } } }
```

The plugin binds no keys of its own. It needs levi 0.16 or newer on your `PATH` and Neovim 0.11 or newer, and says so when either is missing instead of failing.

## `:Levi`: browse, then show

`:Levi` opens levi in a float covering 90% by 85% of the editor, in the repository of the file you're in. Press `Enter` on a commit and the float closes and the commit opens in a new tab: in [diffview.nvim](https://github.com/sindrets/diffview.nvim) when it's installed, as `git show` otherwise.

Both commands take one revision, like levi does, so `:Levi main..HEAD` shows only what your branch adds to main. Inside the float, levi works as it does anywhere: `C-o` already opened files in the surrounding Neovim, in a new tab, since 0.14.0.

### One pty for two streams

levi draws its screen on stderr and prints the pick on stdout, which is how `git checkout $(levi)` works. A Neovim terminal job has one pty for both. So the plugin runs levi through the shell and sends stdout to a temp file, read back when levi exits:

```lua
-- Simplified from lua/levi/init.lua
-- levi draws on stderr, so its stdout, the pick, can go to a file.
local cmd = { "levi" }
for _, arg in ipairs(args) do table.insert(cmd, vim.fn.shellescape(arg)) end
table.insert(cmd, "> " .. vim.fn.shellescape(out))
vim.fn.jobstart(table.concat(cmd, " "), {
  term = true,
  cwd = dir,
  on_exit = function(_, code)
    local picked = vim.trim(table.concat(vim.fn.readfile(out), "\n"))
    vim.fn.delete(out)
    if code ~= 0 and code ~= 130 then
      -- levi said why on its screen; leave it up until it's read.
      vim.cmd.stopinsert()
      vim.keymap.set("n", "q", function() pcall(vim.api.nvim_win_close, win, true) end, { buffer = buf })
      return
    end
    if vim.api.nvim_win_is_valid(win) then vim.api.nvim_win_close(win, true) end
    if code == 0 and picked ~= "" then on_pick(picked) end
  end,
})
```

The exit codes do the routing. 0 is a pick. 130 is "quit without picking", the same code the herdr and tmux scripts check for, and it closes the float quietly. Anything else means levi couldn't start, say outside a repository, and the float stays up with levi's own message until you press `q`.

### A root commit has no range

diffview takes a range, and the plugin passes `sha^!`: the commit against its parent. The repository's first commit has no parent, so the plugin asks git first and falls back to `git show`:

```lua
-- diffview takes a range, and a root commit has no parent to start one at.
git("rev-parse", "--verify", "--quiet", sha .. "^")
if vim.fn.exists(":DiffviewOpen") == 2 and vim.v.shell_error == 0 then
  return vim.cmd("DiffviewOpen -C" .. vim.fn.fnameescape(dir) .. " " .. sha .. "^!")
end
```

The plan records the same edge case: diffview "not for a root commit, which has no `sha^!` range".

## `:LeviSend`: type it into the agent's terminal

`:LeviSend` is the agent half. Run your agent in a Neovim terminal, open levi, pick the commit, the file and the lines, and press `Enter`. levi runs with `--pick-context`, and the plugin types the reference into the agent's input:

```
In commit d3a93ab ("Stack the lists above the diff on narrow terminals"), src/ui.rs lines 27-40: why 120?
```

Everything up to the colon comes from levi. The question is yours to finish, because the plugin never presses `Enter`, the same rule as the herdr and tmux plugins. Neovim's `chansend()` is what makes this possible: like herdr and tmux, it can write text into a terminal, which no agent offers on its own.

### Which terminal

The plugin has to guess which terminal runs your agent. The rule: the terminal you're in, or else the live one you used last.

```lua
-- A terminal still running its program.
local function live_terminal(buf)
  return vim.bo[buf].buftype == "terminal" and vim.fn.jobwait({ vim.bo[buf].channel }, 0)[1] == -1
end

-- The terminal to type into: the one you're in, or the one you used last.
local function agent_terminal()
  local current = vim.api.nvim_get_current_buf()
  if live_terminal(current) then return current end
  local last
  for _, info in ipairs(vim.fn.getbufinfo({ bufloaded = 1 })) do
    if live_terminal(info.bufnr) and (not last or info.lastused > last.lastused) then last = info end
  end
  return last and last.bufnr
end
```

Two details make it hold up:

- **Pick the target before levi opens.** levi's own float is a terminal too, and the newest one. A comment in `M.send` says it: "Before levi opens: its own window is a terminal too."
- **Check it again after the pick.** If the agent's terminal closed while you browsed, the plugin says so instead of writing to a dead channel.

When the terminal is on screen, the plugin moves you into it, in insert mode, ready to type. When it's hidden, it types anyway and names the buffer it typed into. Because it works with any terminal buffer, it also works with plugins that open an agent in one.

## The docs, in levi's voice

`docs/neovim.md` became the plugin's README. It keeps the tone of levi's main README, where levi is "he" and commands are "orders":

> *You live in that editor. Fine. levi comes to you.*

The sections are "Enlist", "Orders" and "Fine print". The fine print repeats the safety rule from the tmux plugin, "a wrong terminal costs a `C-u`", and points anyone who wants a variation at `lua/levi/init.lua`, which exposes `require("levi").open(rev)` and `require("levi").send(rev)`.

## How Claude Code fit in

- **The plan entry kept growing in place.** "Sending what's on screen to a coding agent" went from herdr, to herdr and tmux, to herdr, tmux and Neovim, with one sub-bullet per tool for its quirks. The Neovim one holds the pty and root-commit details.
- **The commit says where the files go and why.** "The plugin sits at the repository root, so lazy.nvim and vim.pack install rsdlt/levi as-is" is the first line of the body.
- **One commit carried everything.** Code, plan, changelog, README section and the plugin's own README went in together, as with 0.20.0's feature commit.
- **The pattern was already proven.** Exit code 130, the unsent reference and "In <pick>: " all came from the herdr and tmux scripts, so the Lua only had to solve what was new to Neovim.

## Takeaways

- **Put a Neovim plugin at the repository root** if it lives with another project. Plugin managers install the repository as-is, with no subfolder option to explain.
- **Separate a TUI's screen from its answer.** levi draws on stderr and answers on stdout, so wrappers in tmux, herdr and Neovim can each capture the answer their own way.
- **Choose a target before you create something that looks like it.** levi's float would have won "most recently used terminal" if the plugin had looked after opening it.
- **Check for a parent before building a `sha^!` range.** The first commit in a repository has none.
- **Keep a stable exit code for "quit without picking".** Every wrapper can tell a cancel from an error without parsing output.

levi is at 0.20.0, with the Neovim plugin waiting for the next release.

---

*I'm Rodrigo Santiago, a product leader who builds. I co-founded [Foambyte](https://foambyte.com) with my brother Diego, a brewmaster who leads the product as CPO, and I designed and built the platform: architecture, frontend, backend, mobile and infrastructure. If you need someone who can own both the product and the code, [let's talk on LinkedIn](https://www.linkedin.com/in/rsdlt).*
