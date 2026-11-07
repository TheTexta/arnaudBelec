// Keep disabled builds and public empty-state requests from initializing a pool.
export async function getCms() {
  const [{ getPayload }, { default: config }] = await Promise.all([
    import("payload"), import("../../payload.config"),
  ]);
  return getPayload({ config });
}
