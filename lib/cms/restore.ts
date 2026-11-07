// 3.92.1 captures draftArg before collection hooks. Normalize before entering
// native REST handling so even the stock "Restore" action stays private.
export function privateRestoreRequest(request: Request, segments: string[] = []) {
  if (request.method !== "POST" || !["posts", "videos", "fashion-projects"].includes(segments[0]) || segments[1] !== "versions" || segments.length !== 3) return request;
  const url = new URL(request.url);
  url.searchParams.set("draft", "true");
  return new Request(url, request);
}
