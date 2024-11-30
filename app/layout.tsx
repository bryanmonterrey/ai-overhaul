'use client';

import React, { useState, useEffect } from "react";
import Header from "./components/layout/Header";
import Sidebar from "./components/layout/Sidebar";
import Footer from "./components/layout/Footer";
import { ClientProviders } from './providers/ClientProviders';

// Import global styles
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);

  useEffect(() => {
    const checkWidth = () => {
      setIsSidebarVisible(window.innerWidth >= 800);
    };
    
    // Initial check
    checkWidth();
    
    // Add event listener for resize
    window.addEventListener('resize', checkWidth);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body
        className={`antialiased bg-[#11111A] text-white relative`}
      >
        <ClientProviders>
          <div className="flex flex-col min-h-screen">
            <Header />
            <div className="flex flex-1 pt-16 pb-12">
              <Sidebar />
              <main className={`flex-1 p-6 transition-all duration-300 ${
                isSidebarVisible ? 'ml-64' : 'ml-0'
              }`}>
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