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
    <div class="modal-light profile-modal">
      <div class="modal-header">
        <h3>Edit Profile</h3>
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
        <button class="btn-secondary" @click="$emit('close')">Cancel</button>
        <button class="btn-primary" :disabled="!canSave" @click="save">Save</button>
      </div>
    </div>
  </Modal>
</template>

<style scoped lang="scss">
.profile-modal {
  width: 400px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-body {
  overflow-y: auto;
}

.form-group {
  margin-bottom: 1.25rem;
  
  label {
    display: block;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #374151;
  }
  
  .hint {
    font-size: 0.75rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }
}

.nickname-input {
  width: 100%;
  padding: 0.625rem 0.875rem;
  font-size: 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  color: #1f2937;
  transition: border-color 0.15s ease;
  
  &:focus {
    outline: none;
    border-color: var(--color-primary, #0d7377);
  }
}

.avatar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
  gap: 8px;
  max-height: 280px;
  overflow-y: auto;
  padding: 4px;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 3px;
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
  background: #e5e7eb;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  &:hover {
    border-color: #9ca3af;
    transform: scale(1.05);
  }
  
  &.selected {
    border-color: var(--color-primary, #0d7377);
    box-shadow: 0 0 0 2px rgba(13, 115, 119, 0.3);
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
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
</style>
