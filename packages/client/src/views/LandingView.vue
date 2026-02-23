<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ref, onMounted } from 'vue'
import { getPlatformInfo } from '@/utils/platform'
import AppLogo from '@/components/AppLogo.vue'

// Game screenshots
import screenshotEuchre from '@/assets/screenshots/euchre.png'
import screenshotSpades from '@/assets/screenshots/spades.png'
import screenshotPresident from '@/assets/screenshots/president.png'
import screenshotKlondike from '@/assets/screenshots/klondike.png'

const router = useRouter()

// Platform detection for install instructions
const platform = ref<'ios' | 'android' | 'desktop'>('desktop')
const isStandalone = ref(false)

onMounted(() => {
  const info = getPlatformInfo()
  isStandalone.value = info.isStandalone
  const isAndroid = /Android/i.test(navigator.userAgent)
  if (info.isIOS) {
    platform.value = 'ios'
  } else if (isAndroid) {
    platform.value = 'android'
  } else {
    platform.value = 'desktop'
  }
})

function goToApp() {
  router.push('/play')
}

const games = [
  {
    id: 'euchre',
    name: 'Euchre',
    description: 'The classic Midwest trick-taking game. Call trump, go alone, euchre your opponents.',
    players: '4 players',
    type: 'Trick-taking',
    screenshot: screenshotEuchre,
  },
  {
    id: 'spades',
    name: 'Spades',
    description: 'Bid your hand, make your tricks. A timeless partnership game.',
    players: '4 players',
    type: 'Trick-taking',
    screenshot: screenshotSpades,
  },
  {
    id: 'president',
    name: 'President',
    description: 'Race to shed your cards first. Climb from Scum to President.',
    players: '4-5 players',
    type: 'Shedding',
    screenshot: screenshotPresident,
  },
  {
    id: 'klondike',
    name: 'Klondike',
    description: 'The solitaire classic. Build foundation piles from Ace to King.',
    players: '1 player',
    type: 'Solitaire',
    screenshot: screenshotKlondike,
  },
]

const features = [
  {
    icon: '📱',
    title: 'Works Everywhere',
    description: 'Phone, tablet, or desktop. No download required — runs in your browser.',
  },
  {
    icon: '🎮',
    title: 'Single & Multiplayer',
    description: 'Practice against AI or play with friends online in real-time.',
  },
  {
    icon: '⚡',
    title: 'Install as App',
    description: 'Add to your home screen for a native app experience. Works offline too.',
  },
]
</script>

<template>
  <div class="landing">
    <!-- Hero Section -->
    <section class="hero">
      <div class="hero-content">
        <AppLogo size="lg" class="hero-logo" />
        <p class="hero-tagline">Classic card games, modern experience</p>
        <button class="cta-btn" @click="goToApp">
          Play Now
          <span class="cta-arrow">→</span>
        </button>
      </div>
      <!-- TODO: Hero background/banner image -->
    </section>

    <!-- Games Section -->
    <section class="games">
      <h2>The Games</h2>
      <div class="game-grid">
        <article v-for="game in games" :key="game.id" class="game-card">
          <div class="game-image">
            <img :src="game.screenshot" :alt="`${game.name} screenshot`" />
          </div>
          <div class="game-info">
            <h3>{{ game.name }}</h3>
            <p class="game-meta">{{ game.type }} · {{ game.players }}</p>
            <p class="game-desc">{{ game.description }}</p>
          </div>
        </article>
      </div>
    </section>

    <!-- Features Section -->
    <section class="features">
      <h2>Why 6|7 Card Games?</h2>
      <div class="feature-grid">
        <div v-for="feature in features" :key="feature.title" class="feature-card">
          <span class="feature-icon">{{ feature.icon }}</span>
          <h3>{{ feature.title }}</h3>
          <p>{{ feature.description }}</p>
        </div>
      </div>
    </section>

    <!-- Install Section -->
    <section class="install">
      <h2>Install the App</h2>
      <p class="install-intro">
        Add 6|7 Card Games to your home screen for the best experience.
        It's free, fast, and works offline.
      </p>

      <div class="install-tabs">
        <button 
          :class="['tab', { active: platform === 'ios' }]" 
          @click="platform = 'ios'"
        >
          iOS
        </button>
        <button 
          :class="['tab', { active: platform === 'android' }]" 
          @click="platform = 'android'"
        >
          Android
        </button>
        <button 
          :class="['tab', { active: platform === 'desktop' }]" 
          @click="platform = 'desktop'"
        >
          Desktop
        </button>
      </div>

      <div class="install-instructions">
        <div v-if="platform === 'ios'" class="instructions">
          <ol>
            <li>Open this site in <strong>Safari</strong></li>
            <li>Tap the <strong>Share</strong> button <span class="icon-hint">⬆️</span></li>
            <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
            <li>Tap <strong>"Add"</strong> in the top right</li>
          </ol>
          <p class="install-note">Note: Must use Safari — Chrome/Firefox on iOS can't install PWAs.</p>
        </div>

        <div v-if="platform === 'android'" class="instructions">
          <ol>
            <li>Open this site in <strong>Chrome</strong></li>
            <li>Tap the <strong>menu</strong> button <span class="icon-hint">⋮</span></li>
            <li>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong></li>
            <li>Follow the prompts to install</li>
          </ol>
          <p class="install-note">Works in Chrome, Edge, and most Android browsers.</p>
        </div>

        <div v-if="platform === 'desktop'" class="instructions">
          <ol>
            <li>Open this site in <strong>Chrome</strong> or <strong>Edge</strong></li>
            <li>Look for the <strong>install icon</strong> in the address bar <span class="icon-hint">⊕</span></li>
            <li>Click <strong>"Install"</strong></li>
          </ol>
          <p class="install-note">The app will open in its own window, just like a native application.</p>
        </div>
      </div>
    </section>

    <!-- Footer CTA -->
    <section class="footer-cta">
      <h2>Ready to play?</h2>
      <button class="cta-btn" @click="goToApp">
        Let's Go
        <span class="cta-arrow">→</span>
      </button>
    </section>

    <!-- Footer -->
    <footer class="footer">
      <p>© 2026 67CardGames.com</p>
      <!-- TODO: Links, socials, contact -->
    </footer>
  </div>
