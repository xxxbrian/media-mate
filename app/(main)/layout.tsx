// app/(main)/layout.tsx

import type { ReactNode } from "react";
import MobileHeader from "@/components/mobile-header";
import MobileBottomNav from "@/components/mobile-bottom-nav";
import TopNav from "@/components/top-nav";

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div className='w-full min-h-screen'>
      <MobileHeader />
      <TopNav />
      <main className="mt-14">{children}</main>
      <div className='md:hidden'>
        <MobileBottomNav />
      </div>
    </div>
  );
}
