<template>
  <!--
    Suit pips as inline SVG rather than text glyphs (♥♦♣♠). Those characters
    aren't in Roboto or the other fonts in our reset stack, so each OS falls
    back to its own symbol font — Android's Noto glyphs fill far more of the
    em box than Apple's, making pips render visibly larger on Android devices
    than in desktop Chrome / iOS. SVG paths render identically everywhere.
  -->
  <svg class="suit-glyph" viewBox="0 0 100 100" aria-hidden="true">
    <path
      v-if="suit === 'hearts'"
      d="M50 91 C20 65 4 45 4 27 C4 12 15 3 28 3 C38 3 46 9 50 18 C54 9 62 3 72 3 C85 3 96 12 96 27 C96 45 80 65 50 91 Z"
    />
    <path
      v-else-if="suit === 'diamonds'"
      d="M50 2 L85 50 L50 98 L15 50 Z"
    />
    <path
      v-else-if="suit === 'spades'"
      d="M50 2 C61 21 92 40 92 60 C92 74 82 82 71 82 C63 82 57 78 54 73 C54 84 57 91 63 97 L37 97 C43 91 46 84 46 73 C43 78 37 82 29 82 C18 82 8 74 8 60 C8 40 39 21 50 2 Z"
    />
    <g v-else-if="suit === 'clubs'">
      <circle cx="50" cy="27" r="22" />
      <circle cx="26" cy="61" r="22" />
      <circle cx="74" cy="61" r="22" />
      <path d="M50 55 C52 75 56 88 64 97 L36 97 C44 88 48 75 50 55 Z" />
    </g>
  </svg>
</template>

<script setup lang="ts">
defineProps<{
  suit: string
}>()
</script>

<style scoped>
.suit-glyph {
  display: block;
  fill: currentColor;
  /* Size is set by the parent via width/height */
}
</style>
