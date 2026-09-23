<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project

This repository contains Arnaud Belec's portfolio site.

The application uses:

* Next.js App Router
* React
* TypeScript
* Tailwind CSS v4
* Motion
* Supabase for photograph metadata and storage
* Vercel for frontend hosting

The Supabase backend is self-hosted through Coolify.

## Backend / Server Access

The backend server is reachable over Tailscale using the MagicDNS hostname:

`gmkserver.tail077753.ts.net`

SSH using:

```bash
ssh dextery@gmkserver.tail077753.ts.net
```

SSH may require authentication or approval from the human developer.

Only access the server when the task actually requires inspecting or modifying server-side infrastructure, Coolify, Supabase, storage, networking, or other backend services. Do not SSH into the server for ordinary frontend changes that can be completed from the repository.

Never store SSH credentials, API keys, service-role keys, access tokens, or other secrets in the repository.

Treat the server and its Supabase instance as production infrastructure. Do not perform destructive operations such as deleting production data, resetting databases, deleting storage buckets, recreating services, removing volumes, changing networking, or modifying unrelated Coolify services unless the human developer explicitly requests it.

Database schema changes should be represented by migrations in the repository rather than being made only through the live database whenever practical.

## Supabase

The project's Supabase instance and photograph-storage architecture are documented in `readme.md`.

Keep privileged Supabase credentials server-side. In particular, never expose `SUPABASE_SERVICE_ROLE_KEY` through a `NEXT_PUBLIC_*` environment variable or commit it to the repository.

When modifying photograph storage, database schemas, import tooling, or Supabase configuration, preserve compatibility with the existing `arnaudbelec` storage bucket and Arnaud-specific database tables unless the task explicitly requires changing them.

## Development

Use the existing project scripts where applicable:

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
```

Before considering a code change complete, run the relevant validation commands. For normal application changes, run at least:

```bash
npm run lint
npm run typecheck
```

Run `npm run build` when the change could affect production builds, routing, server/client boundaries, Next.js configuration, environment handling, or deployment behavior.

Fix issues introduced by your changes. Do not make unrelated refactors solely to clean up pre-existing warnings or errors unless requested.

## Documentation

Update `readme.md` in the same change whenever a feature or modification changes:

* application behavior that developers need to understand
* setup or development instructions
* environment variables
* storage or database architecture
* import/admin workflows
* deployment or infrastructure configuration

Do not add README changes for trivial internal implementation changes that do not affect how the project is understood, configured, operated, or used.

Keep documentation consistent with the actual implementation.
