'use client'

import { useCallback, useRef } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Attachment01Icon } from '@hugeicons/core-free-icons'

import { Button } from '@/components/ui/button'
import { randomUUID } from '@/lib/utils'

/** Maximum file size before compression (10MB) */
const MAX_FILE_SIZE = 10 * 1024 * 1024

/** Maximum dimension (width or height) for resized images */
const MAX_IMAGE_DIMENSION = 1280

/** Initial JPEG compression quality (0-1) */
const IMAGE_QUALITY = 0.75

/**
 * Target compressed image size in bytes (~300KB).
 * WebSocket limit is 512KB, and base64 encoding adds ~33% overhead.
 */
const TARGET_IMAGE_SIZE = 300 * 1024

/** Supported image MIME types */
const ACCEPTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]

/** File extensions accepted by the file input */
const ACCEPTED_EXTENSIONS = '.png,.jpg,.jpeg,.gif,.webp'

/**
 * Represents an image attachment ready to be sent with a message.
 */
export type AttachmentFile = {
  /** Unique identifier for the attachment */
  id: string
  /** Original file reference */
  file: File
  /** Object URL for image preview */
  preview: string | null
  /** Attachment type (always 'image') */
  type: 'image'
  /** Base64-encoded image content (without data URL prefix) */
  base64: string | null
  /** Error message if processing failed */
  error?: string
}

type AttachmentButtonProps = {
  /** Callback when a file is selected */
  onFileSelect: (file: AttachmentFile) => void
  /** Whether the button is disabled */
  disabled?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * Checks if Canvas API is available in the current environment.
 */
function isCanvasSupported(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext && canvas.getContext('2d'))
  } catch {
    return false
  }
}

/**
 * Compresses and resizes an image using the Canvas API.
 */
async function compressImage(file: File): Promise<string> {
  if (!isCanvasSupported()) {
    throw new Error('Image compression not available in this browser')
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl)
    }

    img.onload = () => {
      try {
        let width = img.width
        let height = img.height

        if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_IMAGE_DIMENSION) / width)
            width = MAX_IMAGE_DIMENSION
          } else {
            width = Math.round((width * MAX_IMAGE_DIMENSION) / height)
            height = MAX_IMAGE_DIMENSION
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          cleanup()
          reject(new Error('Failed to get canvas context'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        const outputType =
          file.type === 'image/png' ? 'image/png' : 'image/jpeg'
        let quality = IMAGE_QUALITY

        let dataUrl = canvas.toDataURL(outputType, quality)

        if (outputType === 'image/jpeg') {
          const targetDataUrlSize = TARGET_IMAGE_SIZE * 1.37
          while (dataUrl.length > targetDataUrlSize && quality > 0.3) {
            quality -= 0.1
            dataUrl = canvas.toDataURL(outputType, quality)
          }
        }

        const base64 = dataUrl.split(',')[1]
        if (!base64) {
          cleanup()
          reject(new Error('Failed to encode image'))
          return
        }

        cleanup()
        resolve(base64)
      } catch (err) {
        cleanup()
        reject(
          err instanceof Error ? err : new Error('Image compression failed'),
        )
      }
    }

    img.onerror = () => {
      cleanup()
      reject(new Error('Failed to load image'))
    }

    img.src = objectUrl
  })
}

/**
 * Checks if a file is a supported image type.
 */
function isAcceptedImage(file: File): boolean {
  return ACCEPTED_IMAGE_TYPES.includes(file.type)
}

/**
 * Button component for attaching images to messages.
 */
export function AttachmentButton({
  onFileSelect,
  disabled = false,
  className,
}: AttachmentButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClick = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      event.target.value = ''

      const id = randomUUID()

      if (!isAcceptedImage(file)) {
        onFileSelect({
          id,
          file,
          preview: null,
          type: 'image',
          base64: null,
          error:
            'Unsupported file type. Please use PNG, JPG, GIF, or WebP images.',
        })
        return
      }

      if (file.size > MAX_FILE_SIZE) {
        onFileSelect({
          id,
          file,
          preview: null,
          type: 'image',
          base64: null,
          error: 'Image is too large. Maximum size is 10MB.',
        })
        return
      }

      try {
        const base64 = await compressImage(file)
        const preview = URL.createObjectURL(file)

        onFileSelect({
          id,
          file,
          preview,
          type: 'image',
          base64,
        })
      } catch (err) {
        onFileSelect({
          id,
          file,
          preview: null,
          type: 'image',
          base64: null,
          error: err instanceof Error ? err.message : 'Failed to process image',
        })
      }
    },
    [onFileSelect],
  )

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleClick}
        disabled={disabled}
        className={className}
        aria-label="Attach image"
        type="button"
      >
        <HugeiconsIcon icon={Attachment01Icon} size={18} strokeWidth={1.8} />
      </Button>
    </>
  )
}
