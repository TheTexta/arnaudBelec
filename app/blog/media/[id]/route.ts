// Retired UUID media URLs must never fall back to signing legacy objects.
export function GET() { return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } }); }
