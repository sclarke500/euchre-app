import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type AIDifficulty = 'easy' | 'hard'
export type DealerPassRule = 'canPass' | 'stickTheDealer'

interface GameSettings {
  aiDifficulty: AIDifficulty
  // Euchre-specific
  dealerPassRule: DealerPassRule
  // President-specific
  presidentPlayerCount: number
  superTwosAndJokers: boolean
}

const STORAGE_KEY = 'game-settings'

function loadSettings(): GameSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        aiDifficulty: parsed.aiDifficulty === 'hard' ? 'hard' : 'easy',
        dealerPassRule: parsed.dealerPassRule === 'stickTheDealer' ? 'stickTheDealer' : 'canPass',
        presidentPlayerCount: Math.min(Math.max(parsed.presidentPlayerCount || 4, 4), 8),
        superTwosAndJokers: parsed.superTwosAndJokers === true,
      }
    }
  } catch {
    // Ignore parse errors
  }
  return {
    aiDifficulty: 'easy',
    dealerPassRule: 'canPass',
    presidentPlayerCount: 4,
    superTwosAndJokers: false,
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const initialSettings = loadSettings()

  const aiDifficulty = ref<AIDifficulty>(initialSettings.aiDifficulty)
  const dealerPassRule = ref<DealerPassRule>(initialSettings.dealerPassRule)
  const presidentPlayerCount = ref<number>(initialSettings.presidentPlayerCount)
  const superTwosAndJokers = ref<boolean>(initialSettings.superTwosAndJokers)

  // Persist settings when they change
  watch([aiDifficulty, dealerPassRule, presidentPlayerCount, superTwosAndJokers], () => {
    const settings: GameSettings = {
      aiDifficulty: aiDifficulty.value,
      dealerPassRule: dealerPassRule.value,
      presidentPlayerCount: presidentPlayerCount.value,
      superTwosAndJokers: superTwosAndJokers.value,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, { deep: true })

  function setAIDifficulty(difficulty: AIDifficulty) {
    aiDifficulty.value = difficulty
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

  // Convenience getters
  const isHardAI = () => aiDifficulty.value === 'hard'
  const isStickTheDealer = () => dealerPassRule.value === 'stickTheDealer'
  const isSuperTwosAndJokers = () => superTwosAndJokers.value

  return {
    aiDifficulty,
    dealerPassRule,
    presidentPlayerCount,
    superTwosAndJokers,
    setAIDifficulty,
    setDealerPassRule,
    setPresidentPlayerCount,
    setSuperTwosAndJokers,
    isHardAI,
    isStickTheDealer,
    isSuperTwosAndJokers,
  }
})
