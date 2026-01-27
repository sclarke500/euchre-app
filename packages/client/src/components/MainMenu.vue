<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLobbyStore } from '@/stores/lobbyStore'

const emit = defineEmits<{
  startSinglePlayer: []
  enterMultiplayer: []
}>()

const lobbyStore = useLobbyStore()

const nicknameInput = ref(lobbyStore.nickname)
const isEditingNickname = ref(!lobbyStore.hasNickname)

const canEnterMultiplayer = computed(() => {
  return nicknameInput.value.trim().length >= 2
})

function saveNickname() {
  if (canEnterMultiplayer.value) {
    lobbyStore.setNickname(nicknameInput.value)
    isEditingNickname.value = false
  }
}

function editNickname() {
  isEditingNickname.value = true
}

function handleMultiplayer() {
  if (!canEnterMultiplayer.value) {
    isEditingNickname.value = true
    return
  }
  saveNickname()
  emit('enterMultiplayer')
}
</script>

<template>
  <div class="main-menu">
    <div class="logo-section">
      <img src="@/assets/ChatGPTLogoSquare.png" alt="Euchre Logo" class="logo" />
      <span class="stamp-text">67CardGames.com</span>
    </div>

    <div class="content-section">
      <h1>Euchre</h1>

      <div class="menu-options">
        <button class="menu-btn single-player" @click="$emit('startSinglePlayer')">
          Single Player
          <span class="btn-subtitle">Play against 3 <span class="clanker">clankers</span></span>
        </button>

        <button
          class="menu-btn multiplayer"
          :disabled="!canEnterMultiplayer && !isEditingNickname"
          @click="handleMultiplayer"
        >
          Multiplayer
          <span class="btn-subtitle">Play with friends online</span>
        </button>
      </div>

      <div class="nickname-section">
        <template v-if="isEditingNickname">
          <label for="nickname">Your Nickname</label>
          <div class="nickname-input-row">
            <input
              id="nickname"
              v-model="nicknameInput"
              type="text"
              placeholder="Enter nickname..."
              maxlength="20"
              @keyup.enter="saveNickname"
            />
            <button
              class="save-btn"
              :disabled="!canEnterMultiplayer"
              @click="saveNickname"
            >
              Save
            </button>
          </div>
          <p class="nickname-hint">Required for multiplayer (min 2 characters)</p>
        </template>
        <template v-else>
          <div class="nickname-display">
            <span class="nickname-label">Playing as:</span>
            <span class="nickname-value">{{ lobbyStore.nickname }}</span>
            <button class="edit-btn" @click="editNickname">Edit</button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.main-menu {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  background: linear-gradient(135deg, #1e4d2b 0%, #0d2818 100%);
  color: white;

  @media (max-width: 768px) {
    flex-direction: column;
  }
}

.logo-section {
  flex: 0 0 40%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: $spacing-xl;
  background: rgba(0, 0, 0, 0.1);
  gap: $spacing-lg;

  @media (max-width: 768px) {
    flex: 0 0 auto;
    padding: $spacing-lg;
    gap: $spacing-md;
  }

  .logo {
    width: 80%;
    height: 60vh;
    object-fit: cover;
    object-position: center;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));

    @media (max-width: 768px) {
      width: 100%;
      height: 40vh;
    }
  }

  .stamp-text {
    font-family: 'Courier Prime', monospace;
    font-size: 1.1rem;
    font-weight: bold;
    color: rgba(255, 255, 255, 0.9);
    letter-spacing: 1px;
    padding: $spacing-xs $spacing-sm;
    border: 2px solid rgba(255, 255, 255, 0.8);
    border-radius: 3px;
    transform: rotate(-3deg);
    text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.3);
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.3),
      2px 2px 4px rgba(0, 0, 0, 0.2);
    margin-top: calc(-#{$spacing-xl} - 15px);

    @media (max-width: 768px) {
      font-size: 0.85rem;
      padding: 2px $spacing-xs;
      margin-top: calc(-#{$spacing-lg} - 15px);
    }
  }
}

.content-section {
  flex: 0 0 60%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: $spacing-lg;

  @media (max-width: 768px) {
    flex: 1;
  }

  h1 {
    font-family: 'Rock Salt', cursive;
    font-size: 4rem;
    font-weight: 400;
    margin-bottom: $spacing-xl * 2;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);

    @media (max-width: 768px), (max-height: 500px) {
      font-size: 2.5rem;
      margin-bottom: $spacing-lg;
    }
  }
}

.menu-options {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
  margin-bottom: $spacing-xl * 2;

  @media (max-height: 500px) {
    flex-direction: row;
    margin-bottom: $spacing-lg;
  }
}

.menu-btn {
  padding: $spacing-lg $spacing-xl * 2;
  font-size: 1.5rem;
  font-weight: bold;
  background: white;
  color: #1e4d2b;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 280px;

  @media (max-height: 500px) {
    padding: $spacing-md $spacing-xl;
    font-size: 1.25rem;
    min-width: 200px;
  }

  &:hover:not(:disabled) {
    transform: scale(1.05);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-subtitle {
    font-size: 0.875rem;
    font-weight: normal;
    opacity: 0.7;
    margin-top: $spacing-xs;

    .clanker {
      font-family: 'Audiowide', cursive;
      font-weight: 400;
      letter-spacing: 0.05em;
    }
  }
}

.nickname-section {
  background: rgba(0, 0, 0, 0.2);
  padding: $spacing-lg;
  border-radius: 12px;
  min-width: 320px;

  @media (max-height: 500px) {
    padding: $spacing-md;
    min-width: 280px;
  }

  label {
    display: block;
    font-size: 0.875rem;
    margin-bottom: $spacing-sm;
    opacity: 0.9;
  }
}

.nickname-input-row {
  display: flex;
  gap: $spacing-sm;

  input {
    flex: 1;
    padding: $spacing-sm $spacing-md;
    font-size: 1rem;
    border: 2px solid transparent;
    border-radius: 8px;
    background: white;
    color: #333;

    &:focus {
      outline: none;
      border-color: $secondary-color;
    }
  }

  .save-btn {
    padding: $spacing-sm $spacing-md;
    background: $secondary-color;
    color: white;
    font-weight: bold;
    border-radius: 8px;
    transition: background 0.2s;

    &:hover:not(:disabled) {
      background: lighten($secondary-color, 10%);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

.nickname-hint {
  font-size: 0.75rem;
  opacity: 0.7;
  margin-top: $spacing-sm;
}

.nickname-display {
  display: flex;
  align-items: center;
  gap: $spacing-sm;

  .nickname-label {
    font-size: 0.875rem;
    opacity: 0.8;
  }

  .nickname-value {
    font-weight: bold;
    font-size: 1.125rem;
  }

  .edit-btn {
    margin-left: auto;
    padding: $spacing-xs $spacing-sm;
    font-size: 0.75rem;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border-radius: 4px;
    transition: background 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.3);
    }
  }
}
</style>
