import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import { SocketProvider } from "@/lib/socket-context";
import { CallProvider } from "@/lib/call-context";
import { ThemeInitializer } from "@/components/theme-initializer";
import { GlobalIncomingCall } from "@/components/calling";
import { Chatbot } from "@/components/Chatbot";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Nexora — IT Operations Platform",
  description: "The complete IT operations platform. One platform. Every workflow. Every role. Every team.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={cn("antialiased", inter.variable)} style={{ fontFamily: "var(--font-sans, 'Inter', sans-serif)" }}>
        <AuthProvider>
          <ThemeInitializer />
          <SocketProvider>
            <CallProvider>
              <GlobalIncomingCall />
              {children}
              <Chatbot />
            </CallProvider>
          </SocketProvider>
        </AuthProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
