import type { ReactNode } from "react"

import { Separator } from "@/components/ui/separator"

type SectionHeaderProps = {
  title: string
  description?: ReactNode
  action?: ReactNode
}

export function SectionHeader({ title, description, action }: SectionHeaderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <Separator />
    </div>
  )
}
