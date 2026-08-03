<script setup lang="ts">
import { versionHistory } from 'memi-board'
</script>

<template>
  <div class="flex flex-col gap-6">
    <div
      v-for="entry in versionHistory"
      :key="entry.version"
      class="flex flex-col gap-2"
    >
      <div class="flex items-center gap-2">
        <UBadge
          :label="`v${entry.version}`"
          color="primary"
          variant="subtle"
        />
        <span class="text-sm text-muted">{{ entry.date }}</span>
      </div>
      <ul class="list-disc list-inside text-sm leading-relaxed space-y-1">
        <li
          v-for="item in entry.highlights"
          :key="item"
        >
          {{ item }}
        </li>
      </ul>
      <p
        v-if="entry.note"
        class="text-xs text-muted"
      >
        {{ entry.note }}
      </p>
    </div>
  </div>
</template>
