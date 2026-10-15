---
title: "Choosing Authentication for a Web + Mobile SaaS: Why better-auth"
pubDatetime: 2025-06-12T09:15:00-04:00
description: "Why Foambyte uses better-auth with Hono and Drizzle instead of Clerk, Auth0 or Supabase Auth, and how cookie sessions work across the web and Capacitor apps."
tags: ["authentication", "better-auth", "hono", "drizzle", "capacitor", "security", "foambyte"]
---

Authentication is one of the first architectural decisions in a SaaS and one of the hardest to undo. Every user row, session and permission check depends on it. For [Foambyte](https://foambyte.com), a brewing platform that runs on the web and as iOS and Android apps built with Capacitor, I chose **[better-auth](https://www.better-auth.com)**. As of this week, sign-in works over HTTPS on all three platforms.

This post explains the decision and the one part that needs care: sessions inside a mobile webview.

## The options

| Option | Strength | Why it didn't fit |
| --- | --- | --- |
| **Clerk / Auth0** | Polished hosted UI, little code | Users live in a third-party store, priced per active user |
| **Supabase Auth** | Integrated with the database | Couples identity to one backend provider |
| **Roll your own** | Full control | Password hashing, sessions, resets and verification are easy to get subtly wrong |
| **better-auth** | A library, not a service | You still own the integration and the UI |

## Why better-auth

**1. We own the user data.** Users, sessions and accounts are tables in our own database, next to recipes and batches. There's no external user store to sync, no per-user pricing that grows with success, and no migration project if a vendor changes terms.

**2. It isn't tied to a host.** better-auth is a TypeScript library that talks to the database through an adapter. If we change database provider or hosting, auth comes along; it doesn't belong to the platform we happen to be on.

**3. It fits the stack.** It's framework-agnostic, exposes a standard request handler that mounts directly in Hono, and has a first-class **Drizzle adapter**, so the auth tables are defined and migrated like every other table:

```ts
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  basePath: "/api/auth",
  emailAndPassword: { enabled: true },
});
```

```ts
// Hono: better-auth owns /api/auth/* (simplified)
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));
```

**4. One session model for web and mobile.** better-auth uses cookie sessions, and a Capacitor app is a webview. That means the same session mechanism can serve the website and the native apps, with no separate token flow to build and secure.

## Making cookie sessions work in Capacitor

"Cookies just work" is true in a browser tab. In a native webview the details matter, because the app's origin isn't your website's origin:

- **Android** serves the app from `https://localhost` (with `androidScheme: "https"`).
- **iOS** serves it from `capacitor://localhost`.

The API is a different origin from both, so three settings have to line up.

**Trusted origins.** better-auth rejects requests from origins it doesn't know, which protects against CSRF. The webview origins have to be listed explicitly, next to the web app's origin:

```ts
trustedOrigins: [
  webAppOrigin,
  "https://localhost",    // Android webview
  "capacitor://localhost", // iOS webview
],
```

**Cross-site cookie attributes.** A cookie sent from a webview to a different origin must be `Secure` and `SameSite=None`, and should be `HttpOnly` so scripts can't read it.

**Credentials on every request.** The client sends cookies cross-origin only when asked to:

```ts
export const authClient = createAuthClient({
  baseURL: apiBaseUrl,
  fetchOptions: { credentials: "include" },
});
```

The same applies to the app's own API client, and the server's CORS policy has to allow credentials from exactly those origins, never a wildcard.

> [!TIP]
> Test auth on a real device early. Simulators and desktop browsers are more forgiving with cross-site cookies than a production webview. Getting HTTPS and cookies right on iOS, Android and the web together took more effort than the auth code itself.

## Protecting the API

On the server, a Hono middleware asks better-auth for the session on every request and stores the user in the request context. Protected routes then require it:

```ts
// simplified
app.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set("user", session?.user ?? null);
  c.set("session", session?.session ?? null);
  await next();
});
```

Handlers never parse cookies or tokens; they read `c.get("user")`. Authorization (does this user own this recipe?) stays in our own code, where it belongs.

## Takeaways

- **Treat identity as core data.** Owning the user tables avoids lock-in and per-user costs that scale against you.
- **Prefer a library over a platform** when you might change hosts or databases later.
- **One session model for web and mobile** keeps the security surface small; Capacitor makes cookie sessions viable.
- **In webviews, be explicit:** trusted origins, `Secure` + `SameSite=None` cookies, `credentials: "include"`, and a strict CORS allow-list.

---

*I'm Rodrigo Santiago, a product leader who builds. I co-founded [Foambyte](https://foambyte.com) with my brother Diego, a brewmaster who leads the product as CPO, and I designed and built the platform: architecture, frontend, backend, mobile and infrastructure. If you need someone who can own both the product and the code, [let's talk on LinkedIn](https://www.linkedin.com/in/rsdlt).*