</template>

<style scoped lang="scss">
.landing {
  min-height: 100vh;
  color: white;
}

// Hero
.hero {
  position: relative;
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: $spacing-xl;
  padding-left: 8%;
  background: 
    // Gradient overlay - darker on left for text, lighter on right for image
    linear-gradient(to right, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.3) 50%, rgba(0, 0, 0, 0.2) 100%),
    // Hero image
    url('@/assets/hero-robots.jpg');
  background-size: cover;
  background-position: center;

  // Tablet portrait - use desktop image but cap height
  @media (min-width: 601px) and (orientation: portrait) {
    min-height: 50vh;
    max-height: 500px;
  }

  // Phone portrait only - uses tall mobile image
  // (max-width: 600px catches phones, iPads use desktop image)
  @media (max-width: 600px) and (orientation: portrait) {
    min-height: 85vh;
    justify-content: center;
    align-items: stretch;
    padding: $spacing-xl $spacing-lg;
    background: 
      // Gradient: dark at top and bottom for text, lighter in middle for characters
      linear-gradient(to bottom, 
        rgba(0, 0, 0, 0.75) 0%, 
        rgba(0, 0, 0, 0.3) 30%,
        rgba(0, 0, 0, 0.3) 70%,
        rgba(0, 0, 0, 0.75) 100%
      ),
      url('@/assets/hero-robots-mobile.jpg');
    background-size: cover;
    background-position: center;
  }

  // Mobile landscape - use height check (more reliable than orientation)
  @media (max-height: 450px) {
    min-height: auto;
    max-height: none;
    height: 100vh;
    justify-content: flex-start;
    align-items: flex-start;
    padding: $spacing-md $spacing-lg;
    background: 
      // Gradient: dark on left for text, transparent on right for image
      linear-gradient(to right, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.5) 40%, rgba(0, 0, 0, 0.15) 100%),
      url('@/assets/hero-robots.jpg');
    background-size: cover;
    background-position: right center;
  }
}

.hero-content {
  text-align: left;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: $spacing-lg;

  // Phone portrait - small logo top, characters middle, tagline+CTA bottom
  @media (max-width: 600px) and (orientation: portrait) {
    text-align: center;
    align-items: center;
    justify-content: space-between;
    height: 100%;
    min-height: 75vh;
    
    .hero-logo {
      margin-bottom: auto; // Push logo to top, leave gap
    }
    
    .hero-tagline {
      margin-top: auto; // Pull tagline to bottom with CTA
      margin-bottom: $spacing-md;
    }
  }

  // Mobile landscape - content left, CTA bottom right
  @media (max-height: 450px) {
    text-align: left;
    align-items: flex-start;
    justify-content: center;
    gap: $spacing-sm;
    max-width: 50%;
    height: 100%;
    padding: $spacing-sm 0;
  }
}

// AppLogo in hero - override default sizing
.hero-logo {
  margin: 0;
  
  :deep(.logo-img) {
    width: 280px;
    max-width: 80vw;
    filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.4));
  }
  
  :deep(.logo-url) {
    font-size: 1.6rem;
    text-shadow: 2px 2px 8px rgba(0, 0, 0, 0.5);
  }

  @media (max-height: 450px) {
    :deep(.logo-img) {
      width: 180px;
    }
    :deep(.logo-url) {
      font-size: 1.2rem;
    }
  }
  
  @media (max-width: 600px) and (orientation: portrait) {
    :deep(.logo-img) {
      width: 200px;
    }
    :deep(.logo-url) {
      font-size: 1.1rem;
    }
  }
}

