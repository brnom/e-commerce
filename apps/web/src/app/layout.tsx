import "./globals.css";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { QueryProvider } from "@/components/query-provider";
import { fontClassNames } from "@/lib/fonts";

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "E-commerce",
  description: "Product catalog and storefront",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontClassNames}>
      <body className="flex min-h-screen flex-col">
        <QueryProvider>
          <SiteHeader />
          <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">{children}</div>
          <SiteFooter />
        </QueryProvider>
      </body>
    </html>
  );
}
