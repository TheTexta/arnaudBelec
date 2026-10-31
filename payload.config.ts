import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildConfig, type CollectionConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { isCmsUser, supabaseStrategy } from "./lib/cms/auth";
import { cmsEnabled } from "./lib/cms/session";
import { LegacyRevisions, Posts } from "./lib/cms/posts";

const root = path.dirname(fileURLToPath(import.meta.url));
const enabled = cmsEnabled();
if (enabled && (!process.env.ARNAUD_CMS_DATABASE_URL || !process.env.PAYLOAD_SECRET || !process.env.ARNAUD_CMS_ORIGIN)) throw new Error("Configure the isolated CMS database, PAYLOAD_SECRET and exact CMS origin before enabling Payload.");
if (enabled && process.env.PAYLOAD_SECRET!.length < 32) throw new Error("PAYLOAD_SECRET must contain at least 32 random characters.");
const Users: CollectionConfig = {
  slug: "cms-users",
  auth: { disableLocalStrategy: true, useAPIKey: false, removeTokenFromResponses: true, strategies: [supabaseStrategy] },
  admin: { hidden: true, useAsTitle: "email" },
  access: {
    admin: ({ req }) => isCmsUser(req.user),
    read: ({ req }) => isCmsUser(req.user) ? { id: { equals: req.user!.id } } : false,
    create: () => false, update: () => false, delete: () => false,
  },
  fields: [{ name: "email", type: "email", required: true }],
};

export default buildConfig({
  telemetry: false,
  secret: process.env.PAYLOAD_SECRET || "disabled-cms-not-an-authentication-secret",
  routes: { admin: "/cms", api: "/api/cms" },
  serverURL: process.env.ARNAUD_CMS_ORIGIN || "",
  csrf: process.env.ARNAUD_CMS_ORIGIN ? [process.env.ARNAUD_CMS_ORIGIN] : [],
  graphQL: { disable: true },
  admin: {
    avatar: "default",
    theme: "dark",
    user: "cms-users",
    meta: { titleSuffix: "— Arnaud Belec", robots: "noindex, nofollow" },
    importMap: { baseDir: root, importMapFile: path.resolve(root, "app/(payload)/cms/importMap.ts") },
    components: {
      afterNavLinks: ["/components/cms/Navigation#Navigation"],
      logout: { Button: "/components/cms/SessionViews#LogoutButton" },
      views: {
        login: { Component: "/components/cms/SessionViews#Login", path: "/login", exact: true },
        logout: { Component: "/components/cms/SessionViews#Logout", path: "/logout", exact: true },
        inactivity: { Component: "/components/cms/SessionViews#Logout", path: "/logout-inactivity", exact: true },
        photographs: { Component: "/components/cms/PhotographsView#PhotographsView", path: "/photographs", exact: true },
        preview: { Component: "/components/cms/PhotographsView#PreviewView", path: "/preview", exact: true },
      },
    },
  },
  collections: [Users, Posts, LegacyRevisions],
  db: postgresAdapter({
    pool: { connectionString: process.env.ARNAUD_CMS_DATABASE_URL || "postgresql://localhost:55439/postgres", max: 3, connectionTimeoutMillis: 5000 },
    schemaName: "arnaud_cms", idType: "uuid", allowIDOnCreate: true,
    push: false, disableCreateDatabase: true, migrationDir: path.resolve(root, "migrations"),
  }),
  typescript: { autoGenerate: false, outputFile: path.resolve(root, "payload-types.ts") },
});
