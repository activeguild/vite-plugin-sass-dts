import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'postcss'
import { SourceMapConsumer, SourceMapGenerator } from 'source-map-js'
import { normalizePath } from 'vite'
import type { GetParseCaseFunction, RawSourceMap } from './type'

// Position in the generated css: 1-based line, 0-based column
// (the source map convention).
export type ClassNamePosition = { line: number; column: number }

// Position in the source scss file the class selector came from.
export type OriginalPosition = {
  source: string // file:// URL of the scss source
  line: number // 1-based
  column: number // 0-based
}

const classNameRe = /\.(-?[_a-zA-Z][\w-]*)/g

export const extractClassNamePositions = (
  css: string,
  toParseCase?: GetParseCaseFunction
): Map<string, ClassNamePosition> => {
  const positions = new Map<string, ClassNamePosition>()
  const root = parse(css)
  root.walkRules((rule) => {
    const start = rule.source?.start
    if (!start) return
    for (const match of rule.selector.matchAll(classNameRe)) {
      const key = toParseCase ? toParseCase(match[1]) : match[1]
      if (!positions.has(key)) {
        positions.set(key, { line: start.line, column: start.column - 1 })
      }
    }
  })
  return positions
}

// Trace positions in the generated css back to the scss sources through
// sass's raw source map. Positions coming from the compiled entry string
// are shifted back by entryLineOffset (the lines prepended by
// additionalData and the split marker); positions that would land in that
// prepended region have no file to point at and are dropped.
export const resolveOriginalPositions = (
  positions: Map<string, ClassNamePosition>,
  sourceMap: RawSourceMap,
  entryUrl: string,
  entryLineOffset: number
): Map<string, OriginalPosition> => {
  const consumer = new SourceMapConsumer(
    sourceMap as ConstructorParameters<typeof SourceMapConsumer>[0]
  )
  const resolved = new Map<string, OriginalPosition>()
  for (const [key, position] of positions) {
    const original = consumer.originalPositionFor(position)
    if (!original.source || original.line == null) continue
    let line = original.line
    if (original.source === entryUrl) {
      line -= entryLineOffset
      if (line < 1) continue
    }
    resolved.set(key, {
      source: original.source,
      line,
      column: original.column ?? 0,
    })
  }
  return resolved
}

// A d.ts line carrying a class name key: a type member emitted by
// formatExportType (prettier may unquote the key) or a named export line.
const dtsKeyLineRe =
  /^\s*(?:readonly|export\s+const)\s+(?:'([^']+)'|"([^"]+)"|([^\s'":]+))\s*:/d

// Build a TypeScript declaration map (d.ts position → scss selector) for a
// formatted d.ts content. Returns undefined when no key maps to a source.
export const generateDtsSourceMap = (
  dtsContent: string,
  dtsPath: string,
  positions: Map<string, OriginalPosition>
): string | undefined => {
  const generator = new SourceMapGenerator({ file: path.basename(dtsPath) })
  // Resolve symlinks (e.g. /tmp → /private/tmp on macOS, pnpm workspaces)
  // so the relative path between the d.ts and the scss stays short.
  const dtsDir = toRealPath(path.dirname(dtsPath))
  let hasMapping = false

  dtsContent.split('\n').forEach((lineText, index) => {
    const match = dtsKeyLineRe.exec(lineText)
    if (!match) return
    const key = match[1] ?? match[2] ?? match[3]
    const original = positions.get(key)
    if (!original) return

    // Column of the key token start (including the quote when present).
    const indices = match.indices
    const keyColumn =
      indices?.[3]?.[0] ??
      (indices?.[1] ? indices[1][0] - 1 : undefined) ??
      (indices?.[2] ? indices[2][0] - 1 : undefined) ??
      0

    let source = original.source
    if (source.startsWith('file://')) {
      source = fileURLToPath(source)
    }
    let relative = normalizePath(path.relative(dtsDir, toRealPath(source)))
    if (!relative.startsWith('.')) {
      relative = `./${relative}`
    }

    generator.addMapping({
      generated: { line: index + 1, column: keyColumn },
      original: { line: original.line, column: original.column },
      source: relative,
    })
    hasMapping = true
  })

  return hasMapping ? generator.toString() : undefined
}

const toRealPath = (p: string): string => {
  try {
    return fs.realpathSync(p)
  } catch {
    return p
  }
}
