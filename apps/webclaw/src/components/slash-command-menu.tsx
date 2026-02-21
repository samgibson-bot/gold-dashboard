import { HugeiconsIcon } from '@hugeicons/react'
import type { IconSvgObject } from '@hugeicons/core-free-icons'
import {
  AiBrain01Icon,
  ArrowShrink01Icon,
  ChessPawnIcon,
  PencilEdit02Icon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

export type SlashCommand = {
  command: string
  description: string
  icon: IconSvgObject
}

export const SLASH_COMMANDS: Array<SlashCommand> = [
  {
    command: '/roundtable',
    description: 'Start a Roundtable debate council',
    icon: UserGroupIcon,
  },
  {
    command: '/spawn',
    description: 'Spawn a sub-agent (e.g. /spawn architect)',
    icon: ChessPawnIcon,
  },
  {
    command: '/compact',
    description: 'Compact context window',
    icon: ArrowShrink01Icon,
  },
  {
    command: '/think',
    description: 'Enable extended thinking mode',
    icon: AiBrain01Icon,
  },
  {
    command: '/new',
    description: 'New session',
    icon: PencilEdit02Icon,
  },
]

type SlashCommandMenuProps = {
  commands: Array<SlashCommand>
  selectedIndex: number
  onSelect: (command: SlashCommand) => void
}

export function SlashCommandMenu({
  commands,
  selectedIndex,
  onSelect,
}: SlashCommandMenuProps) {
  if (commands.length === 0) return null

  return (
    <div className="absolute bottom-full mb-1 left-0 right-0 z-50 bg-surface border border-primary-200 rounded-lg shadow-lg overflow-hidden">
      {commands.map((cmd, index) => (
        <button
          key={cmd.command}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect(cmd)
          }}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
            index === selectedIndex
              ? 'bg-primary-100 text-primary-950'
              : 'hover:bg-primary-50 text-primary-800',
          )}
        >
          <HugeiconsIcon
            icon={cmd.icon}
            size={16}
            strokeWidth={1.5}
            className="shrink-0 text-primary-500"
          />
          <span className="text-sm font-medium tabular-nums">
            {cmd.command}
          </span>
          <span className="text-xs text-primary-400 truncate">
            {cmd.description}
          </span>
        </button>
      ))}
    </div>
  )
}
