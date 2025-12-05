// app/(main)/layout.tsx

import type { ReactNode } from "react";
import MobileHeader from "@/components/mobile-header";
import MobileBottomNav from "@/components/mobile-bottom-nav";

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div className='w-full min-h-screen'>
      <MobileHeader />
      <main className="pt-14">{children}</main>
      <div className='md:hidden'>
        <MobileBottomNav />
      </div>
    </div>
  );
}
