import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { TRPCReactProvider } from "@/trpc/client";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://przekod.pl"),
  title: {
    default: "Vibe — Build apps by chatting with AI",
    template: "%s · Vibe",
  },
  description:
    "Create apps and websites by chatting with AI. Describe what you want and Vibe builds a live, working app for you in seconds.",
  applicationName: "Vibe",
  icons: { icon: "/logo.svg" },
  openGraph: {
    title: "Vibe — Build apps by chatting with AI",
    description: "Create apps and websites by chatting with AI.",
    url: "/",
    siteName: "Vibe",
    type: "website",
    images: ["/logo.svg"],
  },
  twitter: {
    card: "summary",
    title: "Vibe — Build apps by chatting with AI",
    description: "Create apps and websites by chatting with AI.",
    images: ["/logo.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#C96342",
        },
      }}
    >
      <TRPCReactProvider>
        <html lang="en" suppressHydrationWarning>
          <body
            className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            suppressHydrationWarning
          >
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <Toaster />
              {children}
            </ThemeProvider>
          </body>
        </html>
      </TRPCReactProvider>
    </ClerkProvider>
  );
};
