<template>
  <div class="score-board">
    <div class="team-score">
      <h3>Your Team</h3>
      <div class="score">{{ teamScore(0) }}</div>
    </div>
    <div class="divider">-</div>
    <div class="team-score">
      <h3>Opponents</h3>
      <div class="score">{{ teamScore(1) }}</div>
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
  background: rgba(0, 0, 0, 0.7);
  padding: $spacing-xs $spacing-md;
  border-radius: 8px;
  color: white;
  font-family: 'Courier New', monospace;
}

.team-score {
  text-align: center;

  h3 {
    font-size: 0.75rem;
    margin-bottom: 2px;
    opacity: 0.8;

    @media (min-width: 768px) {
      font-size: 0.875rem;
      margin-bottom: $spacing-xs;
    }
  }

  .score {
    font-size: 1.25rem;
    font-weight: bold;

    @media (min-width: 768px) {
      font-size: 2rem;
    }
  }
}

.divider {
  font-size: 1rem;
  opacity: 0.5;

  @media (min-width: 768px) {
    font-size: 1.5rem;
  }
}
</style>
