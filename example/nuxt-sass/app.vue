<template>
  <div>
     <div :class="$styles.bar" />
     <NuxtWelcome />
  </div>
</template>

<script setup>
import styles from './app.module.scss'
console.log('styles :>> ', styles)
</script>

<style module lang="scss">
.bar {
  background-color: #dcfbec;
  height: 50px;
}
</style>