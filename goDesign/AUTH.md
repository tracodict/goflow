
# Authentication & Authorization Design (Google OAuth SSO for *.lizhao.net)

## Goals

1. Users authenticate once with Google; the session is reused transparently across all sub‑domains `*.lizhao.net` (A.lizhao.net, B.lizhao.net, etc.).
2. Minimal coupling: each application can remain relatively stateless regarding auth and simply validate a shared session cookie.
3. Strong security: least-privilege tokens, revocation, CSRF protection, domain allow‑list.
4. Extensible authorization: per-app and global roles, future policy engine friendly.

## High-Level Architecture

```
Browser ──▶ Subdomain App (A.lizhao.net)
	 │            │  (auth middleware)
	 │  no session│
	 │            ▼ 302 redirect
	 │        Auth Service (auth.lizhao.net)
	 │            │  (OAuth start)
	 │            ▼
	 │        Google OAuth 2.0 (Authorization Code + PKCE)
	 │            ▲ callback with ?code
	 │            │ exchange code → tokens
	 │            ▼
	 │   Session Store (Redis/DB) ◀── user profile, roles
	 │            │ set-cookie Domain=.lizhao.net (lz_sess)
	 ▼            ▼
Subdomain App reloaded with cookie → validates session → grants access
```

## Components

| Component | Purpose |
|-----------|---------|
| `auth.lizhao.net` | Central OAuth broker, session issuance, refresh, logout, role admin |
| Google OAuth | Identity provider (OpenID Connect) |
| Session Store (Redis or SQL) | Maps opaque session IDs → user & role data |
| Subdomain Apps | Enforce authentication & authorization; call Auth Service for session introspection/refresh |

## OAuth Flow

1. User hits protected route at `A.lizhao.net`.
2. Middleware checks for `lz_sess` cookie. If absent/invalid → redirect to:
	 `https://auth.lizhao.net/oauth/start?return=https%3A%2F%2FA.lizhao.net%2Fdashboard`
3. Auth Service creates `state` & `PKCE` (if using PKCE) and redirects user to Google `authorization_endpoint`.
4. Google authenticates user → redirects to `https://auth.lizhao.net/oauth/callback?code=...&state=...`.
5. Auth Service validates `state`, exchanges `code` for tokens, fetches `userinfo` (or decodes ID token) to obtain `sub`, `email`, `hd`, `name`, `picture`.
6. Validates email domain (allow‑list, e.g. `@lizhao.net`).
7. Creates session record and sets `lz_sess` cookie (Domain `.lizhao.net`).
8. Redirects back to original `return` URL. Browser now includes the cookie for **all** subdomains.

## Session Model

### Opaque Session (Recommended)

```
SessionRecord {
	id: string (random 128-bit encoded)
	userId: string (Google sub)
	email: string
	name: string
	picture?: string
	globalRoles: string[]
	appRoles: { [appKey: string]: string[] }
	createdAt: timestamp
	expiresAt: timestamp (absolute)
	lastSeenAt: timestamp
	refreshToken?: string (rotating, hashed)
	version: number
}
```

Stored in Redis (TTL) or DB (with job to purge expired). Lookup by `id` in constant time.

### Cookie

```
Set-Cookie: lz_sess=<opaque-id>; Domain=.lizhao.net; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=3600
```

Optionally a lightweight **non-sensitive** display cookie (NOT for auth) e.g. `lz_usr=<base64(name|picture)>` (not required).

## Authorization Strategy

1. **Global roles**: apply across all apps (e.g. `admin`, `support`).
2. **Per-app roles**: namespaced roles (e.g. `workflow:editor`, `billing:viewer`). Stored under `appRoles[appKey]`.
3. Subdomain mapping: Each app identifies itself via an `APP_KEY` (env) and extracts relevant roles.
4. Local policy: App can translate roles into permissions or leverage future policy engine (e.g. OPA / Cedar) with session context.

