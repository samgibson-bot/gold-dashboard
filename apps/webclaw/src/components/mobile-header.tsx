'use client'

import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Menu01Icon, PencilEdit02Icon } from '@hugeicons/core-free-icons'
import { WebClawIconBig } from '@/components/icons/webclaw-big'
import { openMobileNav } from '@/hooks/use-mobile-nav'
import { cn } from '@/lib/utils'

export function MobileHeader({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        'h-12 px-3 flex items-center justify-between border-b border-primary-200 bg-primary-50 shrink-0',
        className,
      )}
    >
      <button
        onClick={openMobileNav}
        className="flex items-center justify-center w-8 h-8 rounded-md text-primary-700 hover:bg-primary-100 transition-colors"
        aria-label="Open navigation"
      >
        <HugeiconsIcon icon={Menu01Icon} size={20} strokeWidth={1.6} />
      </button>

      <Link
        to="/new"
        className="text-sm font-semibold text-primary-900 hover:text-primary-700 flex items-center gap-2 transition-colors"
      >
        <WebClawIconBig className="size-5 rounded-sm" />
        Gold Dashboard
      </Link>

      <Link
        to="/new"
        className="flex items-center justify-center w-8 h-8 rounded-md text-primary-700 hover:bg-primary-100 transition-colors"
        aria-label="New chat"
      >
        <HugeiconsIcon icon={PencilEdit02Icon} size={18} strokeWidth={1.6} />
      </Link>
    </header>
  )
}
