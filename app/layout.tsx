import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@/components/game/tabletop.css";
import "@/components/game/desktop-table.css";
import "@/components/game/desktop-layout.css";

export const viewport: Viewport = {width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#0d1216'};

export const metadata: Metadata = {
  title: "КОНТУР — кибердуэль",
  description: "Развивай компанию, защищай доход и атакуй скрытую сеть соперника. Карточная кибердуэль с ботом и PvP.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
