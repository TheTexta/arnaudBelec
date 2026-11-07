import localFont from "next/font/local";

export const siteFont = localFont({
  src: "./fonts/cezanne-pro.ttf",
  variable: "--font-site",
  weight: "400",
  style: "normal",
  display: "swap",
  fallback: ["cursive"],
  adjustFontFallback: false,
});

export const siteFontClasses = `${siteFont.variable} ${siteFont.className}`;
