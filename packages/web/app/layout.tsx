import type { Metadata, Viewport } from "next";
import { Fraunces, DM_Sans, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { Header, Navigation, MobileNav } from "@/components/layout";
import { OfflineIndicator } from "@/components/ui/offline-indicator";
import "./globals.css";

// Display font for headings and branding
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

// Body font for text and UI elements
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

// Mono font for times, quantities, and numbers
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Meal Planner",
  description: "Plan your weekly meals and manage grocery lists",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Meal Planner",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0ea5e9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${fraunces.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-background font-body antialiased">
        <QueryProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {/* Skip to main content link for keyboard navigation */}
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              Skip to main content
            </a>
            <OfflineIndicator />
            <Header />
            <div className="flex">
              <Navigation />
              <main id="main-content" className="flex-1 pb-16 md:pb-0" tabIndex={-1}>
                {children}
              </main>
            </div>
            <MobileNav />
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
