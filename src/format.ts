import prettier from 'prettier'
const { format } = prettier

import type { Options } from 'prettier'
import type { Biome } from '@biomejs/js-api/nodejs'
import type { Formatter } from './type'

let loadedBiome: { biome: Biome; projectKey: number } | undefined

const loadBiome = async () => {
  if (loadedBiome) {
    return loadedBiome
  }

  try {
    const { Biome } = await import('@biomejs/js-api/nodejs')
    const biome = new Biome()
    const { projectKey } = biome.openProject()
    return (loadedBiome = { biome, projectKey })
  } catch (e) {
    console.error(e)
    throw new Error(
      `Formatter dependency '@biomejs/js-api' not found. Did you install '@biomejs/js-api' and '@biomejs/wasm-nodejs'?`
    )
  }
}

export const formatContent = async (
  content: string,
  filePath: string,
  prettierOptions: Options,
  formatter?: Formatter
): Promise<string> => {
  if (formatter === 'biome') {
    const { biome, projectKey } = await loadBiome()
    const result = biome.formatContent(projectKey, content, { filePath })
    if (result.diagnostics.length > 0) {
      // Keep the plugin's log-and-continue posture: report diagnostics and
      // fall back to the unformatted content instead of failing the build.
      console.error(
        biome.printDiagnostics(result.diagnostics, {
          filePath,
          fileSource: content,
        })
      )
      return content
    }
    return result.content
  }

  return format(content, prettierOptions)
}
