import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GerenteMarketing",
  description: "Marketing Intelligence & Growth OS",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
