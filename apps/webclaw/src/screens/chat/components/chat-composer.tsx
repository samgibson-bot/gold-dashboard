import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowUp02Icon } from '@hugeicons/core-free-icons'
import type { Ref } from 'react'

import type { AttachmentFile } from '@/components/attachment-button'
import type { SlashCommand } from '@/components/slash-command-menu'
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from '@/components/prompt-kit/prompt-input'
import { Button } from '@/components/ui/button'
import { AttachmentButton } from '@/components/attachment-button'
import { AttachmentPreviewList } from '@/components/attachment-preview'
import {
  SLASH_COMMANDS,
  SlashCommandMenu,
} from '@/components/slash-command-menu'

type ChatComposerProps = {
  onSubmit: (value: string, helpers: ChatComposerHelpers) => void
  isLoading: boolean
  disabled: boolean
  wrapperRef?: Ref<HTMLDivElement>
}

type ChatComposerHelpers = {
  reset: () => void
  setValue: (value: string) => void
  attachments?: Array<AttachmentFile>
}

function ChatComposerComponent({
  onSubmit,
  isLoading,
  disabled,
  wrapperRef,
}: ChatComposerProps) {
  const [value, setValue] = useState('')
  const [attachments, setAttachments] = useState<Array<AttachmentFile>>([])
  const promptRef = useRef<HTMLTextAreaElement | null>(null)

  // Slash command state
  const [slashMenuDismissed, setSlashMenuDismissed] = useState(false)
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0)

  const slashQuery = /^\/(\S*)$/.test(value)
    ? value.slice(1).toLowerCase()
    : null
  const filteredCommands =
    slashQuery !== null
      ? SLASH_COMMANDS.filter((c) =>
          c.command.slice(1).toLowerCase().startsWith(slashQuery),
        )
      : []
  const showSlashMenu =
    slashQuery !== null && filteredCommands.length > 0 && !slashMenuDismissed

  // Reset slash menu on every value change
  useEffect(() => {
    setSlashMenuDismissed(false)
    setSelectedCommandIndex(0)
  }, [value])

  const focusPrompt = useCallback(() => {
    if (typeof window === 'undefined') return
    window.requestAnimationFrame(() => {
      promptRef.current?.focus()
    })
  }, [])

  const reset = useCallback(() => {
    setValue('')
    setAttachments([])
    focusPrompt()
  }, [focusPrompt])

  const handleFileSelect = useCallback((file: AttachmentFile) => {
    setAttachments((prev) => [...prev, file])
  }, [])

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const setComposerValue = useCallback(
    (nextValue: string) => {
      setValue(nextValue)
      focusPrompt()
    },
    [focusPrompt],
  )

  const handleSubmit = useCallback(() => {
    if (disabled) return
    const body = value.trim()
    const validAttachments = attachments.filter((a) => !a.error && a.base64)
    if (body.length === 0 && validAttachments.length === 0) return
    onSubmit(body, {
      reset,
      setValue: setComposerValue,
      attachments: validAttachments,
    })
    focusPrompt()
  }, [
    disabled,
    focusPrompt,
    onSubmit,
    reset,
    setComposerValue,
    value,
    attachments,
  ])

  const handleSelectCommand = useCallback(
    (cmd: SlashCommand) => {
      setValue(cmd.command + ' ')
      setSlashMenuDismissed(true)
      focusPrompt()
    },
    [focusPrompt],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!showSlashMenu) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedCommandIndex((i) => (i + 1) % filteredCommands.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedCommandIndex(
          (i) => (i - 1 + filteredCommands.length) % filteredCommands.length,
        )
      } else if (e.key === 'Tab') {
        e.preventDefault()
        const cmd = filteredCommands[selectedCommandIndex]
        if (cmd) handleSelectCommand(cmd)
      } else if (e.key === 'Escape') {
        setSlashMenuDismissed(true)
      } else if (e.key === 'Enter' && !e.shiftKey) {
        const cmd = filteredCommands[selectedCommandIndex]
        if (cmd) {
          e.preventDefault()
          e.stopPropagation()
          handleSelectCommand(cmd)
        }
      }
    },
    [
      showSlashMenu,
      filteredCommands,
      selectedCommandIndex,
      handleSelectCommand,
    ],
  )

  const validAttachments = attachments.filter((a) => !a.error && a.base64)
  const submitDisabled =
    disabled || (value.trim().length === 0 && validAttachments.length === 0)

  return (
    <div
      className="mx-auto w-full max-w-full px-5 sm:max-w-[768px] sm:min-w-[400px] relative pb-3"
      ref={wrapperRef}
    >
      {showSlashMenu ? (
        <SlashCommandMenu
          commands={filteredCommands}
          selectedIndex={selectedCommandIndex}
          onSelect={handleSelectCommand}
        />
      ) : null}
      <PromptInput
        value={value}
        onValueChange={setValue}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        disabled={disabled}
      >
        <AttachmentPreviewList
          attachments={attachments}
          onRemove={handleRemoveAttachment}
        />
        <PromptInputTextarea
          placeholder="Type a message…"
          inputRef={promptRef}
          onKeyDown={handleKeyDown}
        />
        <PromptInputActions className="justify-end px-3">
          <div className="flex items-center gap-1">
            <PromptInputAction tooltip="Attach file">
              <AttachmentButton
                onFileSelect={handleFileSelect}
                disabled={disabled}
              />
            </PromptInputAction>
            <PromptInputAction tooltip="Send message">
              <Button
                onClick={handleSubmit}
                disabled={submitDisabled}
                size="icon-sm"
                className="rounded-full"
                aria-label="Send message"
              >
                <HugeiconsIcon icon={ArrowUp02Icon} size={18} strokeWidth={2} />
              </Button>
            </PromptInputAction>
          </div>
        </PromptInputActions>
      </PromptInput>
    </div>
  )
}

const MemoizedChatComposer = memo(ChatComposerComponent)

export { MemoizedChatComposer as ChatComposer }
export type { ChatComposerHelpers }
