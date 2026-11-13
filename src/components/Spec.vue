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
  DEFAULT_BLOCK_BAN_DECAY_MS,
  DEFAULT_BLOCK_BAN_THRESHOLD,
  HTML_MAX_CHARS,
  POST_ATTACHMENT_MAX,
  POST_BODY_MAX,
  POST_EDIT_LIMIT,
  POST_SLUG_MAX,
  POST_TAG_LENGTH_MAX,
  POST_TAG_MAX,
  POST_TITLE_MAX,
  POST_TITLE_TRANSLATION_MAX,
  POST_TRANSLATION_BUDGET,
  PROFILE_BIO_MAX,
  PROFILE_NAME_MAX,
  REPORT_COMMENT_EXCERPT_MAX_LENGTH,
  REPORT_DETAIL_MAX_LENGTH,
  REPORT_REVIEW_NOTE_MAX_LENGTH,
  WRITING_ASSISTANT_DAILY_LIMIT,
  versionHistory
} from 'memi-board/runtime'
import { EDITOR_IMAGE_MAX_BYTES, EDITOR_IMAGE_SOURCE_MAX_BYTES } from 'memi-board/storage'

/**
 * rules   — firestore.rules / storage.rules reject a direct API write past the limit.
 * partial — rules cover only part of the path; see the row note.
 * client  — checked in the app only.
 * A row with value null has no limit at all (OPEN).
 */
type Enforcement = 'rules' | 'partial' | 'client'

interface Row {
  id: string
  parameter: string
  value: number | null
  unit: string
  /** Constant name in memi-board. Literal values have none. */
  symbol?: string
  enforced: Enforcement
  note?: string
}

interface Section {
  id: string
  title: string
  rows: Row[]
}

const MIB = 1024 * 1024
const REVISION_FLAG_NOTE = 'Rules count edits only when memiBoardPostsSlugs/__migration.revisionsRequired is true. Board managers are exempt.'

