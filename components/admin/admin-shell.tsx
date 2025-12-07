"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ReactNode, useState } from "react"
import {
  Cable,
  Code2,
  FileText,
  LayoutDashboard,
  ListChecks,
  Radio,
  Settings2,
  ShieldCheck,
  Users,
  Home,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Toaster } from "@/components/ui/sonner"

type AdminShellProps = {
  title?: string
  description?: string
  children: ReactNode
}

const navItems = [
  { href: "/admin/users", label: "用户", icon: Users },
  { href: "/admin/sources", label: "视频源", icon: Code2 },
  { href: "/admin/live", label: "直播源", icon: Radio },
  { href: "/admin/categories", label: "自定义分类", icon: ListChecks },
  { href: "/admin/site", label: "站点设置", icon: Settings2 },
  { href: "/admin/config-file", label: "配置文件", icon: FileText },
  { href: "/admin/tvbox", label: "TVBox", icon: Cable },
  { href: "/admin/reset", label: "重置", icon: ShieldCheck },
  { href: "/", label: "返回首页", icon: Home}
]

export function AdminShell({ title, description, children }: AdminShellProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const active = navItems.find((item) => pathname?.startsWith(item.href))
  const breadcrumbLabel = active?.label ?? "管理后台"

  const renderNav = () => (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname?.startsWith(item.href) && item.href !== "/"
        return (
          <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
            <span
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                "hover:bg-muted",
                isActive && "bg-muted text-primary"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 border-r bg-muted/30 px-4 py-6 md:block">
        <div className="mb-6 text-lg font-semibold">管理后台</div>
        {renderNav()}
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="px-4 pt-6 pb-4">
            <SheetTitle>管理后台</SheetTitle>
            <SheetDescription>选择一个模块</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">{renderNav()}</div>
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setOpen(true)}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span className="sr-only">打开导航</span>
          </Button>
          <div className="flex flex-1 items-center justify-between gap-4">
            <div className="space-y-1">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/admin">后台</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{breadcrumbLabel}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              {title && <h1 className="text-xl font-semibold leading-tight">{title}</h1>}
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6">
          <Card className="border-none shadow-none p-6">
            <div className="space-y-6">
              {children}
            </div>
          </Card>
        </main>
        <Separator />
      </div>
      <Toaster />
    </div>
  )
}
