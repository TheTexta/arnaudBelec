import { createServer } from "node:http";

// Deliberately separate from the application: a loopback-only synthetic auth
// provider for browser acceptance. Never run/configure this in a deployment.
const id = "32345678-1234-4234-8234-123456789abc";
const user = { id, email: "fixture@example.test", aud: "authenticated", role: "authenticated", created_at: new Date().toISOString() };
const token = () => `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.local-fixture-only`;
createServer(async (request, response) => {
  const url = request.url ?? "";
  response.setHeader("Content-Type", "application/json");
  if (url.startsWith("/auth/v1/token")) {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const input = JSON.parse(Buffer.concat(chunks).toString());
    if (!(input.email === user.email && input.password === "local-fixture-only") && input.refresh_token !== "local-refresh-only") { response.writeHead(401); response.end('{}'); return; }
    response.end(JSON.stringify({ access_token: token(), refresh_token: "local-refresh-only", expires_in: 3600, token_type: "bearer", user }));
  } else if (url === "/auth/v1/user") response.end(JSON.stringify(user));
  else if (url.startsWith("/auth/v1/logout")) { response.writeHead(204); response.end(); }
  else { response.writeHead(404); response.end('{}'); }
}).listen(55440, "127.0.0.1", () => console.log("Synthetic local auth fixture: 127.0.0.1:55440. Not production authentication."));
