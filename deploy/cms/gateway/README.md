# Arnaud's PostgreSQL gateway

Production is one Coolify service, `arnaud-cms-postgres-gateway`
(`ehzkm8hiqxagidg4ztqbljwx`), on the existing server. It serves only
`arnaud_cms_runtime` at `arnaud-cms-db.dextery.dev:443/arnaud_cms`, mapping that
alias to existing Supabase database `postgres` and schema `arnaud_cms`.

## Transport and bounds

- DNS-only CNAME `arnaud-cms-db.dextery.dev` → `api.dextery.dev`, following origin
  DNS rather than duplicating its dynamic address. Ordinary Cloudflare HTTP
  proxying is not suitable for PostgreSQL here.
- Existing Traefik `https` entrypoint handles PostgreSQL STARTTLS, exact HostSNI
  routing and Let's Encrypt certificate renewal. No shared proxy restart/new
  listener, router forwarding or PostgreSQL host-port mapping was needed.
- Node-pg requires `sslmode=verify-full`. The two private Docker hops after
  Traefik are plaintext, not end-to-end database TLS. The container joins the
  existing Supabase network plus its Coolify resource network, without host ports.
- One non-root, read-only instance; six ordinary backend sessions, no reserve,
  and 120 PgBouncer clients. Cancellation may use additional short-lived transport
  sockets. Traefik's middleware is per-source, not the global client bound.
- Transaction pooling tracks protocol-level prepared statements. Do not use SQL
  PREPARE/EXECUTE, LISTEN, session locks or role changes through this endpoint.
  Migration access remains on the private Tailscale maintenance path.
- Healthcheck is process/config liveness only. Real external TLS/auth/query probes
  establish readiness. Runtime role timeouts affect only this site; PgBouncer
  separately enforces its own limits. Shared database settings were not changed.

## Build and configuration

`Dockerfile` builds upstream PgBouncer 1.26.1 from its verified archive and a pinned
official Alpine base. APK versions resolve at build time; deployed image digest
is pinned in `compose.yaml`. Verified binary: PgBouncer 1.26.1, libevent 2.1.13,
OpenSSL 3.5.9. The image is local to this server, not a public registry artifact.
For recovery/upgrade, rebuild, verify, record a new digest and update Coolify
explicitly. Avoid overlapping replicas during replacement: two pools defeat the
aggregate six-backend budget.

Canonical Compose/config source is here. Coolify's rendered Compose retained
the TCP router, image pin, security settings and absence of host database ports.
Host config is `/home/dextery/.local/share/arnaud-cms-gateway/`, UID 1000,
directory 0700/files 0600, mounted read-only. `users.txt` is deliberately absent
from Git/image: exactly one runtime SCRAM verifier, identical to PostgreSQL's.
The corresponding password is a production-only sensitive Vercel server variable,
never `NEXT_PUBLIC_*`. Migrator credentials are absent from PgBouncer and Vercel.
No existing shared credential changed.

`runtime.hba` rejects other users/databases and the PgBouncer console. No forced
backend user or privileged `auth_query` exists. Preserve identical verifier salt/
iterations during rotation; independent verifiers for the same password do not
work for pass-through SCRAM. Coordinate PostgreSQL, private auth file, Vercel and
dedicated-pooler changes explicitly.

## Verification and maintenance

**Scoped client-capacity correction (2026-11-06):** staging a new Fashion release
alongside the existing live deployments exposed `max_client_conn` failures at the
old 30-client bound. With explicit owner approval, only the four PgBouncer
client-admission limits were raised to 120; PostgreSQL pooling remains capped at
six, with no reserve. The per-source Traefik bound remains 30, memory remains
128 MiB and the existing 1024-descriptor soft limit has headroom. Apply the
canonical config through the existing read-only bind mount, retaining an exact
backup and reloading the one PgBouncer process with SIGHUP rather than restarting
shared services. Authentication files, HBA, TLS, routing, grants and ports must
remain byte-for-byte unchanged. The correction was applied with the exact-hash
guarded backup/atomic replacement and SIGHUP, without a restart or authentication
file change. Thirty-six concurrent **unauthenticated SCRAM challenges** and
forbidden-user/database denials passed, as did three config-boundary tests; this
is not an authenticated-query load test. Post-promotion checks found the gateway
healthy, two runtime backends within the six-session cap, and 1.023 MiB used of
128 MiB. See [`../../../docs/circle-of-fashion.md`](../../../docs/circle-of-fashion.md)
for the bounded runtime-log and browser acceptance record; this correction is
independent of the application deployment.

Export the runtime URL explicitly, then run `node scripts/cms/verify-gateway.mjs`.
It checks verified TLS/SCRAM and backend identity, effective cross-site/DDL/
privileged-function denial, wrong password/user/database/console denial,
plaintext/wrong-hostname/untrusted-CA/missing-SNI/wrong-SNI rejection, concurrent
named prepared queries and backend budget. Expected-denied DDL is rolled back.

The 2026-11-02 run passed all 13 groups, including 24 prepared queries using three
runtime backend sessions. Native Payload rehearsal separately passed restricted
login/migrations/import, conflict rollback and fixture-only publish/unpublish.
Production import/readback passed through this public verified gateway. See
`docs/payload-cutover.md` for counts and acceptance limitations.

Run the shared-infrastructure pg-net and pgsodium `audit.sql` files after identity
provisioning and before/after extension maintenance. The separately approved
pgsodium repair removed PUBLIC EXECUTE from eight privileged functions while
preserving all 29 old roles; it did not invoke key/crypto functions or redesign
their existing-project authorization. Upgrades can reintroduce defaults: block
gateway reconnection and review/audit before restoring access. A hidden CMS page
does not invalidate a database credential or pooled session.

On 2026-11-03 the owner-approved native journal reset/cutover rotated only the
runtime password, installed the exact same new PostgreSQL SCRAM verifier in the
dedicated gateway's private `users.txt`, and restarted only this gateway application.
The endpoint, username, image, transport, budgets and other sites were unchanged.
The new credential passed verified TLS/identity checks; the old one was rejected.
Historical local runtime credentials are invalid. Legacy journal DML/RPC grants
remain revoked; native-only activation is in `../activate-native-runtime.sql`.

After that irreversible reset, an old application deployment is not a journal
data rollback and can be schema-incompatible. Follow the reviewed forward-repair
or recovery plan in `../../../docs/native-payload-journal.md`; disabling CMS leaves
photography administration available, not the retired journal writer. Do not restart
shared Supabase, open 5432/6432, remove volumes or weaken TLS as a shortcut.
