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

const canSave = ref(true)
watch(editNickname, (name) => {
  canSave.value = name.trim().length >= 2
})

function selectAvatar(avatar: string | null) {
  editAvatar.value = avatar
}

function getAvatarUrl(avatar: string): string {
  return `/avatars/users/${avatar}.jpg`
}

function save() {
  if (!canSave.value) return
  lobbyStore.setNickname(editNickname.value)
  lobbyStore.setAvatar(editAvatar.value)
  emit('close')
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
          <div class="section">
            <h2>Nickname</h2>
            <input
              v-model="editNickname"
              type="text"
              placeholder="Enter nickname..."
              maxlength="20"
              class="nickname-input"
            />
            <p class="hint">Min 2 characters for multiplayer</p>
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
        
        <footer class="footer">
          <button class="save-btn" :disabled="!canSave" @click="save">Save</button>
        </footer>
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
  padding: $spacing-lg;
  display: flex;
  flex-direction: column;
  max-width: 700px;
  margin: 0 auto;
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
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $spacing-xl;
  align-content: start;
  
  // Stack on mobile portrait
  @media (max-width: 600px) and (orientation: portrait) {
    grid-template-columns: 1fr;
  }
}

.section {
  h2 {
    font-size: 0.9rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.7;
    margin-bottom: $spacing-sm;
  }
}

.nickname-input {
  width: 100%;
  padding: $spacing-sm $spacing-md;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  font-size: 1rem;
  
  &::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }
  
  &:focus {
    outline: none;
    border-color: $brand-green;
    background: rgba(255, 255, 255, 0.15);
  }
}

.hint {
  margin-top: $spacing-xs;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
}

.avatar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: $spacing-sm;
}

.avatar-option {
  width: 64px;
  height: 64px;
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
    border-color: $brand-green;
    box-shadow: 0 0 0 2px rgba($brand-green, 0.5);
  }
  
  &.no-avatar {
    background: rgba(255, 255, 255, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    
    .initial {
      font-size: 1.5rem;
      font-weight: bold;
      color: white;
    }
  }
}

.footer {
  flex-shrink: 0;
  padding-top: $spacing-lg;
}

.save-btn {
  width: 100%;
  padding: $spacing-sm $spacing-lg;
  background: $brand-green;
  border-radius: 8px;
  color: white;
  font-weight: 600;
  font-size: 1rem;
  
  &:hover:not(:disabled) {
    background: $brand-green-light;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