## Endpoints (Auth Service)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/oauth/start` | Initiate Google OAuth (accepts `return`) |
| GET | `/oauth/callback` | Handle Google response, set session cookie |
| GET | `/session` | Returns user + role payload (if valid session) |
| POST | `/session/refresh` | Rotate/extend session if near expiry |
| POST | `/logout` | Invalidate session (and optionally all sessions for user) |
| GET | `/introspect` (optional) | Machine-to-machine validation (returns active/claims) |
| POST | `/admin/roles/assign` | Admin: Assign global/app roles |
| POST | `/admin/roles/revoke` | Admin: Revoke roles |
| GET | `/admin/roles/list?userId=` | Admin: View roles |

## Subdomain Middleware (Pseudo)

```ts
async function authMiddleware(req, res, next) {
	const sid = req.cookies['lz_sess']
	if (!sid) return redirectToStart(req, res)
	const session = await sessionCache.get(sid) || await fetchAuthSession(sid)
	if (!session) return redirectToStart(req, res)
	if (isExpiringSoon(session)) scheduleBackgroundRefresh(sid)
	req.user = sessionToPrincipal(session, process.env.APP_KEY)
	return next()
}
```

## Refresh Logic

* Session TTL: 1h (example).
* Refresh window: if `<15m` remaining on access, call `/session/refresh` (server → server) to extend (sliding expiration) and rotate `refreshToken` (if used).
* Idle timeout: Optional — if `lastSeenAt` older than idle threshold (e.g. 8h) force re-login.

## Logout

1. User triggers logout on any subdomain → POST `/logout` (Auth Service).
2. Auth Service deletes session record, sets cookie with `Max-Age=0`.
3. (Optional) Google token revocation endpoint called using refresh token.
4. Return 204 or redirect to a logged-out landing page.

## Security Controls

| Concern | Mitigation |
|---------|------------|
| Cookie theft | `Secure; HttpOnly; SameSite=None;` + TLS everywhere |
| XSS token exfil | Session id never exposed to JS (HttpOnly) |
| CSRF on state-changing APIs | Either: (a) Use additional bearer JWT from `/session` response in `Authorization` header; or (b) Double-submit CSRF token cookie + header. |
| Session fixation | Always issue new session id after login / privilege escalation |
| Revocation | Opaque session lookups allow immediate invalidation; maintain optional `revokedSessionIds` short cache if replicating |
| Brute force session id | 128-bit random (>= 22 char base64url) + rate limiting invalid lookups |
| Domain abuse | Validate `return` URLs against allowed subdomain pattern `^https://[a-z0-9-]+\.lizhao\.net(/|$)` |
| Unauthorized domain emails | Enforce domain allow‑list (`email.endsWith('@lizhao.net') || hd === 'lizhao.net'`) |

## Role Resolution Example

```ts
function sessionToPrincipal(session, appKey) {
	return {
		userId: session.userId,
		email: session.email,
		name: session.name,
		picture: session.picture,
		roles: [
			...session.globalRoles,
			...(session.appRoles?.[appKey] || [])
		]
	}
}
```

## Minimal Data Returned by `/session`

```json
{
	"userId": "google-sub-123",
	"email": "user@lizhao.net",
	"name": "User Name",
	"picture": "https://lh3.googleusercontent.com/...",
	"roles": ["admin", "workflow:editor"],
	"exp": 1735689600
}
```

## Implementation Notes

* Use the **Google OIDC discovery doc** to dynamically obtain endpoints (caching with TTL).
* Employ `@octokit/request`-like retry/backoff or simple exponential backoff on code exchange network errors.
* Keep an in-memory LRU for hot session lookups; fallback to primary store on miss.
* Expose a health endpoint verifying:
	* Connectivity to session store.
	* Ability to parse cached Google JWKs.
* JWKs for Google ID token signature validation cached (e.g. 24h or `cache-control` informed).

## Future Extensions

| Feature | Outline |
|---------|---------|
| MFA step-up | Store `mfa_verified_at`; ask for TOTP on sensitive actions |
| Audit trail | Append log events for login, refresh, logout, role change |
| Session list | `/sessions/list` for user to revoke other devices |
| Policy engine | Represent roles → permissions in OPA / Cedar documents |
| SCIM / Provisioning | Sync permitted users & roles automatically |

## Sequence Diagram (Text)

