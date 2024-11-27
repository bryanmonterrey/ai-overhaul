// app/layout.tsx
import React from "react";
import type { Metadata } from "next";
import localFont from "next/font/local";
import Header from "./components/layout/Header";
import Sidebar from "./components/layout/Sidebar";
import Footer from "./components/layout/Footer";
import { ClientProviders } from './providers/ClientProviders';

// Import global styles
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "GOATSESINGULARITY.AI",
  description: "Advanced AI Personality System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white relative`}
      >
        <ClientProviders>
          <div className="flex flex-col min-h-screen">
            <Header />
            <div className="flex flex-1 pt-16 pb-12">
              <Sidebar />
              <main className="flex-1 ml-64 p-6">
                {children}
              </main>
            </div>
            <Footer />
          </div>
        </ClientProviders>
      </body>
    </html>
  );
}