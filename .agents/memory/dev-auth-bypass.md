---
name: dev auth bypass
description: Why/how the API auto-authenticates in non-production so the Replit preview skips the login screen.
---

# Dev-only auth bypass

`authMiddleware` (artifacts/api-server/src/middlewares) auto-signs-in requests when there is no valid session, picking the highest-privilege active user (super_admin → admin → any active). Gated on `DEV_AUTH_BYPASS = process.env.NODE_ENV !== "production"`.

**Why:** The Replit dev preview renders the app in a cross-site iframe; even with a persistent session, requiring the developer to log in to their own app on every preview was unwanted friction. The bypass removes the login screen during development.

**How to apply:**
- Published deploys run `NODE_ENV=production` (set in the api-server artifact.toml production env), so the bypass is OFF in production — the live app stays behind email/password. Do not weaken that gate.
- The dev workflow runs `export NODE_ENV=development`, so the bypass is ON locally.
- Because of this, an *unauthenticated* request in dev still returns a populated `req.user` / `/auth/user` user. Don't treat "401 in dev" as the unauthenticated baseline — test auth/permission logic with `NODE_ENV=production` or by reasoning about the gate.
- Related: session cookie is `SameSite=None; Secure` (set + clear) so the session survives the preview iframe.
