<template>
  <div class="score-board">
    <div class="team-score">
      <div class="label-section">
        <span class="label">Us</span>
      </div>
      <div class="score-section">
        <span class="score">{{ teamScore(0) }}</span>
      </div>
    </div>
    <div class="team-score">
      <div class="label-section">
        <span class="label">Them</span>
      </div>
      <div class="score-section">
        <span class="score">{{ teamScore(1) }}</span>
      </div>
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
  align-items: stretch;
  gap: 0;
  background: rgba(255, 255, 255, 0.1);
  padding: 0;
  border-radius: 8px;
  color: white;
  font-family: 'Courier New', monospace;
  overflow: hidden;
}

.team-score {
  display: flex;
  flex-direction: column;
  width: 50px; // Fixed width for equal sizing

  &:first-child {
    border-right: 2px solid rgba(255, 255, 255, 0.3);
  }

  .label-section {
    background: rgba(255, 255, 255, 0.2);
    padding: 2px $spacing-xs;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .label {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: white;
  }

  .score-section {
    background: rgba(255, 255, 255, 0.1);
    padding: $spacing-xs;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
  }

  .score {
    font-size: 1.4rem;
    font-weight: bold;
    color: white;
  }
}
</style>
