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
            <Header />
            <div className="flex">
              <Navigation />
              <main className="flex-1 pb-16 md:pb-0">
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
