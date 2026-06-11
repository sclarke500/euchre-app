<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function goBack() {
  router.push('/')
}
</script>

<template>
  <div class="privacy">
    <div class="privacy-content">
      <button class="back-link" @click="goBack">← Back</button>

      <h1>Privacy Policy</h1>
      <p class="updated">Last updated: 11 June 2026</p>

      <p>
        67 Card Games ("the app", "we", "us") is a collection of classic card games —
        Euchre, Spades, President, and Klondike. We've built it to need as little of your
        information as possible. This policy explains what we collect, why, and what we
        don't.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Nickname and avatar.</strong> When you play, you choose a display name
          and avatar. These are stored on your device and, during multiplayer games, sent
          to our server so other players at your table can see who's playing. They aren't
          tied to your real identity.
        </li>
        <li>
          <strong>Gameplay data.</strong> During multiplayer games, game state (cards
          played, scores, chat messages) is sent through our server to keep all players in
          sync. This is transient — it exists only while the game is running.
        </li>
        <li>
          <strong>Preferences.</strong> Settings such as difficulty and game options are
          stored locally in your browser/device, not on our servers.
        </li>
        <li>
          <strong>Bug reports.</strong> If you choose to send a bug report, it includes the
          current game state, basic device info (browser/OS and screen size), and whatever
          description you write. This is sent only when you tap "Send" and is used solely to
          diagnose the issue.
        </li>
      </ul>

      <h2>What we don't collect</h2>
      <ul>
        <li>No account, login, email, password, or real name.</li>
        <li>No payment information.</li>
        <li>No advertising or ad tracking.</li>
        <li>No third-party analytics or tracking tools.</li>
        <li>No location, contacts, photos, or microphone/camera access.</li>
      </ul>

      <h2>Third parties</h2>
      <ul>
        <li>
          <strong>Game server.</strong> Multiplayer traffic is relayed through our hosted
          server over an encrypted (TLS/WSS) connection.
        </li>
        <li>
          <strong>Bug reports.</strong> Reports you submit are delivered to the developer
          through a messaging/issue service for review.
        </li>
        <li>
          <strong>Google Fonts.</strong> The app loads fonts from Google's font service,
          which may receive your device's IP address as part of that request.
        </li>
      </ul>

      <h2>Data retention</h2>
      <p>
        Information stored on your device (nickname, avatar, settings) stays there until you
        clear it or uninstall the app. Multiplayer game state is held only for the duration
        of a game and is not stored long-term.
      </p>

      <h2>Children's privacy</h2>
      <p>
        The app is intended for a general audience and is not directed at children under 13.
        We do not knowingly collect personal information from children.
      </p>

      <h2>Security</h2>
      <p>
        All data exchanged with our server is sent over encrypted connections (HTTPS/WSS).
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this policy from time to time. Changes will be posted on this page with
        an updated date above.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy? Email
        <a href="mailto:privacy@67cardgames.com">privacy@67cardgames.com</a>.
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.privacy {
  min-height: 100vh;
  min-height: 100dvh;
  background: #181820;
  color: #e8e8ec;
  padding: $spacing-xl;
  overflow-y: auto;
}

.privacy-content {
  max-width: 720px;
  margin: 0 auto;
  line-height: 1.6;
}

.back-link {
  background: none;
  border: none;
  color: #9aa0b5;
  font-size: 0.95rem;
  cursor: pointer;
  padding: 0;
  margin-bottom: $spacing-lg;

  &:hover {
    color: #fff;
  }
}

h1 {
  font-size: 1.8rem;
  margin: 0 0 0.25rem;
}

.updated {
  color: #9aa0b5;
  font-size: 0.85rem;
  margin: 0 0 2rem;
}

h2 {
  font-size: 1.15rem;
  margin: 2rem 0 0.5rem;
  color: #fff;
}

ul {
  padding-left: 1.25rem;
}

li {
  margin-bottom: 0.6rem;
}

a {
  color: #6db1ff;
}

strong {
  color: #fff;
}
</style>
