<script setup lang="ts">
import {
  AUTHOR_MEMO_MAX_COUNT,
  AUTHOR_MEMO_MAX_LENGTH,
  BOARD_NAME_MAX,
  COMMENT_BODY_MAX_LENGTH,
  COMMENT_EDIT_LIMIT,
  COMMENT_IMAGE_LIMIT,
  CUSTOM_FIELD_LABEL_MAX,
  CUSTOM_FIELD_MAX,
  CUSTOM_FIELD_PLACEHOLDER_MAX,
  CUSTOM_FIELD_VALUE_MAX,
  DEFAULT_BLOCK_BAN_THRESHOLD,
  HTML_MAX_CHARS,
  POST_EDIT_LIMIT,
  PROFILE_BIO_MAX,
  PROFILE_NAME_MAX,
  REPORT_COMMENT_EXCERPT_MAX_LENGTH,
  REPORT_DETAIL_MAX_LENGTH,
  REPORT_REVIEW_NOTE_MAX_LENGTH,
  WRITING_ASSISTANT_DAILY_LIMIT,
  versionHistory
} from 'memi-board/runtime'
import { EDITOR_IMAGE_MAX_BYTES, EDITOR_IMAGE_SOURCE_MAX_BYTES } from 'memi-board/storage'

interface Row {
  id: string
  parameter: string
  /** null = no limit is defined anywhere. */
  value: number | null
  unit: string
  /** Constant name in memi-board, when there is one. */
  symbol?: string
  /** Also enforced server-side in firestore.rules / storage.rules. */
  rules: boolean
  note?: string
}

interface Section {
  id: string
  title: string
  rows: Row[]
}

const MIB = 1024 * 1024

