import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/contexts/AuthContext";
import BodyScrollLock from "@/components/BodyScrollLock";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tölvuleiga",
  description: "Find and rent quality properties with ease.",
  icons: {
    icon: [
      { url: "/img/logo.png", sizes: "16x16", type: "image/png" },
      { url: "/img/logo.png", sizes: "32x32", type: "image/png" },
      { url: "/img/logo.png", sizes: "180x180", type: "image/png" }
    ],
    apple: [{ url: "/img/logo.png" }],
    shortcut: ["/img/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <AuthProvider>
          <Header />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
          <BodyScrollLock />
        </AuthProvider>
      </body>
    </html>
  );
}