const sections: Section[] = [
  {
    id: '1',
    title: 'Profile',
    rows: [
      { id: '1.1', parameter: 'Display name', value: PROFILE_NAME_MAX, unit: 'chars', symbol: 'PROFILE_NAME_MAX', enforced: 'rules', note: 'Also limits authorName and replyToName copied onto posts, comments and reports.' },
      { id: '1.2', parameter: 'Bio', value: PROFILE_BIO_MAX, unit: 'chars', symbol: 'PROFILE_BIO_MAX', enforced: 'rules' },
      { id: '1.3', parameter: 'Profile photo file', value: 3, unit: 'MiB', enforced: 'rules', note: 'JPEG only. Literal in storage.rules.' },
      { id: '1.4', parameter: 'Profile photo URL', value: null, unit: 'chars', enforced: 'client', note: 'Sign-in and profile editing only write provider or Storage URLs, but rules accept any string in photoURL and authorPhoto from a direct API write. Low risk: images only, may load external URLs.' },
      { id: '1.5', parameter: 'Author memo length', value: AUTHOR_MEMO_MAX_LENGTH, unit: 'chars', symbol: 'AUTHOR_MEMO_MAX_LENGTH', enforced: 'rules', note: 'Rules also allow only text, sentiment (good, bad or none) and updatedAt.' },
      { id: '1.6', parameter: 'Author memos per user', value: AUTHOR_MEMO_MAX_COUNT, unit: 'items', symbol: 'AUTHOR_MEMO_MAX_COUNT', enforced: 'client', note: 'Owner-only subcollection; the app reads the newest 100, so extra memos only cost storage. Planned check in board settings → Diagnostics.' }
    ]
  },
  {
    id: '2',
    title: 'Posts',
    rows: [
      { id: '2.1', parameter: 'Title length', value: POST_TITLE_MAX, unit: 'chars', symbol: 'POST_TITLE_MAX', enforced: 'rules', note: 'Existing longer titles are checked only when the title changes.' },
      { id: '2.2', parameter: 'Translated title length', value: POST_TITLE_TRANSLATION_MAX, unit: 'chars', symbol: 'POST_TITLE_TRANSLATION_MAX', enforced: 'rules', note: 'Per locale in post.i18n.' },
      { id: '2.3', parameter: 'Post URL (slug)', value: POST_SLUG_MAX, unit: 'chars', symbol: 'POST_SLUG_MAX', enforced: 'rules', note: 'Rules allow up to 80 to leave room for a numeric suffix. New posts only.' },
      { id: '2.4', parameter: 'Body length', value: POST_BODY_MAX, unit: 'HTML chars', symbol: 'POST_BODY_MAX', enforced: 'partial', note: 'Rules cap every board at this value. On auto-translated boards the app lowers it to min(6.3, 6.4 ÷ target languages): 9 targets → 5,500, 7 → 7,100, 3 or fewer → 10,000.' },
      { id: '2.5', parameter: 'Tags per post', value: POST_TAG_MAX, unit: 'tags', symbol: 'POST_TAG_MAX', enforced: 'rules', note: 'Display only; tags are not translated or searchable. Duplicates (case-insensitive) are dropped. Tags cannot contain line breaks.' },
      { id: '2.6', parameter: 'Tag length', value: POST_TAG_LENGTH_MAX, unit: 'chars', symbol: 'POST_TAG_LENGTH_MAX', enforced: 'rules' },
      { id: '2.7', parameter: 'Attachments per post', value: POST_ATTACHMENT_MAX, unit: 'files', symbol: 'POST_ATTACHMENT_MAX', enforced: 'rules', note: 'Each entry must point into the post\'s own attachments folder.' },
      { id: '2.8', parameter: 'Attachment file', value: 20, unit: 'MiB', enforced: 'rules', note: 'Recommended default in storage.rules, which also blocks HTML, SVG, scripts and executables. Sites may adjust both, e.g. larger files for app downloads.' },
      { id: '2.9', parameter: 'Editor image file (stored)', value: EDITOR_IMAGE_MAX_BYTES / MIB, unit: 'MiB', symbol: 'EDITOR_IMAGE_MAX_BYTES', enforced: 'rules' },
      { id: '2.10', parameter: 'Editor image file (before resize)', value: EDITOR_IMAGE_SOURCE_MAX_BYTES / MIB, unit: 'MiB', symbol: 'EDITOR_IMAGE_SOURCE_MAX_BYTES', enforced: 'client', note: 'The stored file is still capped by 2.9.' },
      { id: '2.11', parameter: 'Images per image-board post', value: 20, unit: 'images', enforced: 'client', note: 'COVER_IMAGE_MAX in Editor.vue, not exported.' },
      { id: '2.12', parameter: 'Edits per post (author)', value: POST_EDIT_LIMIT, unit: 'edits', symbol: 'POST_EDIT_LIMIT', enforced: 'partial', note: REVISION_FLAG_NOTE },
      { id: '2.13', parameter: 'Editor name in edit history', value: 80, unit: 'chars', enforced: 'rules', note: 'Literal in code and firestore.rules.' }
    ]
  },
  {
    id: '3',
    title: 'Comments',
    rows: [
      { id: '3.1', parameter: 'Body length', value: COMMENT_BODY_MAX_LENGTH, unit: 'chars', symbol: 'COMMENT_BODY_MAX_LENGTH', enforced: 'rules' },
      { id: '3.2', parameter: 'Images per comment', value: COMMENT_IMAGE_LIMIT, unit: 'images', symbol: 'COMMENT_IMAGE_LIMIT', enforced: 'rules' },
      { id: '3.3', parameter: 'Comment image file', value: 5, unit: 'MiB', enforced: 'rules', note: 'Literal in storage.rules.' },
      { id: '3.4', parameter: 'Edits per comment (author)', value: COMMENT_EDIT_LIMIT, unit: 'edits', symbol: 'COMMENT_EDIT_LIMIT', enforced: 'partial', note: REVISION_FLAG_NOTE }
    ]
  },
  {
    id: '4',
    title: 'Board settings',
    rows: [
      { id: '4.1', parameter: 'Board name', value: BOARD_NAME_MAX, unit: 'chars', symbol: 'BOARD_NAME_MAX', enforced: 'client', note: 'Only admins and board managers can write settings.' },
      { id: '4.2', parameter: 'Custom fields per board', value: CUSTOM_FIELD_MAX, unit: 'fields', symbol: 'CUSTOM_FIELD_MAX', enforced: 'client', note: 'Field definitions: admins and board managers only.' },
      { id: '4.3', parameter: 'Custom field label', value: CUSTOM_FIELD_LABEL_MAX, unit: 'chars', symbol: 'CUSTOM_FIELD_LABEL_MAX', enforced: 'client', note: 'Field definitions: admins and board managers only.' },
      { id: '4.4', parameter: 'Custom field placeholder', value: CUSTOM_FIELD_PLACEHOLDER_MAX, unit: 'chars', symbol: 'CUSTOM_FIELD_PLACEHOLDER_MAX', enforced: 'client', note: 'Field definitions: admins and board managers only.' },
      { id: '4.5', parameter: 'Custom field value', value: CUSTOM_FIELD_VALUE_MAX, unit: 'chars', symbol: 'CUSTOM_FIELD_VALUE_MAX', enforced: 'rules', note: 'Stored on each post in post.extend. Rules check up to 20 entries and each value\'s length (single line), but not the keys.' },
      { id: '4.6', parameter: 'Board banner file', value: 3, unit: 'MiB', enforced: 'rules', note: 'JPEG only. Literal in storage.rules.' }
    ]
  },
  {
    id: '5',
    title: 'Reports',
    rows: [
      { id: '5.1', parameter: 'Report detail', value: REPORT_DETAIL_MAX_LENGTH, unit: 'chars', symbol: 'REPORT_DETAIL_MAX_LENGTH', enforced: 'rules' },
      { id: '5.2', parameter: 'Review note', value: REPORT_REVIEW_NOTE_MAX_LENGTH, unit: 'chars', symbol: 'REPORT_REVIEW_NOTE_MAX_LENGTH', enforced: 'rules' },
      { id: '5.3', parameter: 'Comment excerpt (snapshot)', value: REPORT_COMMENT_EXCERPT_MAX_LENGTH, unit: 'chars', symbol: 'REPORT_COMMENT_EXCERPT_MAX_LENGTH', enforced: 'rules' },
      { id: '5.4', parameter: 'Post title (snapshot)', value: 200, unit: 'chars', enforced: 'rules', note: 'Literal in code and firestore.rules.' },
      { id: '5.5', parameter: 'Reviewer name', value: 80, unit: 'chars', enforced: 'rules', note: 'Literal in code and firestore.rules.' }
    ]
  },
  {
    id: '6',
    title: 'AI and moderation',
    rows: [
      { id: '6.1', parameter: 'Writing assistant calls', value: WRITING_ASSISTANT_DAILY_LIMIT, unit: 'per 24 h', symbol: 'WRITING_ASSISTANT_DAILY_LIMIT', enforced: 'partial', note: 'Rules guard the usage counter only. The model is called from the browser through firebase/ai and is not tied to the counter.' },
      { id: '6.2', parameter: 'Writing assistant custom instruction', value: 200, unit: 'chars', enforced: 'client', note: 'CUSTOM_INSTRUCTION_MAX_LENGTH, not exported.' },
      { id: '6.3', parameter: 'Body translation per language call', value: HTML_MAX_CHARS, unit: 'HTML chars', symbol: 'HTML_MAX_CHARS', enforced: 'client', note: 'Output capped at 16,384 tokens; a cut-off translation is discarded and that language shows the original. Longer bodies keep title and summary translations.' },
      { id: '6.4', parameter: 'Body translation budget per save', value: POST_TRANSLATION_BUDGET, unit: 'HTML chars', symbol: 'POST_TRANSLATION_BUDGET', enforced: 'client', note: 'Divided by the number of target languages to set 2.4.' },
      { id: '6.5', parameter: 'Moderation block ban threshold', value: DEFAULT_BLOCK_BAN_THRESHOLD, unit: 'blocks', symbol: 'DEFAULT_BLOCK_BAN_THRESHOLD', enforced: 'partial', note: 'Rules refuse new posts and comments at this count, but the block count itself is reported by the browser. Keep in sync with the host config.' },
      { id: '6.6', parameter: 'Block count decay', value: DEFAULT_BLOCK_BAN_DECAY_MS / 3_600_000, unit: 'h', symbol: 'DEFAULT_BLOCK_BAN_DECAY_MS', enforced: 'partial', note: 'Same decay in rules and app.' }
    ]
  }
]

