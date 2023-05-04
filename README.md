<h1 align="center">vite-plugin-sass-dts ⚡ Welcome 😀</h1>

<p align="left">
  <a href="https://github.com/actions/setup-node"><img alt="GitHub Actions status" src="https://github.com/activeguild/vite-plugin-sass-dts/workflows/automatic%20release/badge.svg" style="max-width:100%;"></a>
</p>

# vite-plugin-sass-dts

A plugin that automatically creates a type file when using the CSS module type-safely.

## Demo

<img src="https://user-images.githubusercontent.com/39351982/138745772-8b218863-fe28-4573-a86a-fc10a7ab1ac7.gif" width="600" />

## Install

```bash
npm i -D vite-plugin-sass-dts
```

## Options

| Parameter            | Type                                   | Description                                                                                                                                                                                                                                                                                                                                                           |
| -------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| enabledMode          | string[]                               | Create d.ts files for css modules of file extension css, sass, scss included in the project at build time.<br /><br>Valid enumerations 'development' and 'production'. By default it is enabled only for development.<br>We recommend that you turn off the flag once you have created the d.ts file, as it will take a long time to build. (default [`development`]) |
| global.generate      | boolean                                | Outputs the common style set in <b>additionalData</b> of <b>preprocessorOptions</b> as a global type definition file.                                                                                                                                                                                                                                                 |
| global.outFile       | string                                 | Specify the file that outputs the global common style with an absolute path.Relative paths will be supported.                                                                                                                                                                                                                                                         |
| typeName.replacement | string \| (fileName: string) => string | Type name can be changed to any value. (default is the classname key as a string. e.g. `theClassName: 'theClassName';`)                                                                                                                                                                                                                                               |
| outDir               | string                                 | An absolute path to the output directory. If undefined, declaration files will be generated in the source directories. `)                                                                                                                                                                                                                                             |
| sourceDir            | string                                 | An absolute path to your source code directory. The plugin will replace this path with `outDir` option when writing declaration files. `)                                                                                                                                                                                                                             |

## Add it to vite.config.ts

```ts
import { defineConfig } from 'vite'
import sassDts from 'vite-plugin-sass-dts'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [sassDts()],
})
```

## Usage

You can create a dts file by saving the scss file during development.
You can check the usage [example](https://github.com/activeguild/vite-plugin-sass-dts/tree/master/example) when the following options are set.
Prepare the vite.config.ts file with the following options and start it in development mode.

[vite.config.ts]

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import sassDts from 'vite-plugin-sass-dts'
import path from 'path'

export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/styles" as common;`,
        importer(...args) {
          if (args[0] !== '@/styles') {
            return
          }

          return {
            file: `${path.resolve(__dirname, './src/assets/styles')}`,
          }
        },
      },
    },
  },
  plugins: [
    react(),
    sassDts({
      enabledMode: ['development', 'production'],
      global: {
        generate: true,
        outFile: path.resolve(__dirname, './src/style.d.ts'),
      },
      sourceDir: path.resolve(__dirname, './src'),
      outDir: path.resolve(__dirname, './dist'),
    }),
  ],
})
```

```bash
npm run dev
```

Then save the following file ...

[src/assets/styles/_index.scss]

```scss
.row {
  display: flex;
}
```

[src/App.module.scss]

```scss
.header-1 {
  background-color: common.$primary;
  &.active {
    background-color: black;
  }
}

.input {
  @media (min-width: 768px) {
    max-width: 370px;
  }
}
```

Saving the scss file creates a d.ts file in the `outDir` hierarchy.

> Note: if `outDir` is not set, declaration files are output to the same directory as the source files.

[dist/App.scss.d.ts]

```ts
import globalClassNames, { ClassNames as GlobalClassNames } from './style.d'
declare const classNames: typeof globalClassNames & {
  readonly 'header-1': 'header-1'
  readonly active: 'active'
  readonly input: 'input'
}
export = classNames
```

The optional global type definition is output to the output path of the common style specified in the options.

[src/style.d.ts]

```ts
declare const classNames: {
  readonly row: 'row'
}
export = classNames
```

## Principles of conduct

Please see [the principles of conduct](https://github.com/activeguild/vite-plugin-sass-dts/blob/master/.github/CONTRIBUTING.md) when building a site.

## License

This library is licensed under the [MIT license](https://github.com/activeguild/vite-plugin-sass-dts/blob/master/LICENSE).
