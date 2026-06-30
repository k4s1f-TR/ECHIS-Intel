import type { Metadata } from "next";
import { Space_Grotesk, Hanken_Grotesk, JetBrains_Mono, Newsreader, Spectral } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ui",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

// Editorial serif for the Policy / Dossier reading surface (titles, lead, body).
// Newsreader keeps the serif-for-reading / mono-for-metadata pairing from the
// design handoff; the rest of the app continues to use the sans/mono families.
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

// Display serif used by the Contact screen headings, matching its design
// handoff (Spectral, normal + italic). Exposed as --font-spectral.
const spectral = Spectral({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-spectral",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ECHIS",
  description: "Open-source intelligence situation awareness dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`h-full ${spaceGrotesk.variable} ${hankenGrotesk.variable} ${jetBrainsMono.variable} ${newsreader.variable} ${spectral.variable}`}
    >
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
