/**
 * TipTap 붙여넣기·드롭 이미지 업로드 확장.
 * @tiptap/* 는 호스트(@nuxt/ui) peer — 런타임에만 resolve.
 */
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import type { EditorImageEntry } from 'memi-board'

export interface PasteImageExtensionOptions {
  /** 업로드 실행 (원본+썸네일). 실패 시 throw */
  upload: (file: File) => Promise<EditorImageEntry>
  onUploading?: (uploading: boolean) => void
  onUploaded?: (entry: EditorImageEntry) => void | Promise<void>
  onError?: (msg: string) => void
  /** 기본 5MB */
  maxBytes?: number
}

async function handleImageFile(
  file: File,
  view: EditorView,
  options: PasteImageExtensionOptions,
) {
  const max = options.maxBytes ?? 5 * 1024 * 1024
  if (!file.type.startsWith('image/')) return
  if (file.size > max) {
    options.onError?.(`이미지는 ${Math.floor(max / 1024 / 1024)}MB 이하여야 합니다.`)
    return
  }

  options.onUploading?.(true)
  try {
    const entry = await options.upload(file)
    const { schema, tr } = view.state
    const imageNode = schema.nodes.image?.create({ src: entry.originalUrl })
    if (!imageNode) {
      options.onError?.('에디터에 이미지를 넣을 수 없습니다.')
      return
    }
    view.dispatch(tr.replaceSelectionWith(imageNode).scrollIntoView())
    await options.onUploaded?.(entry)
  }
  catch (e) {
    options.onError?.((e as Error).message || '이미지 업로드 실패')
  }
  finally {
    options.onUploading?.(false)
  }
}

/** 호스트 UEditor :extensions 에 넣을 TipTap Extension 생성 */
export function createPasteImageExtension(options: PasteImageExtensionOptions) {
  return Extension.create({
    name: 'memiBoardPasteImage',

    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey('memiBoardPasteImage'),
          props: {
            handlePaste(view: EditorView, event: ClipboardEvent) {
              const items = Array.from(event.clipboardData?.items ?? []) as DataTransferItem[]
              const imageItem = items.find(item => item.type.startsWith('image/'))
              if (!imageItem) return false
              const file = imageItem.getAsFile()
              if (!file) return false
              void handleImageFile(file, view, options)
              event.preventDefault()
              return true
            },
            handleDrop(view: EditorView, event: DragEvent) {
              const files = Array.from(event.dataTransfer?.files ?? []) as File[]
              const image = files.find(f => f.type.startsWith('image/'))
              if (!image) return false
              void handleImageFile(image, view, options)
              event.preventDefault()
              return true
            },
          },
        }),
      ]
    },
  })
}
