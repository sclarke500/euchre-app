<template>
  <div class="score-board">
    <div class="team-score">
      <span class="label">Your Team</span>
      <span class="score">{{ teamScore(0) }}</span>
    </div>
    <div class="divider">-</div>
    <div class="team-score">
      <span class="label">Opponents</span>
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
  gap: $spacing-xs;
  background: rgba(0, 0, 0, 0.6);
  padding: $spacing-xs $spacing-sm;
  border-radius: 6px;
  color: white;
  font-family: 'Courier New', monospace;
}

.team-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;

  .label {
    font-size: 0.6rem;
    opacity: 0.7;
  }

  .score {
    font-size: 1rem;
    font-weight: bold;
  }
}

.divider {
  font-size: 0.875rem;
  opacity: 0.5;
  margin: 0 2px;
}
</style>
