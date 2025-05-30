import fs from 'fs'
import path from 'path'
import { parseCss } from '../../src/css.js'
import { writeToFile } from '../../src/write.js'
import { extractClassNameKeys } from '../../src/extract.js'
import { parse } from 'postcss'
import { objectify } from 'postcss-js'

// Create a mock config
const config = {
  root: process.cwd(),
  css: {
    preprocessorOptions: {
      scss: {
        sourceMap: true,
        api: 'modern',
      },
    },
  },
  resolve: {
    alias: [],
  },
  createResolver: () => () => Promise.resolve(null),
  prettierOptions: {
    parser: 'typescript',
    semi: false,
    trailingComma: 'es5',
    singleQuote: true,
  },
}

const testScss = `
.test-class {
  color: red;
  .nested {
    background: blue;
  }
}

.another-class {
  padding: 10px;
}
`

// Test the full pipeline
const testFile = '/tmp/test.scss'
fs.writeFileSync(testFile, testScss)

const buffer = fs.readFileSync(testFile)

console.log('Testing parseCss...')
const result = await parseCss(buffer, testFile, config)

console.log('CSS result:', JSON.stringify(result, null, 2))

if (result.sourceMap) {
  console.log('Source map found!')
} else {
  console.log('No source map found')
}

// Extract class names
const classNameKeys = extractClassNameKeys(
  objectify(parse(result.localStyle)),
  undefined
)

console.log('Class names:', classNameKeys)

// Write the .d.ts file
const outputFile = '/tmp/test.scss'
await writeToFile(
  config.prettierOptions,
  outputFile,
  classNameKeys,
  {},
  result.sourceMap
)

// Check the generated file
const generatedContent = fs.readFileSync('/tmp/test.scss.d.ts', 'utf8')
console.log('Generated .d.ts content:')
console.log(generatedContent)
