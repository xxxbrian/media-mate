import { Search, CircleArrowLeft } from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "./theme-toggle";
import { Button } from "./ui/button";
import { UserMenu } from "./user-menu";

interface MobileHeaderProps {
  showBackButton?: boolean;
  siteName: string;
}

const MobileHeader = ({ showBackButton = false, siteName }: MobileHeaderProps) => {

  return (
    <header className="md:hidden fixed top-0 inset-x-0 z-50 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="h-14 flex items-center justify-between px-3">
        {/* 左侧：搜索 + 返回 */}
        <div className="flex items-center gap-1.5">
          <Button asChild variant="ghost" size="icon">
            <Link href="/search" aria-label="搜索">
              <Search className="h-4 w-4" />
            </Link>
          </Button>

          {showBackButton && <CircleArrowLeft className="h-4 w-4" />}
        </div>

        {/* 中间：站点名（绝对居中） */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 flex items-center -translate-x-1/2">
          <Link
            href="/"
            className="pointer-events-auto text-sm font-semibold tracking-tight text-foreground hover:opacity-90 transition-opacity"
          >
            {/* {siteName} */}
            {siteName}
          </Link>
        </div>

        {/* 右侧：主题切换 + 用户菜单 */}
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
};

export default MobileHeader;
