<script setup lang="ts">
import { ref, watch } from 'vue'
import { useLobbyStore, USER_AVATARS } from '@/stores/lobbyStore'
import Modal from './Modal.vue'

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
  <Modal :show="show" aria-label="Edit Profile" @close="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Edit Profile</h2>
        <button class="close-btn" @click="$emit('close')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <!-- Nickname input -->
        <div class="form-group">
          <label for="profile-nickname">Nickname</label>
          <input
            id="profile-nickname"
            v-model="editNickname"
            type="text"
            placeholder="Enter nickname..."
            maxlength="20"
            class="nickname-input"
          />
          <p class="hint">Min 2 characters for multiplayer</p>
        </div>
        
        <!-- Avatar selection -->
        <div class="form-group">
          <label>Avatar</label>
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
      
      <div class="modal-footer">
        <button class="cancel-btn" @click="$emit('close')">Cancel</button>
        <button class="save-btn" :disabled="!canSave" @click="save">Save</button>
      </div>
    </div>
  </Modal>
</template>

<style scoped lang="scss">
@use '@/assets/styles/modal-light' as *;

.modal-content {
  @include modal-panel;
  max-width: 420px;
  width: 100%;
  max-height: 85vh;
  overflow-y: auto;
  text-align: left;
}

.modal-header {
  @include modal-header;
  background: var(--color-primary-subtle);
  border-bottom: 1px solid var(--color-primary);

  h2 {
    @include modal-title;
    margin: 0;
    color: var(--color-primary);
  }
}

.close-btn {
  @include modal-close-btn;
}

.modal-body {
  padding: $spacing-md $spacing-lg;
}

.form-group {
  margin-bottom: 1.25rem;
  
  label {
    @include modal-label;
  }
  
  .hint {
    @include modal-help-text;
  }
}

.nickname-input {
  @include modal-input;
}

.avatar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
  gap: 8px;
  max-height: 280px;
  overflow-y: auto;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  padding: 4px;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: var(--color-surface-subtle);
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: var(--color-border-strong);
    border-radius: 3px;
    
    &:hover {
      background: var(--color-text-muted);
    }
  }
}

.avatar-option {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 3px solid transparent;
  padding: 0;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.15s ease;
  background: var(--color-surface-subtle);
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  &:hover {
    border-color: var(--color-border-strong);
    transform: scale(1.05);
  }
  
  &.selected {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-focus-ring);
  }
  
  &.no-avatar {
    background: linear-gradient(145deg, #4a4a5c, #3a3a4c);
    display: flex;
    align-items: center;
    justify-content: center;
    
    .initial {
      font-size: 1.25rem;
      font-weight: bold;
      color: #ddd;
    }
  }
}

.modal-footer {
  @include modal-footer;
}

.cancel-btn {
  @include modal-btn-secondary;
}

.save-btn {
  @include modal-btn-primary;
}
</style>
