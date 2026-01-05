import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { Header, Navigation, MobileNav } from "@/components/layout";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meal Planner",
  description: "Plan your weekly meals",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
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