```
User -> A.lizhao.net: GET /dashboard
A.lizhao.net -> User: 302 Location auth.lizhao.net/oauth/start
User -> auth.lizhao.net: GET /oauth/start
auth.lizhao.net -> Google: 302 authorize
User -> Google: GET authorize
Google -> auth.lizhao.net: 302 /oauth/callback?code=...
auth.lizhao.net -> Google: POST token
Google -> auth.lizhao.net: 200 {id_token,...}
auth.lizhao.net -> SessionStore: CREATE session
auth.lizhao.net -> User: Set-Cookie lz_sess=...; Domain=.lizhao.net; 302 return=https://A.lizhao.net/dashboard
User -> A.lizhao.net: GET /dashboard (Cookie lz_sess)
A.lizhao.net -> SessionStore: GET session
SessionStore -> A.lizhao.net: session
A.lizhao.net -> User: 200 (dashboard)
```

## End-to-End Authentication & Authorization Flow (with curl)

This section demonstrates the e2e flow for authentication and authorization using curl commands. Note: For browser-based OAuth, some steps require manual interaction or copying cookies.

### 1. Start OAuth Login (Get Redirect URL)

```sh
curl -i "https://auth.lizhao.net/oauth/start?return=https%3A%2F%2FA.lizhao.net%2Fdashboard"
# Response: HTTP 302 redirect to Google OAuth URL
```

### 2. Complete Google Login (Manual Step)

- Open the Google OAuth URL from the previous step in your browser.
- Login and approve access.
- Google redirects to `https://auth.lizhao.net/oauth/callback?...`

### 3. Exchange Code for Session (Handled by Auth Service)

- The Auth Service processes the callback, creates a session, and sets the `lz_sess` cookie for `.lizhao.net`.
- To simulate this with curl, extract the `lz_sess` cookie from your browser after login.

### 4. Access Protected Resource with Session Cookie

```sh
curl -i --cookie "lz_sess=YOUR_SESSION_ID" https://A.lizhao.net/dashboard
# Should return 200 if session is valid
```

### 5. Introspect Session (Get User & Roles)

There are two ways to obtain the current authenticated principal:

1. From a sub‑domain app (recommended for the browser UI): call the app's local endpoint `/api/session`. The app's server will forward‑validate (introspect) the `lz_sess` cookie against the central Auth Service and return a minimal principal JSON (or 401). This keeps cross‑origin concerns isolated and allows additional app‑specific role filtering.
2. Directly against the Auth Service (primarily for debugging / automation): call `https://auth.lizhao.net/session` with the `lz_sess` cookie.

Browser UI flow (what the React app uses):
```sh
curl -i --cookie "lz_sess=YOUR_SESSION_ID" https://A.lizhao.net/api/session
# 200 -> { userId, email, name, picture?, roles[], exp }
```

Central introspection (debug / external tooling):
```sh
curl -i --cookie "lz_sess=YOUR_SESSION_ID" https://auth.lizhao.net/session
# 200 -> same shape, potentially with more internal metadata (if extended later)
```

If either endpoint returns **401**, the browser code immediately redirects to `https://auth.lizhao.net/oauth/start?return=<current-url>` (the app never renders an unauthenticated view).

### 6. Refresh Session (Sliding Expiry)

```sh
curl -i -X POST --cookie "lz_sess=YOUR_SESSION_ID" https://auth.lizhao.net/session/refresh
# Response: 200 OK, session expiry extended
```

### 7. Logout

```sh
curl -i -X POST --cookie "lz_sess=YOUR_SESSION_ID" https://auth.lizhao.net/logout
# Response: 204 No Content, session invalidated, cookie cleared
```

### Notes
- For browserless automation, a headless browser or OAuth device flow is required (not shown here).
- Always use `--cookie` to send the session cookie for authenticated endpoints.
- Replace `YOUR_SESSION_ID` with the actual value from your browser after login.

## Summary

Centralize Google OAuth at `auth.lizhao.net`, issue a top-domain secure HttpOnly cookie (`lz_sess`), and let each subdomain verify and consume the session. Use opaque session IDs for revocation control, enrich with role metadata, and apply defense-in-depth (domain allow‑list, CSRF mitigation, session rotation). This design delivers seamless SSO across all `*.lizhao.net` apps with a clear path for future enhancements (MFA, policy engine, audit).

