<script setup lang="ts">
import { computed } from 'vue'
import type { Table } from '@euchre/shared'

const props = defineProps<{
  table: Table
  isCurrent: boolean
  currentUserId: string
}>()

const emit = defineEmits<{
  joinSeat: [seatIndex: number]
}>()

// Game type detection
const gameType = computed(() => props.table.gameType || 'euchre')
const isEuchre = computed(() => gameType.value === 'euchre')
const isPresident = computed(() => gameType.value === 'president')
const isSpades = computed(() => gameType.value === 'spades')

// Team labels for Euchre seats
const seatTeams = ['Team A', 'Team B', 'Team A', 'Team B']

const seats = computed(() => {
  return props.table.seats.map((seat, index) => ({
    ...seat,
    team: isEuchre.value ? seatTeams[index] : `Seat ${index + 1}`,
    isCurrentUser: seat.player?.odusId === props.currentUserId,
    isEmpty: seat.player === null,
  }))
})

const filledSeats = computed(() => {
  return props.table.seats.filter((s) => s.player !== null).length
})

const maxPlayers = computed(() => props.table.maxPlayers || 4)

const gameTypeLabel = computed(() => {
  if (isEuchre.value) return 'Euchre'
  if (isPresident.value) {
    const settings = props.table.settings
    return settings?.superTwosMode ? 'President (Super 2s)' : 'President'
  }
  if (isSpades.value) return 'Spades'
  return 'Game'
})

function handleSeatClick(seatIndex: number) {
  const seat = props.table.seats[seatIndex]
  if (seat?.player === null && !props.isCurrent) {
    emit('joinSeat', seatIndex)
  }
}
</script>

<template>
  <div class="table-card" :class="{ current: isCurrent }">
    <div class="table-header">
      <div class="table-title">
        <h3>{{ table.name }}</h3>
        <span class="game-type-badge" :class="gameType">{{ gameTypeLabel }}</span>
      </div>
      <span class="seat-count">{{ filledSeats }}/{{ maxPlayers }} players</span>
    </div>

    <div class="seats-grid" :class="{ 'president-grid': isPresident, [`players-${maxPlayers}`]: isPresident }">
      <div
        v-for="(seat, index) in seats"
        :key="index"
        class="seat"
        :class="{
          occupied: !seat.isEmpty,
          empty: seat.isEmpty,
          host: seat.isHost,
          'current-user': seat.isCurrentUser,
          clickable: seat.isEmpty && !isCurrent,
        }"
        @click="handleSeatClick(index)"
      >
        <div class="seat-content">
          <template v-if="seat.player">
            <span class="player-name">
              {{ seat.isCurrentUser ? 'You' : seat.player.nickname }}
            </span>
            <span v-if="seat.isHost" class="host-badge">Host</span>
          </template>
          <template v-else>
            <span class="empty-label">
              <template v-if="isCurrent">(<span class="clanker">clanker</span>)</template>
              <template v-else>Join</template>
            </span>
          </template>
        </div>
        <span class="team-label">{{ seat.team }}</span>
      </div>
    </div>

    <div v-if="isEuchre" class="partnership-hint">
      <span>Seats 1 & 3 are partners</span>
      <span>Seats 2 & 4 are partners</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.table-card {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: $spacing-lg;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);

  &.current {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
    max-width: 500px;
    width: 100%;
  }
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-md;

  h3 {
    margin: 0;
    font-size: 1.125rem;
  }

  .seat-count {
    font-size: 0.875rem;
    opacity: 0.8;
  }
}

.table-title {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.game-type-badge {
  font-size: 0.625rem;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  font-weight: bold;

  &.euchre {
    background: rgba(66, 133, 244, 0.3);
    color: #82b1ff;
  }

  &.president {
    background: rgba(156, 39, 176, 0.3);
    color: #ce93d8;
  }

  &.spades {
    background: rgba(33, 33, 33, 0.45);
    color: #e0e0e0;
  }
}

.seats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: $spacing-sm;

  &.president-grid {
    &.players-5 {
      grid-template-columns: repeat(5, 1fr);
    }
    &.players-6 {
      grid-template-columns: repeat(3, 1fr);
    }
    &.players-7 {
      grid-template-columns: repeat(4, 1fr);
    }
    &.players-8 {
      grid-template-columns: repeat(4, 1fr);
    }
  }
}

.seat {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: $spacing-sm;
  border: 2px solid transparent;
  transition: all var(--anim-fast);
  min-height: 80px;

  &.occupied {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.2);
  }

  &.current-user {
    border-color: $secondary-color;
    background: rgba($secondary-color, 0.2);
  }

  &.empty.clickable {
    cursor: pointer;
  }
}

.seat-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.player-name {
  font-weight: bold;
  font-size: 0.875rem;
  text-align: center;
  word-break: break-word;
}

.host-badge {
  font-size: 0.625rem;
  background: $secondary-color;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}

.empty-label {
  font-size: 0.875rem;
  opacity: 0.6;
}

.team-label {
  font-size: 0.625rem;
  opacity: 0.5;
  margin-top: $spacing-xs;
}

.partnership-hint {
  display: flex;
  justify-content: space-between;
  margin-top: $spacing-md;
  padding-top: $spacing-sm;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 0.75rem;
  opacity: 0.6;
}
</style>
