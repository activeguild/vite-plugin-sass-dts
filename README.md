<h1 align="center">Welcome 😀</h1>

<p align="left">
  <a href="https://github.com/actions/setup-node"><img alt="GitHub Actions status" src="https://github.com/activeguild/classnames-generics/workflows/automatic%20release/badge.svg" style="max-width:100%;"></a>
</p>

# vite-plugin-sass-dts
 This is a plugin that automatically creates a type file when using the css module type-safely.

## install
```bash
npm i -D vite-plugin-sass-dts
```

## Options

| Parameter | Type             | Description                                                                     |
| --------- | ---------------- | ------------------------------------------------------------------------------- |
| allGenerate | boolean | Create all d.ts files of the css, sass, scss files included in the project at build time.<br />We recommend that you turn off the flag once you have created the d.ts file, as it will take a long time to build.                            |

## Add it to vite.config.ts
```ts
import { defineConfig } from "vite";
import sassDts from "vite-plugin-sass-dts";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [sassDts()],
});

```

## Usage
You can create a dts file by saving the scss file during development.

```bash
npm run dev
```

For example, when you save the following file...

```scss:App.scss
.App {
  text-align: center;
}

p.App-logo {
  height: 40vmin;
  pointer-events: none;
}

@media (prefers-reduced-motion: no-preference) {
  .App-logo {
    animation: App-logo-spin infinite 20s linear;
  }
}

.App-header {
  background-color: #282c34;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  
  font-size: calc(10px + 2vmin);
  color: white;
}

.App-link{
  color: #61dafb;
}

@keyframes App-logo-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
```

Saving the scss file creates a d.ts file in the same hierarchy.

```ts:App.scss.d.ts
export const app = 'App'
export const appLogo = 'App-logo'
export const appHeader = 'App-header'
export const appLink = 'App-link'

export type ClassNames = 'App' | 'App-logo' | 'App-header' | 'App-link'
```