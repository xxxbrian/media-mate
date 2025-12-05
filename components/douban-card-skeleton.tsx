"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const DoubanCardSkeleton = () => {
  return (
    <Card className="w-full border-0 bg-transparent shadow-none">
      <CardContent className="p-0">
        <div className="group relative w-full flex flex-col">
          {/* 封面骨架 */}
          <Skeleton className="w-full aspect-[2/3] rounded-lg" />

          {/* 标题骨架 */}
          <div className="mt-3 flex flex-col items-center justify-center">
            <Skeleton className="h-4 w-24 sm:w-32" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DoubanCardSkeleton;
