import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { AIChatMode } from '@67cards/shared'

export type AIDifficulty = 'easy' | 'hard'
export type DealerPassRule = 'canPass' | 'stickTheDealer'
export type AppTheme = 'teal' | 'navy' | 'slate' | 'green' | 'purple'
export type RoomTheme = 'space' | 'games-room' | 'pub' | 'vegas'

interface GameSettings {
  aiDifficulty: AIDifficulty
  theme: AppTheme
  roomTheme: RoomTheme
  // AI personality
  aiChatMode: AIChatMode
  botChatEnabled: boolean
  // Euchre-specific
  dealerPassRule: DealerPassRule
  // President-specific
  presidentPlayerCount: number
  superTwosAndJokers: boolean
  // Spades-specific
  spadesWinningScore: number
  spadesBlindNil: boolean
}

const STORAGE_KEY = 'game-settings'

const VALID_THEMES: AppTheme[] = ['teal', 'navy', 'slate', 'green', 'purple']
const VALID_ROOM_THEMES: RoomTheme[] = ['space', 'games-room', 'pub', 'vegas']

function loadSettings(): GameSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        aiDifficulty: parsed.aiDifficulty === 'hard' ? 'hard' : 'easy',
        theme: VALID_THEMES.includes(parsed.theme) ? parsed.theme : 'teal',
        roomTheme: VALID_ROOM_THEMES.includes(parsed.roomTheme) ? parsed.roomTheme : 'pub',
        aiChatMode: 'unhinged' as AIChatMode,  // Always spicy for now
        botChatEnabled: parsed.botChatEnabled !== false, // default true
        dealerPassRule: parsed.dealerPassRule === 'stickTheDealer' ? 'stickTheDealer' : 'canPass',
        presidentPlayerCount: Math.min(Math.max(parsed.presidentPlayerCount || 4, 4), 8),
        superTwosAndJokers: parsed.superTwosAndJokers === true,
        spadesWinningScore: [250, 500, 750].includes(parsed.spadesWinningScore) ? parsed.spadesWinningScore : 500,
        spadesBlindNil: parsed.spadesBlindNil === true,
      }
    }
  } catch {
    // Ignore parse errors
  }
  return {
    aiDifficulty: 'easy',
    theme: 'teal',
    roomTheme: 'pub',
    aiChatMode: 'unhinged' as AIChatMode,  // Always spicy
    botChatEnabled: true,
    dealerPassRule: 'canPass',
    presidentPlayerCount: 4,
    superTwosAndJokers: false,
    spadesWinningScore: 500,
    spadesBlindNil: false,
  }
}

function applyTheme(themeName: AppTheme) {
  // Remove all theme classes
  document.body.classList.remove(...VALID_THEMES.map(t => `theme-${t}`))
  // Add new theme class (teal is default, no class needed)
  if (themeName !== 'teal') {
    document.body.classList.add(`theme-${themeName}`)
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const initialSettings = loadSettings()

  const aiDifficulty = ref<AIDifficulty>(initialSettings.aiDifficulty)
  const theme = ref<AppTheme>(initialSettings.theme)
  const roomTheme = ref<RoomTheme>(initialSettings.roomTheme)
  const aiChatMode = ref<AIChatMode>(initialSettings.aiChatMode)
  const botChatEnabled = ref<boolean>(initialSettings.botChatEnabled)
  const dealerPassRule = ref<DealerPassRule>(initialSettings.dealerPassRule)
  const presidentPlayerCount = ref<number>(initialSettings.presidentPlayerCount)
  const superTwosAndJokers = ref<boolean>(initialSettings.superTwosAndJokers)
  const spadesWinningScore = ref<number>(initialSettings.spadesWinningScore)
  const spadesBlindNil = ref<boolean>(initialSettings.spadesBlindNil)

  // Apply theme on load
  applyTheme(initialSettings.theme)

  // Persist settings when they change
  watch([aiDifficulty, theme, roomTheme, aiChatMode, botChatEnabled, dealerPassRule, presidentPlayerCount, superTwosAndJokers, spadesWinningScore, spadesBlindNil], () => {
    const settings: GameSettings = {
      aiDifficulty: aiDifficulty.value,
      theme: theme.value,
      roomTheme: roomTheme.value,
      aiChatMode: aiChatMode.value,
      botChatEnabled: botChatEnabled.value,
      dealerPassRule: dealerPassRule.value,
      presidentPlayerCount: presidentPlayerCount.value,
      superTwosAndJokers: superTwosAndJokers.value,
      spadesWinningScore: spadesWinningScore.value,
      spadesBlindNil: spadesBlindNil.value,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, { deep: true })

  function setAIDifficulty(difficulty: AIDifficulty) {
    aiDifficulty.value = difficulty
  }

  function setTheme(newTheme: AppTheme) {
    theme.value = newTheme
    applyTheme(newTheme)
  }

  function setRoomTheme(newRoomTheme: RoomTheme) {
    roomTheme.value = newRoomTheme
  }

  function setAIChatMode(mode: AIChatMode) {
    aiChatMode.value = mode
  }

  function setBotChatEnabled(enabled: boolean) {
    botChatEnabled.value = enabled
  }

  function setDealerPassRule(rule: DealerPassRule) {
    dealerPassRule.value = rule
  }

  function setPresidentPlayerCount(count: number) {
    presidentPlayerCount.value = Math.min(Math.max(count, 4), 8)
  }

  function setSuperTwosAndJokers(enabled: boolean) {
    superTwosAndJokers.value = enabled
  }

  function setSpadesWinningScore(score: number) {
    if ([250, 500, 750].includes(score)) {
      spadesWinningScore.value = score
    }
  }

  function setSpadesBlindNil(enabled: boolean) {
    spadesBlindNil.value = enabled
  }

  // Convenience getters
  const isHardAI = () => aiDifficulty.value === 'hard'
  const isStickTheDealer = () => dealerPassRule.value === 'stickTheDealer'
  const isSuperTwosAndJokers = () => superTwosAndJokers.value

  return {
    aiDifficulty,
    theme,
    roomTheme,
    aiChatMode,
    botChatEnabled,
    dealerPassRule,
    presidentPlayerCount,
    superTwosAndJokers,
    spadesWinningScore,
    spadesBlindNil,
    setAIDifficulty,
    setTheme,
    setRoomTheme,
    setAIChatMode,
    setBotChatEnabled,
    setDealerPassRule,
    setPresidentPlayerCount,
    setSuperTwosAndJokers,
    setSpadesWinningScore,
    setSpadesBlindNil,
    isHardAI,
    isStickTheDealer,
    isSuperTwosAndJokers,
  }
})
