import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PES Veterans League",
  description: "Old school PES. Nové příběhy. Dream Team liga, turnaje a kariéry veteránů.",
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
    <html lang="cs">
      <body className="antialiased">{children}</body>
    </html>
  );
}
