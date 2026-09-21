import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Article6 Signal — Website Intelligence",
  description: "See how clearly AI and search systems can understand your website.",
  metadataBase: new URL("https://signal.article6.org"),
  openGraph: {
    title: "Article6 Signal",
    description: "See how clearly AI and search systems can understand your website.",
    url: "https://signal.article6.org",
    siteName: "Article6 Signal",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#080a0f",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
