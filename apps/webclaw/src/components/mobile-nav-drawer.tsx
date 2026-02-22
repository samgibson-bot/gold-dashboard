'use client'

import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { WebClawIconBig } from '@/components/icons/webclaw-big'
import { closeMobileNav, useMobileNav } from '@/hooks/use-mobile-nav'
import { navSections } from '@/components/nav-sections'

export function MobileNavDrawer() {
  const isOpen = useMobileNav((s) => s.isOpen)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  function toggleSection(title: string) {
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }))
  }

  function handleLinkClick() {
    closeMobileNav()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40"
            onClick={closeMobileNav}
          />

          {/* Drawer */}
          <motion.nav
            key="drawer"
            initial={{ x: -288 }}
            animate={{ x: 0 }}
            exit={{ x: -288 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed left-0 top-0 bottom-0 z-50 w-72 bg-primary-50 border-r border-primary-200 flex flex-col"
          >
            {/* Header */}
            <div className="px-3 h-12 flex items-center justify-between border-b border-primary-200 shrink-0">
              <Link
                to="/new"
                onClick={handleLinkClick}
                className="text-sm text-primary-900 hover:text-primary-700 flex items-center gap-2 transition-colors"
              >
                <WebClawIconBig className="size-5 rounded-sm" />
                <span className="font-semibold">WebClaw</span>
              </Link>
              <button
                onClick={closeMobileNav}
                className="flex items-center justify-center w-8 h-8 rounded-md text-primary-700 hover:bg-primary-100 transition-colors"
                aria-label="Close navigation"
              >
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  size={18}
                  strokeWidth={1.6}
                />
              </button>
            </div>

            {/* Nav Sections */}
            <div className="flex-1 overflow-y-auto py-2">
              {navSections.map(function renderSection(section) {
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
                              onClick={handleLinkClick}
                              className="flex items-center gap-2 px-2 py-2 rounded-md text-sm text-primary-700 hover:bg-primary-100 transition-colors [&.active]:bg-primary-200 [&.active]:text-primary-950 [&.active]:font-medium"
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
            <div className="px-3 py-3 border-t border-primary-200 text-xs text-primary-400 shrink-0">
              Gold Dashboard
            </div>
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  )
}
