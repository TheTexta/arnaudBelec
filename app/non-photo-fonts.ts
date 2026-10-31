import { Jost, Nunito_Sans } from "next/font/google";

const display = Jost({ subsets: ["latin"], display: "swap", variable: "--font-non-photo-display" });
const text = Nunito_Sans({ subsets: ["latin"], display: "swap", variable: "--font-non-photo-text" });

export const nonPhotoFonts = `${display.variable} ${text.variable}`;
