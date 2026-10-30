---
title: "Weekly Roundup: The Binance Heist, a Trojanized Claude Code Extension, a Poisoned Monitoring Script and PHP2Shell"
description: "A $6.3B theft that started on an engineer's laptop, a fake Claude Code update that planted SSH backdoors, a third-party script that drained Polymarket traders, and PHP bugs exploited before disclosure."
pubDatetime: 2026-10-30T09:00:00-05:00
tags: ["weekly roundup", "security", "supply chain", "claude code", "php", "ai coding agents"]
---

It was a rough week for security. Four stories that matter if you build software on your own with AI agents: what happened, the numbers, and what I'm checking because of them.

## 1. Binance: about $6.3 billion stolen, starting from one laptop

On Oct 30, [Help Net Security reported](https://www.helpnetsecurity.com/2026/10/30/binance-crypto-hack/) on Binance's security update after the theft that began Oct 29:

- **About $6.3 billion** stolen from hot wallets. TRM Labs counts about $6.36 billion across ten blockchains; Chainalysis puts it at $6.4 billion. Likely the largest crypto theft on record.
- **Close to $3 billion frozen**, including more than 800M USDC by Circle and more than 1.56B USDT by Tether.
- **Entry point:** a **compromised DevOps engineer's laptop**, used to reach a service container and submit unauthorized withdrawals. Binance found no evidence of a private key leak.
- **Attribution:** TRM Labs and Chainalysis both point, with high confidence, to TraderTraitor, the North Korean group behind the 2025 Bybit hack. Binance is working with law enforcement to confirm.
- Withdrawals were paused; Binance says it will cover all losses.

**Why I care:** The attacker didn't break the cryptography. They got a person's machine and used the access it already had. As a solo developer, my laptop has deploy tokens, database credentials and an AI agent that runs commands with my permissions. I'm checking which long-lived tokens live on it, which can be scoped down or made short-lived, and what my agent can run without asking.

## 2. A trojanized Claude Code extension in Cursor's marketplace

On Oct 29, Cursor published [a security notice](https://cursor.com/blog/claude-code-extension-security-notice) about a malicious version of Anthropic's Claude Code extension ([The Hacker News has more detail](https://thehackernews.com/2026/10/official-claude-code-vs-code-extension.html)):

- Version **2.1.313** was served under the real extension ID, `anthropic.claude-code`, as a normal update. Cursor says Anthropic didn't build it; how it got there hasn't been explained.
- Live for **about 11 hours** (roughly 2:27 a.m. to 1:35 p.m. PT), reaching **at most 5,000 users**.
- It added an attacker SSH key labeled `svc-telemetry` to `authorized_keys`, tried to open a reverse SSH tunnel, installed persistence, and sent host details plus the names of up to 40 sensitive-looking environment variables to an attacker server.
- No sign it reached Microsoft's VS Code Marketplace or Open VSX. Anthropic published 2.1.314 there.
- Uninstalling isn't enough: check `authorized_keys`, remove persistence and rotate credentials from a clean machine.

**Why I care:** I use Claude Code every day, from the terminal. This didn't need a fake name or a typo; it came as an update to the real thing. An editor extension runs with my user's access, next to my SSH keys and tokens. I'm checking `authorized_keys`, turning off automatic extension updates where I can, and keeping the list of extensions short.

## 3. Polymarket traders drained through a performance monitoring script

On Oct 29, [BleepingComputer reported](https://www.bleepingcomputer.com/news/security/polymarket-halts-trading-after-crypto-draining-script-breach-25m-traced/) that attackers served malicious JavaScript to Polymarket users through DebugBear's Real User Monitoring script:

- The script came from DebugBear's CDN and used DebugBear's data endpoint for instructions and exfiltration.
- It detected logged-in users and used their sessions to liquidate positions and move tokens to an attacker wallet: about **$2.5 million** traced.
- Polymarket removed the script within minutes, switched to cancel-only mode and resumed about an hour later. It says affected traders will be fully reimbursed.
- DebugBear told RUM customers to remove its embed code.

**Why I care:** A vendor's script tag runs with the same power as your own code, in your users' sessions. Nobody had to touch Polymarket's code or servers. For my own React frontends: an inventory of every third-party script, a Content Security Policy that allows only those, and Subresource Integrity where a vendor supports pinned versions.

## 4. PHP2Shell: exploited before the patch existed

On Oct 21, the PHP Foundation [released fixes](https://thephp.foundation/blog/2026/10/21/todays-php-security-release-and-how-were-strengthening-php-security/) for two critical bugs, and Amazon [published what its honeypots saw](https://aws.amazon.com/blogs/security/amazon-threat-intelligence-identifies-php2shell-exploitation-prior-to-public-disclosure-in-madpot/):

- **CVE-2026-109618** (unauthenticated RCE on Apache with mod_php under default settings) and **CVE-2026-109619** (use-after-free shown as RCE against a real application). CVSS 9.2.
- Fixed in PHP **8.5.12, 8.4.27, 8.3.36 and 8.2.35**.
- Amazon recorded an exploit attempt on **Oct 17, four days before disclosure**; proof-of-concept code was public hours before the embargo lifted.
- Amazon's guidance: patch, investigate back to Oct 17, and for critical internet-facing bugs **measure patch time in hours**, not 7- or 30-day SLAs.

**Why I care:** I don't run PHP, but the timeline is the story: exploitation started before anyone could patch. On a managed runtime, those patches are the platform's job. My own dependencies are still mine, so I want alerts on new advisories for them, not a monthly check.

## Sources

- Help Net Security, ["Binance hit by $6.3 billion theft in what could be the biggest crypto heist on record"](https://www.helpnetsecurity.com/2026/10/30/binance-crypto-hack/), Oct 30, 2026
- Cursor, ["Security notice — malicious version of Anthropic.claude-code (2.1.313) identified in the Cursor Extension Marketplace"](https://cursor.com/blog/claude-code-extension-security-notice), Oct 29, 2026; The Hacker News, ["Official Claude Code Extension on Cursor Marketplace Trojanized with Persistent SSH Backdoor"](https://thehackernews.com/2026/10/official-claude-code-vs-code-extension.html), Oct 30, 2026
- BleepingComputer, ["Polymarket halts trading after crypto-draining script breach, $2.5M traced"](https://www.bleepingcomputer.com/news/security/polymarket-halts-trading-after-crypto-draining-script-breach-25m-traced/), Oct 29, 2026
- The PHP Foundation, ["Today's PHP security release and how we're strengthening PHP security"](https://thephp.foundation/blog/2026/10/21/todays-php-security-release-and-how-were-strengthening-php-security/), Oct 21, 2026; AWS Security Blog, ["Amazon threat intelligence identifies PHP2Shell exploitation prior to public disclosure in MadPot"](https://aws.amazon.com/blogs/security/amazon-threat-intelligence-identifies-php2shell-exploitation-prior-to-public-disclosure-in-madpot/), Oct 21, 2026
