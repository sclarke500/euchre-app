<template>
  <div class="score-board">
    <div class="team-score">
      <span class="label">Us</span>
      <span class="score">{{ teamScore(0) }}</span>
    </div>
    <div class="divider">-</div>
    <div class="team-score">
      <span class="label">Them</span>
      <span class="score">{{ teamScore(1) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TeamScore } from '@euchre/shared'

interface Props {
  scores: TeamScore[]
}

const props = defineProps<Props>()

function teamScore(teamId: number): number {
  return props.scores.find((s) => s.teamId === teamId)?.score ?? 0
}
</script>

<style scoped lang="scss">
.score-board {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  background: #f0f0f0;
  padding: $spacing-xs $spacing-md;
  border-radius: 8px;
  color: #333;
  font-family: 'Courier New', monospace;
}

.team-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;

  .label {
    font-size: 0.85rem;
    opacity: 0.7;
  }

  .score {
    font-size: 1.7rem;
    font-weight: bold;
  }
}

.divider {
  font-size: 1.25rem;
  opacity: 0.4;
  margin: 0 4px;
}
</style>