const BADGES = {
  open: { label: 'OPEN', color: 'error' },
  rules: { label: 'RULES', color: 'success' },
  partial: { label: 'PARTIAL', color: 'warning' },
  client: { label: 'CLIENT', color: 'neutral' }
} as const

function statusOf(row: Row): keyof typeof BADGES {
  return row.value === null ? 'open' : row.enforced
}

const allRows = sections.flatMap(section => section.rows)
const counts = Object.fromEntries(
  (Object.keys(BADGES) as (keyof typeof BADGES)[]).map(key => [key, allRows.filter(row => statusOf(row) === key).length])
) as Record<keyof typeof BADGES, number>

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
      <dl class="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-default bg-accented font-mono text-xs sm:grid-cols-5">
        <div class="col-span-2 bg-default p-3 sm:col-span-1">
          <dt class="text-muted">
            DOC REV
          </dt>
          <dd class="mt-1 text-highlighted">
            v{{ version }} · {{ allRows.length }} items
          </dd>
        </div>
        <div v-for="(badge, key) in BADGES" :key="key" class="bg-default p-3">
          <dt class="text-muted">
            {{ badge.label }}
          </dt>
          <dd class="mt-1 text-highlighted tabular-nums">
            {{ counts[key] }}
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
              <td class="px-3 py-2 text-right font-mono tabular-nums" :class="row.value === null ? 'text-error' : 'text-highlighted'">
                {{ formatValue(row.value) }}
                <span class="block text-[11px] text-muted">{{ row.unit }}</span>
              </td>
              <td class="px-2 py-2 sm:px-3">
                <UBadge
                  :label="BADGES[statusOf(row)].label"
                  :color="BADGES[statusOf(row)].color"
                  variant="subtle"
                  size="sm"
                  class="font-mono"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div class="space-y-1 border-t border-default pt-4 font-mono text-xs leading-6 text-muted">
      <p><span class="text-highlighted">RULES</span> firestore.rules or storage.rules reject a direct API write past the limit.</p>
      <p><span class="text-highlighted">PARTIAL</span> rules cover only part of the path; see the row note.</p>
      <p><span class="text-highlighted">CLIENT</span> checked in the app only.</p>
      <p><span class="text-highlighted">OPEN</span> no limit is defined.</p>
      <p>Values come from the memi-board package; rows without a constant name are literals.</p>
    </div>

    <div class="space-y-2 rounded-md border border-warning/30 bg-warning/5 p-4 text-xs leading-6 text-muted">
      <p class="font-mono font-semibold uppercase tracking-wider text-warning">
        Known gaps outside this table
      </p>
      <p>AI moderation runs in the browser. Rules accept moderationStatus 'approved' as written by the client, so a direct API write skips moderation.</p>
      <p>Storage rules cannot count files in a folder, so uploads that are never attached to a post are only removed by the orphan cleanup after 24 hours.</p>
      <p>RULES rows describe the package's recommended rules (docs/*.rules.example). Each site may adjust them, and they apply only once deployed.</p>
    </div>
  </div>
</template>
