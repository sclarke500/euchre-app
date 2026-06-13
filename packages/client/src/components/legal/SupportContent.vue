<script setup lang="ts">
// Support article body. Rendered both as a full page (SupportView route) and
// inside the in-app LegalModal popup. Contains no page chrome / back button.
import { useLegalModal } from '@/composables/useLegalModal'

const { openLegal } = useLegalModal()
</script>

<template>
  <div class="legal-article">
    <h1>Support</h1>
    <p class="intro">
      Need a hand? Here's how to get help with 67 Card Games.
    </p>

    <h2>Contact us</h2>
    <p>
      Email <a href="mailto:support@67cardgames.com">support@67cardgames.com</a> and
      we'll get back to you. Including your device (e.g. iPhone model) and what happened
      helps us sort things out faster.
    </p>

    <h2>Report a bug</h2>
    <p>
      The quickest way to report a problem is right inside the app: open the
      <strong>menu</strong> (the ⋮ button) and tap <strong>Report Bug</strong>. That
      sends us the details we need to track it down. You can also email us at the address
      above.
    </p>

    <h2>Frequently asked</h2>
    <ul>
      <li>
        <strong>Do I need an account?</strong> No. There's no sign-up or login — just pick
        a nickname and play.
      </li>
      <li>
        <strong>How does multiplayer work?</strong> Start a table and share it with
        friends, or join an existing one. Everyone plays in real time. If a player drops
        out, the game waits for them to reconnect or you can replace them with AI.
      </li>
      <li>
        <strong>Can I play offline?</strong> Yes — singleplayer games against the AI work
        without a connection. Online multiplayer needs internet.
      </li>
      <li>
        <strong>How do I change difficulty, themes, or game options?</strong> Open
        <strong>Settings</strong> to adjust AI difficulty, table themes, and per-game
        rules.
      </li>
    </ul>

    <h2>Privacy</h2>
    <p>
      See our <a href="#" @click.prevent="openLegal('privacy')">Privacy Policy</a> for what
      data the app uses and doesn't.
    </p>
  </div>
</template>

<style scoped lang="scss">
.legal-article {
  line-height: 1.6;
}

h1 {
  font-size: 1.8rem;
  margin: 0 0 0.25rem;
}

.intro {
  color: #c7ccdb;
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
