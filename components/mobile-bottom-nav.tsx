/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { Cat, Clover, Film, Home, Radio, Star, Tv } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface MobileBottomNavProps {
  /**
   * 主动指定当前激活的路径。当未提供时，自动使用 usePathname() 获取的路径。
   */
  activePath?: string;
}

type NavItem = {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  href: string;
};

const baseItems: NavItem[] = [
  { icon: Home, label: "首页", href: "/" },
  { icon: Film, label: "电影", href: "/douban?type=movie" },
  { icon: Tv, label: "剧集", href: "/douban?type=tv" },
  { icon: Cat, label: "动漫", href: "/douban?type=anime" },
  { icon: Clover, label: "综艺", href: "/douban?type=show" },
  { icon: Radio, label: "直播", href: "/live" },
];

const customItem: NavItem = {
  icon: Star,
  label: "自定义",
  href: "/douban?type=custom",
};

const MobileBottomNav = ({ activePath }: MobileBottomNavProps) => {
  let pathname = usePathname();
  const searchParams = useSearchParams();
  if (pathname.startsWith("/douban")) {
    const type = searchParams.get("type");
    if (type) {
      pathname = `/douban?type=${type}`;
    }
  }
  const currentActive = activePath ?? pathname;

  // 只在客户端读取 runtime config
  let navItems = baseItems;
  if (typeof window !== "undefined") {
    const runtimeConfig = (window as any).RUNTIME_CONFIG;
    if (runtimeConfig?.CUSTOM_CATEGORIES?.length > 0) {
      navItems = [...baseItems, customItem];
    }
  }

  const isActive = (href: string) => {
    const typeMatch = href.match(/type=([^&]+)/)?.[1];

    const decodedActive = decodeURIComponent(currentActive);
    const decodedItemHref = decodeURIComponent(href);

    return (
      decodedActive === decodedItemHref ||
      (decodedActive.startsWith("/douban") &&
        typeMatch &&
        decodedActive.includes(`type=${typeMatch}`))
    );
  };

  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-50 pointer-events-none">
      <div className="pointer-events-auto mx-auto px-3 pb-[env(safe-area-inset-bottom)]">
        <div className="rounded-2xl border bg-card/90 backdrop-blur shadow-lg shadow-black/10 items-center">
          <ul className="flex  items-center justify-evenly overflow-x-auto scrollbar-hide py-1">
            {navItems.map((item) => {
              const active = isActive(item.href);

              return (
                <li key={item.href} className="flex-shrink-0">
                  <Link
                    href={item.href}
                    className={`group flex h-14 flex-col items-center justify-center gap-1 text-[11px]`}
                  >
                    {/* 图标圆形容器 */}
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full border text-[13px] transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-muted/60 text-muted-foreground border-transparent group-hover:bg-accent/70 group-hover:text-accent-foreground"
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                    </div>

                    {/* 文案 */}
                    <span
                      className={`transition-colors ${
                        active
                          ? "text-primary font-medium"
                          : "text-muted-foreground group-hover:text-foreground"
                      }`}
                    >
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default MobileBottomNav;
