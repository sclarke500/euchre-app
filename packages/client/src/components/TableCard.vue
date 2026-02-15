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
  if (isPresident.value) return 'President'
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
      <span class="game-type-badge" :class="gameType">{{ gameTypeLabel }}</span>
      <span class="table-name">{{ table.name }}</span>
      <span class="seat-count">{{ filledSeats }}/{{ maxPlayers }}</span>
    </div>

    <div class="seats-row">
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
        <template v-if="seat.player">
          <span class="player-name">{{ seat.isCurrentUser ? 'You' : seat.player.nickname }}</span>
          <span v-if="seat.isHost" class="host-badge">H</span>
        </template>
        <template v-else>
          <span class="empty-label">{{ isCurrent ? 'AI' : '+' }}</span>
        </template>
      </div>
    </div>

    <div v-if="isCurrent && isEuchre" class="partnership-hint">
      <span>1 & 3 partners • 2 & 4 partners</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.table-card {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: $spacing-sm $spacing-md;
  
  &.current {
    background: rgba(255, 255, 255, 0.12);
    padding: $spacing-md $spacing-lg;
  }
}

.table-header {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  margin-bottom: $spacing-sm;
}

.game-type-badge {
  font-size: 0.7rem;
  padding: 3px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.02em;

  &.euchre {
    background: rgba(66, 133, 244, 0.4);
    color: #a8c7ff;
  }

  &.president {
    background: rgba(156, 39, 176, 0.4);
    color: #daa8e0;
  }

  &.spades {
    background: rgba(80, 80, 80, 0.5);
    color: #ccc;
  }
}

.table-name {
  flex: 1;
  font-size: 0.9rem;
  font-weight: 500;
  opacity: 0.9;
}

.seat-count {
  font-size: 0.8rem;
  opacity: 0.6;
}

.seats-row {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  
  &::-webkit-scrollbar {
    display: none;
  }
}

.seat {
  flex: 0 0 auto;
  min-width: 60px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  padding: 0 $spacing-sm;
  transition: all var(--anim-fast);

  &.occupied {
    background: rgba(255, 255, 255, 0.12);
  }

  &.current-user {
    background: rgba($secondary-color, 0.25);
  }

  &.empty.clickable {
    cursor: pointer;
    
    &:hover {
      background: rgba(255, 255, 255, 0.1);
    }
  }
  
  // Larger seats for current table view
  .current & {
    min-width: 80px;
    height: 56px;
    flex-direction: column;
  }
}

.player-name {
  font-weight: 600;
  font-size: 0.75rem;
  text-align: center;
  max-width: 70px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.host-badge {
  font-size: 0.55rem;
  background: $secondary-color;
  color: white;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 700;
}

.empty-label {
  font-size: 0.8rem;
  opacity: 0.5;
}

.partnership-hint {
  margin-top: $spacing-sm;
  font-size: 0.7rem;
  opacity: 0.5;
  text-align: center;
}
</style>
