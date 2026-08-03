/**
 * TipTap 붙여넣기·드롭 이미지 업로드 확장.
 * PluginKey 는 모듈 단일 인스턴스 — 재생성 시 "Adding different instances of a keyed plugin" 방지.
 */
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import type { EditorImageEntry } from 'memi-board'

export interface PasteImageExtensionOptions {
  upload: (file: File) => Promise<EditorImageEntry>
  onUploading?: (uploading: boolean) => void
  onUploaded?: (entry: EditorImageEntry) => void | Promise<void>
  onError?: (msg: string) => void
  maxBytes?: number
}

/** 전역 1개 — create 호출마다 new PluginKey 하면 키 충돌 남 */
const pasteImagePluginKey = new PluginKey('memiBoardPasteImage')

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

/** 호스트 UEditor :extensions 에 넣을 TipTap Extension 생성 (인스턴스당 1회만 호출) */
export function createPasteImageExtension(options: PasteImageExtensionOptions) {
  return Extension.create({
    name: 'memiBoardPasteImage',

    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: pasteImagePluginKey,
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