const sections: Section[] = [
  {
    id: '1',
    title: 'Profile',
    rows: [
      { id: '1.1', parameter: 'Display name', value: PROFILE_NAME_MAX, unit: 'chars', symbol: 'PROFILE_NAME_MAX', rules: true, note: 'Also copied to authorName on posts, comments and reports' },
      { id: '1.2', parameter: 'Bio', value: PROFILE_BIO_MAX, unit: 'chars', symbol: 'PROFILE_BIO_MAX', rules: true },
      { id: '1.3', parameter: 'Author memo length', value: AUTHOR_MEMO_MAX_LENGTH, unit: 'chars', symbol: 'AUTHOR_MEMO_MAX_LENGTH', rules: false },
      { id: '1.4', parameter: 'Author memos per user', value: AUTHOR_MEMO_MAX_COUNT, unit: 'items', symbol: 'AUTHOR_MEMO_MAX_COUNT', rules: false }
    ]
  },
  {
    id: '2',
    title: 'Posts',
    rows: [
      { id: '2.1', parameter: 'Title length', value: null, unit: 'chars', rules: false },
      { id: '2.2', parameter: 'Body length', value: null, unit: 'chars', rules: false, note: 'Only the 1 MiB Firestore document limit applies' },
      { id: '2.3', parameter: 'Edits per post (author)', value: POST_EDIT_LIMIT, unit: 'edits', symbol: 'POST_EDIT_LIMIT', rules: true, note: 'Board managers are exempt' },
      { id: '2.4', parameter: 'Editor image (stored)', value: EDITOR_IMAGE_MAX_BYTES / MIB, unit: 'MiB', symbol: 'EDITOR_IMAGE_MAX_BYTES', rules: true },
      { id: '2.5', parameter: 'Editor image (source, before resize)', value: EDITOR_IMAGE_SOURCE_MAX_BYTES / MIB, unit: 'MiB', symbol: 'EDITOR_IMAGE_SOURCE_MAX_BYTES', rules: false }
    ]
  },
  {
    id: '3',
    title: 'Comments',
    rows: [
      { id: '3.1', parameter: 'Body length', value: COMMENT_BODY_MAX_LENGTH, unit: 'chars', symbol: 'COMMENT_BODY_MAX_LENGTH', rules: true },
      { id: '3.2', parameter: 'Images per comment', value: COMMENT_IMAGE_LIMIT, unit: 'images', symbol: 'COMMENT_IMAGE_LIMIT', rules: true },
      { id: '3.3', parameter: 'Edits per comment (author)', value: COMMENT_EDIT_LIMIT, unit: 'edits', symbol: 'COMMENT_EDIT_LIMIT', rules: true, note: 'Board managers are exempt' }
    ]
  },
  {
    id: '4',
    title: 'Board settings',
    rows: [
      { id: '4.1', parameter: 'Board name', value: BOARD_NAME_MAX, unit: 'chars', symbol: 'BOARD_NAME_MAX', rules: false },
      { id: '4.2', parameter: 'Custom fields per board', value: CUSTOM_FIELD_MAX, unit: 'fields', symbol: 'CUSTOM_FIELD_MAX', rules: false },
      { id: '4.3', parameter: 'Custom field label', value: CUSTOM_FIELD_LABEL_MAX, unit: 'chars', symbol: 'CUSTOM_FIELD_LABEL_MAX', rules: false },
      { id: '4.4', parameter: 'Custom field placeholder', value: CUSTOM_FIELD_PLACEHOLDER_MAX, unit: 'chars', symbol: 'CUSTOM_FIELD_PLACEHOLDER_MAX', rules: false },
      { id: '4.5', parameter: 'Custom field value', value: CUSTOM_FIELD_VALUE_MAX, unit: 'chars', symbol: 'CUSTOM_FIELD_VALUE_MAX', rules: false }
    ]
  },
  {
    id: '5',
    title: 'Reports',
    rows: [
      { id: '5.1', parameter: 'Report detail', value: REPORT_DETAIL_MAX_LENGTH, unit: 'chars', symbol: 'REPORT_DETAIL_MAX_LENGTH', rules: true },
      { id: '5.2', parameter: 'Review note', value: REPORT_REVIEW_NOTE_MAX_LENGTH, unit: 'chars', symbol: 'REPORT_REVIEW_NOTE_MAX_LENGTH', rules: true },
      { id: '5.3', parameter: 'Comment excerpt (snapshot)', value: REPORT_COMMENT_EXCERPT_MAX_LENGTH, unit: 'chars', symbol: 'REPORT_COMMENT_EXCERPT_MAX_LENGTH', rules: true },
      { id: '5.4', parameter: 'Post title (snapshot)', value: 200, unit: 'chars', rules: true, note: 'Literal in code, no constant' }
    ]
  },
  {
    id: '6',
    title: 'AI and moderation',
    rows: [
      { id: '6.1', parameter: 'Writing assistant calls', value: WRITING_ASSISTANT_DAILY_LIMIT, unit: 'per 24 h', symbol: 'WRITING_ASSISTANT_DAILY_LIMIT', rules: true },
      { id: '6.2', parameter: 'Auto-translate HTML input', value: HTML_MAX_CHARS, unit: 'chars', symbol: 'HTML_MAX_CHARS', rules: false },
      { id: '6.3', parameter: 'Moderation block ban threshold', value: DEFAULT_BLOCK_BAN_THRESHOLD, unit: 'blocks', symbol: 'DEFAULT_BLOCK_BAN_THRESHOLD', rules: false }
    ]
  }
]

const allRows = sections.flatMap(section => section.rows)
const openCount = allRows.filter(row => row.value === null).length
const clientOnlyCount = allRows.filter(row => row.value !== null && !row.rules).length

const version = versionHistory[0]?.version

function formatValue(value: number | null) {
  return value === null ? '—' : value.toLocaleString('en-US')
}
</script>

