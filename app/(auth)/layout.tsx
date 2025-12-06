// app/(main)/layout.tsx

import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className='w-full min-h-screen relative'>
      <div className="absolute top-2 right-2">
        <ThemeToggle />
      </div>
      <main>{children}</main>
    </div>
  );
}
