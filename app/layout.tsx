import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TaipanMonitor",
  description: "Open-source intelligence situation awareness dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