<template>
  <div class="space-y-8">
    <header class="space-y-5">
      <div>
        <p class="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
          memi-board / spec
        </p>
        <h2 class="text-3xl font-semibold tracking-tight text-highlighted sm:text-4xl">
          Limits and constants
        </h2>
      </div>
      <dl class="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-default bg-accented font-mono text-xs sm:grid-cols-4">
        <div class="bg-default p-3">
          <dt class="text-muted">
            DOC REV
          </dt>
          <dd class="mt-1 text-highlighted">
            v{{ version }}
          </dd>
        </div>
        <div class="bg-default p-3">
          <dt class="text-muted">
            PARAMETERS
          </dt>
          <dd class="mt-1 text-highlighted tabular-nums">
            {{ allRows.length }}
          </dd>
        </div>
        <div class="bg-default p-3">
          <dt class="text-muted">
            CLIENT ONLY
          </dt>
          <dd class="mt-1 text-highlighted tabular-nums">
            {{ clientOnlyCount }}
          </dd>
        </div>
        <div class="bg-default p-3">
          <dt class="text-muted">
            OPEN
          </dt>
          <dd class="mt-1 text-highlighted tabular-nums">
            {{ openCount }}
          </dd>
        </div>
      </dl>
    </header>

    <section
      v-for="section in sections"
      :key="section.id"
      :aria-labelledby="`spec-${section.id}`"
      class="space-y-3"
    >
      <h3
        :id="`spec-${section.id}`"
        class="flex items-baseline gap-3 font-mono text-sm font-semibold uppercase tracking-wider text-highlighted"
      >
        <span class="text-muted">{{ section.id }}</span>{{ section.title }}
      </h3>
      <div class="overflow-x-auto rounded-md border border-default" role="region" :aria-label="section.title" tabindex="0">
        <table class="w-full border-collapse text-left text-sm">
          <thead class="bg-elevated font-mono text-[11px] uppercase tracking-wider text-muted">
            <tr>
              <th class="w-12 px-2 py-2 font-medium sm:w-14 sm:px-3">
                ID
              </th>
              <th class="px-3 py-2 font-medium">
                Parameter
              </th>
              <th class="px-3 py-2 text-right font-medium">
                Value
              </th>
              <th class="w-[5.5rem] px-2 py-2 font-medium sm:w-24 sm:px-3">
                Enforced
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in section.rows"
              :key="row.id"
              class="border-t border-default align-top"
            >
              <td class="px-2 py-2 font-mono text-xs text-muted sm:px-3">
                {{ row.id }}
              </td>
              <td class="px-3 py-2">
                <span class="text-highlighted">{{ row.parameter }}</span>
                <span v-if="row.symbol" class="mt-0.5 block break-all font-mono text-[11px] text-dimmed">{{ row.symbol }}</span>
                <span v-if="row.note" class="mt-0.5 block text-xs text-muted">{{ row.note }}</span>
              </td>
              <td class="px-3 py-2 text-right font-mono tabular-nums" :class="row.value === null ? 'text-warning' : 'text-highlighted'">
                {{ formatValue(row.value) }}
                <span class="block text-[11px] text-muted">{{ row.unit }}</span>
              </td>
              <td class="px-2 py-2 sm:px-3">
                <UBadge v-if="row.value === null" color="warning" variant="subtle" size="sm" label="OPEN" class="font-mono" />
                <UBadge v-else-if="row.rules" color="success" variant="subtle" size="sm" label="RULES" class="font-mono" />
                <UBadge v-else color="neutral" variant="subtle" size="sm" label="CLIENT" class="font-mono" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div class="space-y-1 border-t border-default pt-4 font-mono text-xs leading-6 text-muted">
      <p><span class="text-highlighted">RULES</span> enforced server-side by firestore.rules or storage.rules, so a direct API write cannot exceed it.</p>
      <p><span class="text-highlighted">CLIENT</span> checked in the app only.</p>
      <p><span class="text-highlighted">OPEN</span> no limit is defined.</p>
      <p>Values are read from the memi-board package. Item 5.4 is a literal in code.</p>
    </div>
  </div>
</template>
