import { Suspense } from "react";

import DoubanPageClient from "./douban-page-client";

export const dynamic = "force-dynamic";

export default function DoubanPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">加载中...</div>}>
      <DoubanPageClient />
    </Suspense>
  );
}
