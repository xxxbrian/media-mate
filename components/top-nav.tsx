"use client";

import React from "react";
import { Cat, Clover, Film, Home, Radio, Search, Tv } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

// import { useSite } from "./SiteProvider";
import { ThemeToggle } from "@/components/theme-toggle";
// import { UserMenu } from "./UserMenu";
import { CircleUserRound } from "lucide-react";

type NavLinkProps = {
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  active: boolean;
};

// 小的可复用 NavLink 组件：只负责样式 + 图标 + active 态
function NavLink({ href, icon: Icon, label, active }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex items-center gap-2 rounded-full px-2 py-1.5 text-xs sm:text-sm",
        "transition-colors",
        "text-muted-foreground hover:text-foreground hover:bg-accent/60",
        active ? "bg-accent text-accent-foreground shadow-sm" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Icon className="h-4 w-4" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export default function TopNavbar({ siteName }: { siteName: string }) {
  // const { siteName } = useSite();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fallbackSiteName = process.env.NEXT_PUBLIC_SITE_NAME || "MediaMate";
  const displayName = siteName || fallbackSiteName;

  const isActive = (href: string) => pathname === href;

  const isDoubanActive = (type: string) => {
    const currentType = searchParams.get("type");
    return pathname.startsWith("/douban") && currentType === type;
  };

  return (
    <header className="hidden md:block fixed top-0 inset-x-0 z-50">
      <div className="mx-auto max-w-7xl px-4">
        {/* 顶部栏整体卡片 */}
        <div className="mt-2 rounded-2xl border bg-card/90 backdrop-blur shadow-lg shadow-black/5">
          <nav className="flex h-14 items-center justify-between gap-2 px-3">
            {/* Left: 标题 / Logo */}
            <div className="flex min-w-0 items-center gap-2">
              <Link
                href="/"
                className="shrink-0 select-none hover:opacity-90 transition-opacity"
              >
                <span className="text-lg font-semibold tracking-tight text-foreground">
                  {displayName}
                </span>
              </Link>
            </div>

            {/* Center: 导航 */}
            <div className="flex flex-1 items-center justify-center gap-2 flex-wrap">
              <NavLink
                href="/"
                icon={Home}
                label="首页"
                active={isActive("/")}
              />
              <NavLink
                href="/search"
                icon={Search}
                label="搜索"
                active={isActive("/search")}
              />
              <NavLink
                href="/douban?type=movie"
                icon={Film}
                label="电影"
                active={isDoubanActive("movie")}
              />
              <NavLink
                href="/douban?type=tv"
                icon={Tv}
                label="剧集"
                active={isDoubanActive("tv")}
              />
              <NavLink
                href="/douban?type=anime"
                icon={Cat}
                label="动漫"
                active={isDoubanActive("anime")}
              />
              <NavLink
                href="/douban?type=show"
                icon={Clover}
                label="综艺"
                active={isDoubanActive("show")}
              />
              <NavLink
                href="/live"
                icon={Radio}
                label="直播"
                active={isActive("/live")}
              />
              {/* 将来 moresite 可以在这里加一个 NavLink 或 DropdownMenu */}
            </div>

            {/* Right: 主题切换 + 用户菜单 */}
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <CircleUserRound className="w-4 h-4" />
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
