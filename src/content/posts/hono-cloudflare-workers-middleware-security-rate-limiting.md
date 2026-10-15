---
title: "Hono on Cloudflare Workers: Leaving a Docker VPS and Getting the Middleware Order Right"
pubDatetime: 2026-09-10T10:15:00-04:00
description: "Why I moved Foambyte's API from Docker Swarm to Hono on Cloudflare Workers, and the middleware chain for rate limiting, CAPTCHA, sessions and plan gating."
tags: ["hono", "cloudflare workers", "middleware", "security", "rate limiting", "backend", "foambyte"]
---

For its first year, [Foambyte](https://foambyte.com)'s API ran the way many side projects do: Docker images, a Docker Swarm stack on a VPS, Traefik as the reverse proxy with automatic TLS, and a couple of replicas per service. It worked, and every hour I spent patching the host, rotating certificates or reading Traefik labels was an hour not spent on the product.

In February 2026 I moved the API to **Hono on Cloudflare Workers**. This post explains why, and walks through the middleware chain that every request goes through, because on a public API the *order* of middleware is a security decision.

## Why Workers, and why Hono

**Cloudflare Workers** removed the parts of operations that didn't differentiate the product:

- **No servers to patch, scale or keep alive.** Deploys are a git push; rollbacks are a click.
- **Platform primitives as bindings.** Rate limiting, secrets and service configuration are declared next to the code instead of being separate infrastructure.
- **Web-standard runtime.** `Request`, `Response`, `fetch` and Web Crypto, the same APIs the frontend uses.
- **Predictable cost** for a bootstrapped product, with no idle VPS.

**Hono** is the natural framework for that runtime. It's small, fast, built on Web standards, and its middleware model is simple: middleware runs in the order you register it. Its `@hono/zod-openapi` integration gives me validated, documented routes (the [contract post](/posts/end-to-end-type-safety-hono-zod-openapi-monorepo/) covers that side).

The one real refactor the move required: **no global state.** A Worker isolate can serve many requests and can disappear at any moment, so the database client and the auth instance stopped being module-level singletons and became request-scoped, built from `c.env` bindings. That change was the prerequisite for everything else.

## The middleware chain

The principle behind the order is simple: **reject cheaply, as early as possible.** Checks that cost nothing run before checks that hit the database.

1. **Secure headers**: HSTS, `X-Content-Type-Options` and friends on every response.
2. **Body size limit**: Workers has no default request body limit, so the API sets one before anything parses a body.
3. **Global rate limiter**: per client IP, using Cloudflare's rate-limiting binding.
4. **Request ID and logging**: the logger deliberately records no headers or query strings.
5. **Error handling**: a central handler; clients never see internals.
6. **CORS**: an explicit allow-list of origins with credentials.
7. **Authentication**: [better-auth](https://www.better-auth.com) handles `/api/auth/*`, with Cloudflare Turnstile CAPTCHA on sign-up, sign-in and password reset.
8. **Session lookup**, then **`requireSession`** on everything under `/api`.
9. **Plan gating** per route, with `requireEntitlement`.

Public routes such as the health check are mounted before the session requirement; everything else is protected by default. Forgetting to protect a new route isn't possible, because protection isn't opt-in.

## Rate limiting that fails closed

In-memory rate limiters are a quiet bug on Workers: isolates don't share memory, so each one counts separately and the limit is never really enforced. Foambyte uses Cloudflare's **rate-limiting binding** instead, which counts at the edge across isolates.

The important design choice is what happens when the limiter isn't available:

```ts
const limiter = c.env.FREE_USER_RATE_LIMITER;
if (!limiter) {
  if (!isDev) {
    c.header("x-rate-limiter-mode", "missing-binding-fail-closed");
    return c.json({ error: "Service temporarily unavailable" }, 503);
  }
  return next();
}

const result = await limiter.limit({ key: getClientIp(c) });
```

Outside development the API **fails closed**: a misconfigured deploy returns `503` instead of silently running without protection. A loud outage is easier to fix than an invisible hole.

> [!WARNING]
> Key the limiter on `cf-connecting-ip`, not `X-Forwarded-For`. The client controls `X-Forwarded-For`, so keying on it lets an attacker pick a fresh rate-limit bucket for every request.

## CAPTCHA where bots actually go

Bots don't browse batch pages; they hammer sign-up and password-reset endpoints. So the CAPTCHA lives exactly there, through better-auth's captcha plugin with Cloudflare Turnstile:

```ts
captcha({
  provider: "cloudflare-turnstile",
  secretKey: turnstileSecret,
  endpoints: ["/sign-up/email", "/sign-in/email", "/request-password-reset"],
}),
```

Turnstile is invisible for most real users, which matters on a phone in a brewery.

## Plan gating as middleware

Foambyte has free and paid plans, and some features (tank management, for example) belong to paid plans. Instead of scattering `if (plan === ...)` checks through handlers, a feature requirement is part of the route definition:

```ts
export function requireEntitlement(feature: keyof EntitlementFeatures) {
  return createMiddleware<AppBindings>(async (c, next) => {
    const user = c.get("user");
    if (!user?.id) return c.json({ message: "UNAUTHORIZED" }, 401);

    const entitlements = await getUserEntitlements(getDb(c.env), user.id);
    if (!entitlements.features[feature]) {
      return c.json({ message: "FORBIDDEN" }, 403);
    }
    await next();
  });
}
```

```ts
middleware: [requireSession, requireEntitlement("tankManagement")],
```

Two details make this hold up:

- **Plans are defined once**, in the shared package that the frontend also imports. The UI hides a feature using the same definition the API uses to enforce it.
- **Limits are checked in the same transaction as the insert.** "Count the user's recipes, then insert one" is a race if two requests arrive together; doing the count and the insert atomically means parallel requests can't both slip under the limit.

## Takeaways

- **Move undifferentiated ops to the platform.** For a small team, Workers trades a VPS's flexibility for not having to run one, and that's the right trade.
- **Remove global state before you go serverless.** Request-scoped clients are the real migration; the deploy target is the easy part.
- **Order middleware by cost.** Headers, body limits and rate limits before anything touches the database.
- **Fail closed** on security dependencies, and **key on headers the client can't forge.**
- **Make authorization declarative.** Sessions and plan features belong in the route definition, where a reviewer can see them.

---

*I'm Rodrigo Santiago, a product leader who builds. I designed and built [Foambyte](https://foambyte.com) end to end: architecture, frontend, backend, mobile and infrastructure. If you need someone who can own both the product and the code, [let's talk on LinkedIn](https://www.linkedin.com/in/rsdlt).*
