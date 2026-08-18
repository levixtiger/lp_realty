import type { Metadata } from "next";
import { headers } from "next/headers";
import { ClerkProvider } from "@clerk/nextjs";
import "@fontsource-variable/inter";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    title: "Listings · Lin Pan Realty",
    description: "Lin Pan Realty Group internal listing management panel.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "Lin Pan Realty Group · Listing Management",
      description: "Internal workspace for managing property inventory and sales attribution.",
      images: [{ url: `${origin}/og.png`, width: 1740, height: 909, alt: "Lin Pan Realty Group listing management" }],
    },
    twitter: { card: "summary_large_image", images: [`${origin}/og.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const content = (
    <html lang="en">
      <body>{children}</body>
    </html>
  );

  return process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
    <ClerkProvider>{content}</ClerkProvider>
  ) : content;
}
