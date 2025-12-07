// app/(main)/layout.tsx

import type { ReactNode } from "react";
import { getConfig } from "@/lib/config";
import MobileHeader from "@/components/mobile-header";
import MobileBottomNav from "@/components/mobile-bottom-nav";
import TopNav from "@/components/top-nav";

export default async function MainLayout({ children }: { children: ReactNode }) {
  const config = await getConfig();
  const siteName = config.SiteConfig.SiteName || process.env.NEXT_PUBLIC_SITE_NAME || "MediaMate";

  return (
    <div className='w-full min-h-screen'>
      <MobileHeader siteName={siteName} />
      <TopNav siteName={siteName} />
      <main className="mt-14">{children}</main>
      <div className='md:hidden'>
        <MobileBottomNav />
      </div>
    </div>
  );
}
