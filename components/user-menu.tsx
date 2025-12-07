"use client";

import { LogOut, PanelLeft, User2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getAuthInfoFromBrowserCookie } from "@/lib/auth";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

type Role = "owner" | "admin" | "user" | undefined;

export function UserMenu() {
  const router = useRouter();
  const [role, setRole] = useState<Role>(undefined);
  const [username, setUsername] = useState<string | undefined>(undefined);

  useEffect(() => {
    const info = getAuthInfoFromBrowserCookie();
    setRole(info?.role);
    setUsername(info?.username);
  }, []);

  const isAdmin = useMemo(
    () => role === "owner" || role === "admin",
    [role]
  );

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {
      // ignore network errors on logout
    } finally {
      router.replace("/login");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="用户菜单">
          <User2 className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {username ? `已登录：${username}` : "未获取到用户信息"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {isAdmin && (
            <DropdownMenuItem onSelect={() => router.push("/admin/users")}>
              <PanelLeft className="mr-2 h-4 w-4" />
              <span>管理面板</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>退出登录</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
