import * as sass from 'sass-embedded'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const testScss = `
.test-class {
  color: red;
  .nested {
    background: blue;
  }
}
`

// Compile with embedded source maps
const result = sass.compileString(testScss, {
  sourceMap: true,
  sourceMapIncludeSources: true,
  style: 'expanded',
})

console.log('CSS output:')
console.log(result.css)
console.log('\n--- End CSS output ---\n')

console.log('Source map object:')
console.log(result.sourceMap)
console.log('\n--- End source map object ---\n')

// Manually embed the source map to test our function
let cssWithEmbeddedSourceMap = result.css
if (result.sourceMap) {
  const sourceMapJson = JSON.stringify(result.sourceMap)
  const sourceMapDataUri = `data:application/json;charset=utf-8,${encodeURIComponent(sourceMapJson)}`
  const sourceMapComment = `/*# sourceMappingURL=${sourceMapDataUri} */`
  cssWithEmbeddedSourceMap += '\n' + sourceMapComment
}

console.log('CSS with manually embedded source map:')
console.log(cssWithEmbeddedSourceMap)
console.log('\n--- End CSS with embedded source map ---\n')

// Test our source map extraction
const sourceMapRE = /\/\*#\s*sourceMappingURL=data:application\/json[^*]*\*\//g

const extractSourceMapComment = (css) => {
  const match = css.match(sourceMapRE)
  return match ? match[match.length - 1] : null
}

const extractedSourceMap = extractSourceMapComment(cssWithEmbeddedSourceMap)
console.log('Extracted source map:', extractedSourceMap)
