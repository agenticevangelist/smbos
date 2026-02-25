import type { Metadata } from "next";
import "./globals.scss";

export const metadata: Metadata = {
  title: "SMBOS - Smart Digital Action Interface",
  description: "Dynamic skill-based task execution and automation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
