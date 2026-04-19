import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Publify",
  description: "Publica, automatiza y crece con IA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <head>
        <meta charSet="UTF-8" />
      </head>
      <body className="min-h-full flex flex-col bg-brand-bg text-brand-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
