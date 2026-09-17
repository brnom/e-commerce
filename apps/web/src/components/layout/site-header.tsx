import Link from "next/link";

import { ApiHealth } from "@/components/api-health";

const links = [{ href: "/products", label: "Products" }];

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link href="/" className="display-heading text-lg tracking-[0.2em]">
          E-commerce
        </Link>
        <nav aria-label="Main" className="flex items-center gap-6">
          <ul className="flex items-center gap-6">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm font-medium tracking-wider uppercase underline-offset-4 hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <ApiHealth className="hidden text-muted-foreground sm:inline-flex" />
        </nav>
      </div>
    </header>
  );
}
