export const systemThemeQuery = "(prefers-color-scheme: dark)";

export function adminThemePreference(cookie: string): "auto" | "light" | "dark" {
  const preference = cookie.split(";").map(value => value.trim()).find(value => value.startsWith("payload-theme="))?.split("=")[1];
  return preference === "light" || preference === "dark" ? preference : "auto";
}
