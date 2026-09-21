import Link from "next/link";

import { ApiHealth } from "@/components/api-health";

export default function HomePage() {
  return (
    <main>
      <h1>E-commerce</h1>
      <ApiHealth />
      <nav aria-label="Sections">
        <ul>
          <li>
            <Link href="/products">Products</Link>
          </li>
        </ul>
      </nav>
    </main>
  );
}
