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

// Get host name for list view
const hostName = computed(() => {
  const hostSeat = props.table.seats.find(s => s.isHost && s.player)
  return hostSeat?.player?.nickname || 'Unknown'
})

function handleSeatClick(seatIndex: number) {
  const seat = props.table.seats[seatIndex]
  if (seat?.player === null && !props.isCurrent) {
    emit('joinSeat', seatIndex)
  }
}
</script>

<template>
  <!-- LIST VIEW (compact row for lobby) -->
  <div v-if="!isCurrent" class="table-row">
    <span class="game-type-badge" :class="gameType">{{ gameTypeLabel }}</span>
    <span class="host-name">{{ hostName }}</span>
    <div class="seat-dots">
      <span 
        v-for="(seat, index) in seats" 
        :key="index" 
        class="dot"
        :class="{ filled: !seat.isEmpty, clickable: seat.isEmpty }"
        @click.stop="seat.isEmpty && handleSeatClick(index)"
      />
    </div>
    <span class="table-name">{{ table.name }}</span>
  </div>

  <!-- CURRENT TABLE VIEW (spacious, centered) -->
  <div v-else class="table-card current">
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
          'current-user': seat.isCurrentUser,
        }"
      >
        <span class="player-name">
          <template v-if="seat.player">
            {{ seat.isCurrentUser ? 'You' : seat.player.nickname }}
          </template>
          <template v-else>AI</template>
        </span>
        <span v-if="seat.isHost" class="host-badge">HOST</span>
        <span v-else-if="!seat.player" class="seat-label">Seat {{ index + 1 }}</span>
      </div>
    </div>

    <div v-if="isEuchre" class="partnership-hint">
      1 & 3 partners • 2 & 4 partners
    </div>
  </div>
</template>

<style scoped lang="scss">
// ============ LIST VIEW (compact row) ============
.table-row {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-sm $spacing-md;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
}

.host-name {
  font-size: 0.85rem;
  font-weight: 500;
  min-width: 80px;
}

.seat-dots {
  display: flex;
  gap: 4px;
  flex: 1;
}

.dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  border: 2px solid transparent;
  transition: all 0.15s ease;
  
  &.filled {
    background: $secondary-color;
  }

  &.clickable {
    cursor: pointer;
    border-color: rgba(255, 255, 255, 0.3);

    &:hover {
      background: rgba(255, 255, 255, 0.4);
      border-color: $secondary-color;
      transform: scale(1.2);
    }
  }
}

.table-row .table-name {
  font-size: 0.75rem;
  opacity: 0.5;
  text-align: right;
}

// ============ CURRENT TABLE VIEW ============
.table-card.current {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: $spacing-lg;
}

.table-header {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  margin-bottom: $spacing-md;
}

.game-type-badge {
  font-size: 0.7rem;
  padding: 4px 10px;
  border-radius: 4px;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.03em;

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

.table-card .table-name {
  flex: 1;
  font-size: 1rem;
  font-weight: 500;
}

.seat-count {
  font-size: 0.85rem;
  opacity: 0.6;
}

.seats-row {
  display: flex;
  gap: $spacing-sm;
  justify-content: center;
  flex-wrap: wrap;
}

.seat {
  min-width: 90px;
  padding: $spacing-sm $spacing-md;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 8px;
  border: 2px solid transparent;

  &.occupied {
    background: rgba(255, 255, 255, 0.1);
  }

  &.current-user {
    border-color: $secondary-color;
    background: rgba($secondary-color, 0.15);
  }
}

.player-name {
  font-weight: 600;
  font-size: 0.9rem;
}

.host-badge {
  font-size: 0.6rem;
  background: $secondary-color;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 700;
}

.seat-label {
  font-size: 0.7rem;
  opacity: 0.5;
}

.partnership-hint {
  margin-top: $spacing-md;
  font-size: 0.75rem;
  opacity: 0.5;
  text-align: center;
}
</style>