.hero-tagline {
  font-size: 1.5rem;
  opacity: 0.9;
  max-width: 400px;

  @media (max-width: 600px) {
    font-size: 1.2rem;
  }

  @media (max-height: 450px) {
    font-size: 1.1rem;
    margin: $spacing-sm 0;
  }
}

.cta-btn {
  display: inline-flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-md $spacing-xl;
  font-size: 1.25rem;
  font-weight: bold;
  background: white;
  color: $brand-green;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  // Mobile landscape - position at bottom right of hero
  .hero & {
    @media (max-height: 450px) {
      position: absolute;
      bottom: $spacing-lg;
      right: $spacing-lg;
      padding: $spacing-sm $spacing-lg;
      font-size: 1rem;
    }
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 28px rgba(0, 0, 0, 0.3);
  }

  &:active {
    transform: scale(0.98);
  }

  .cta-arrow {
    font-size: 1.5rem;
    transition: transform 0.15s ease;
  }

  &:hover .cta-arrow {
    transform: translateX(4px);
  }
}

// Section styling
section {
  padding: $spacing-xl * 2 $spacing-xl;
  
  @media (max-width: 600px) {
    padding: $spacing-xl $spacing-md;
  }

  h2 {
    font-family: 'Rock Salt', cursive;
    font-size: 2.5rem;
    text-align: center;
    margin-bottom: $spacing-xl;

    @media (max-width: 600px) {
      font-size: 1.75rem;
    }
  }
}

// Games
.games {
  background: rgba(0, 0, 0, 0.2);
}

.game-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: $spacing-lg;
  max-width: 1200px;
  margin: 0 auto;
}

.game-card {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }
}

.game-image {
  aspect-ratio: 16 / 7; // ~2.28:1, close to screenshot ratio of ~2.23:1
  overflow: hidden;
  background: linear-gradient(135deg, rgba($brand-green, 0.3), rgba($brand-green-dark, 0.5));
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    transition: transform 0.3s ease;
  }
  
  .game-card:hover & img {
    transform: scale(1.05);
  }
}

.game-info {
  padding: $spacing-lg;

  h3 {
    font-size: 1.5rem;
    margin-bottom: $spacing-xs;
  }

  .game-meta {
    font-size: 0.85rem;
    opacity: 0.7;
    margin-bottom: $spacing-sm;
  }

  .game-desc {
    font-size: 0.95rem;
    line-height: 1.5;
    opacity: 0.9;
  }
}

// Features
.features {
  background: rgba(0, 0, 0, 0.1);
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: $spacing-lg;
  max-width: 1000px;
  margin: 0 auto;
}

.feature-card {
  text-align: center;
  padding: $spacing-lg;

  .feature-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: $spacing-md;
  }

  h3 {
    font-size: 1.25rem;
    margin-bottom: $spacing-sm;
  }

  p {
    font-size: 0.95rem;
    opacity: 0.85;
    line-height: 1.5;
  }
}

// Install
.install {
  background: rgba(0, 0, 0, 0.2);
  max-width: 800px;
  margin: 0 auto;
  border-radius: 24px;

  @media (max-width: 850px) {
    margin: 0 $spacing-md;
    border-radius: 16px;
  }
}

.install-intro {
  text-align: center;
  font-size: 1.1rem;
  opacity: 0.9;
  max-width: 500px;
  margin: 0 auto $spacing-xl;
}

.install-tabs {
  display: flex;
  justify-content: center;
  gap: $spacing-sm;
  margin-bottom: $spacing-lg;
}

.tab {
  padding: $spacing-sm $spacing-lg;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 1rem;
  color: white;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  &.active {
    background: white;
    color: $brand-green;
    font-weight: bold;
  }
}

.install-instructions {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  padding: $spacing-lg;
}

.instructions {
  ol {
    list-style: none;
    counter-reset: step;
    padding: 0;
    margin: 0;

    li {
      counter-increment: step;
      display: flex;
      align-items: flex-start;
      gap: $spacing-md;
      margin-bottom: $spacing-md;
      font-size: 1.1rem;

      &::before {
        content: counter(step);
        flex-shrink: 0;
        width: 28px;
        height: 28px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 0.9rem;
      }
    }
  }

  .icon-hint {
    opacity: 0.7;
  }

  .install-note {
    margin-top: $spacing-lg;
    padding-top: $spacing-md;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 0.9rem;
    opacity: 0.7;
    font-style: italic;
  }
}

// Footer CTA
.footer-cta {
  text-align: center;
  padding: $spacing-xl * 3 $spacing-xl;
  background: 
    radial-gradient(circle at 50% 50%, rgba(255, 220, 150, 0.08) 0%, transparent 50%);
}

// Footer
.footer {
  text-align: center;
  padding: $spacing-xl;
  background: rgba(0, 0, 0, 0.3);
  font-size: 0.9rem;
  opacity: 0.7;
}
</style>
