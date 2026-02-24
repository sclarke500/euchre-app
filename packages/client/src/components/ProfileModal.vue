<script setup lang="ts">
import { ref, watch } from 'vue'
import { useLobbyStore, USER_AVATARS } from '@/stores/lobbyStore'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const lobbyStore = useLobbyStore()

// Local state for editing
const editNickname = ref(lobbyStore.nickname)
const editAvatar = ref<string | null>(lobbyStore.avatar)

// Reset local state when modal opens
watch(() => props.show, (isOpen) => {
  if (isOpen) {
    editNickname.value = lobbyStore.nickname
    editAvatar.value = lobbyStore.avatar
  }
})

// Auto-save nickname on change (debounced via blur or after typing stops)
function saveNickname() {
  const trimmed = editNickname.value.trim()
  if (trimmed.length >= 2) {
    lobbyStore.setNickname(trimmed)
  }
}

// Auto-save avatar immediately on selection
function selectAvatar(avatar: string | null) {
  editAvatar.value = avatar
  lobbyStore.setAvatar(avatar)
}

function getAvatarUrl(avatar: string): string {
  return `/avatars/users/${avatar}.jpg`
}

// Get display name for avatar
function getAvatarName(avatar: string): string {
  return avatar.charAt(0).toUpperCase() + avatar.slice(1).replace('-', ' ')
}
</script>

<template>
  <Transition name="slide">
    <div v-if="show" class="profile-overlay">
      <div class="profile-content">
        <header class="header">
          <h1>Profile</h1>
          <button class="close-btn" @click="emit('close')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div class="body">
          <!-- Nickname input -->
          <div class="section nickname-section">
            <div class="nickname-row">
              <div class="nickname-label-group">
                <span class="nickname-label">Nickname</span>
                <span class="hint">Min 2 characters</span>
              </div>
              <input
                v-model="editNickname"
                type="text"
                placeholder="Enter nickname..."
                maxlength="20"
                class="nickname-input"
                @blur="saveNickname"
                @keyup.enter="saveNickname"
              />
            </div>
          </div>
          
          <!-- Avatar selection -->
          <div class="section">
            <h2>Avatar</h2>
            <div class="avatar-grid">
              <!-- No avatar option -->
              <button
                :class="['avatar-option', 'no-avatar', { selected: editAvatar === null }]"
                @click="selectAvatar(null)"
                title="Use letter initial"
              >
                <span class="initial">{{ editNickname?.[0]?.toUpperCase() || '?' }}</span>
              </button>
              
              <!-- Avatar options -->
              <button
                v-for="avatar in USER_AVATARS"
                :key="avatar"
                :class="['avatar-option', { selected: editAvatar === avatar }]"
                @click="selectAvatar(avatar)"
                :title="getAvatarName(avatar)"
              >
                <img :src="getAvatarUrl(avatar)" :alt="getAvatarName(avatar)" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.profile-overlay {
  position: absolute;
  inset: 0;
  z-index: 100;
  background: linear-gradient(135deg, $home-gradient-top 0%, $home-gradient-bottom 100%);
  color: white;
  overflow-y: auto;
}

.profile-content {
  width: 100%;
  height: 100%;
  padding: $spacing-xl;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $spacing-xl;
  flex-shrink: 0;

  h1 {
    font-size: 1.25rem;
    font-weight: 600;
  }
}

.close-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  color: white;

  svg {
    width: 24px;
    height: 24px;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
}

.body {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: $spacing-xl;
}

.section {
  h2 {
    font-size: 0.9rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.7;
    margin-bottom: $spacing-md;
  }
}

.nickname-row {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  
  // Inline on widescreen
  @media (min-width: 601px), (orientation: landscape) {
    flex-direction: row;
    align-items: flex-start;
    gap: $spacing-lg;
  }
}

.nickname-label-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
  
  @media (min-width: 601px), (orientation: landscape) {
    min-width: 120px;
    padding-top: $spacing-sm; // Align with input text
  }
}

.nickname-label {
  font-size: 0.9rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.7;
}

.hint {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
}

.nickname-input {
  padding: $spacing-md;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  font-size: 1rem;
  width: 100%;
  max-width: 280px;
  
  &::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }
  
  &:focus {
    outline: none;
    border-color: $brand-green;
    background: rgba(255, 255, 255, 0.15);
  }
}

.avatar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: $spacing-md;
}

.avatar-option {
  aspect-ratio: 1;
  border-radius: 50%;
  border: 3px solid transparent;
  padding: 0;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.15s ease;
  background: rgba(255, 255, 255, 0.1);
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  &:hover {
    border-color: rgba(255, 255, 255, 0.4);
    transform: scale(1.05);
  }
  
  &.selected {
    border-color: #ffd700;
    box-shadow:
      0 0 5px 1px rgba(255, 215, 0, 0.35),
      0 0 12px 2px rgba(255, 215, 0, 0.25),
      0 0 24px 5px rgba(255, 215, 0, 0.12);
    animation: avatar-select-pulse 1.5s ease-in-out infinite;
  }
  
  &.no-avatar {
    background: rgba(255, 255, 255, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    
    .initial {
      font-size: 1.75rem;
      font-weight: bold;
      color: white;
    }
  }
}

@keyframes avatar-select-pulse {
  0%, 100% {
    box-shadow:
      0 0 5px 1px rgba(255, 215, 0, 0.35),
      0 0 12px 2px rgba(255, 215, 0, 0.25),
      0 0 24px 5px rgba(255, 215, 0, 0.12);
  }
  50% {
    box-shadow:
      0 0 7px 2px rgba(255, 215, 0, 0.5),
      0 0 17px 5px rgba(255, 215, 0, 0.3),
      0 0 30px 7px rgba(255, 215, 0, 0.18);
  }
}

// Slide transition (from right, like Settings)
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
