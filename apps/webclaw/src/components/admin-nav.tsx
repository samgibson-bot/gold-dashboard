'use client'

import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMemo, useState } from 'react'
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  Search01Icon,
} from '@hugeicons/core-free-icons'
import { WebClawIconBig } from '@/components/icons/webclaw-big'
import { cn } from '@/lib/utils'
import { navSections } from '@/components/nav-sections'

export function AdminNav({ className }: { className?: string }) {
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const filteredSections = useMemo(() => {
    if (!search.trim()) return navSections

    const query = search.toLowerCase()
    return navSections
      .map(function filterSection(section) {
        const items = section.items.filter(function matchItem(item) {
          return item.label.toLowerCase().includes(query)
        })
        return { ...section, items }
      })
      .filter(function hasItems(section) {
        return section.items.length > 0
      })
  }, [search])

  function toggleSection(title: string) {
    setCollapsed(function updateCollapsed(prev) {
      return { ...prev, [title]: !prev[title] }
    })
  }

  return (
    <nav
      className={cn(
        'w-52 border-r border-primary-200 bg-primary-50 flex flex-col h-full',
        className,
      )}
    >
      {/* Header */}
      <div className="px-3 h-12 flex items-center justify-between border-b border-primary-200">
        <Link
          to="/new"
          className="text-sm text-primary-900 hover:text-primary-700 flex items-center gap-2 transition-colors"
        >
          <WebClawIconBig className="size-5 rounded-sm" />
          <span className="font-semibold">WebClaw</span>
        </Link>
      </div>

      {/* Search */}
      <div className="px-2 py-2 border-b border-primary-200">
        <div className="relative">
          <HugeiconsIcon
            icon={Search01Icon}
            size={14}
            strokeWidth={1.5}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-primary-400"
          />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={function handleSearch(e) {
              setSearch(e.target.value)
            }}
            className="w-full pl-7 pr-2 py-1.5 text-xs bg-white border border-primary-200 rounded-md outline-none focus:border-primary-400 transition-colors"
          />
        </div>
      </div>

      {/* Nav Sections */}
      <div className="flex-1 overflow-y-auto py-2">
        {filteredSections.map(function renderSection(section) {
          const isCollapsed = collapsed[section.title]
          return (
            <div key={section.title} className="mb-1">
              <button
                onClick={function handleToggle() {
                  toggleSection(section.title)
                }}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-primary-500 hover:text-primary-700 transition-colors"
              >
                <HugeiconsIcon
                  icon={isCollapsed ? ArrowRight01Icon : ArrowDown01Icon}
                  size={12}
                  strokeWidth={2}
                />
                {section.title}
              </button>
              {!isCollapsed && (
                <div className="space-y-0.5 px-2">
                  {section.items.map(function renderItem(item) {
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-primary-700 hover:bg-primary-100 transition-colors [&.active]:bg-primary-200 [&.active]:text-primary-950 [&.active]:font-medium"
                        activeProps={{ className: 'active' }}
                      >
                        <HugeiconsIcon
                          icon={item.icon}
                          size={18}
                          strokeWidth={1.5}
                        />
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-primary-200 text-xs text-primary-400">
        Gold Dashboard
      </div>
    </nav>
  )
}
