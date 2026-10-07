// Regenerates the example's d.ts files through the plugin's public hooks.
// Usage (cwd = example/react-sass): node ../../tools/regen-example-dts.mjs
import { resolveConfig } from 'vite'
import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const config = await resolveConfig(
  { configFile: path.join(root, 'vite.config.ts'), root },
  'serve'
)
const plugin = config.plugins.find((p) => p.name === 'vite-plugin-sass-dts')
await plugin.configResolved.call({}, config)

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
const files = walk(path.join(root, 'src')).filter((f) =>
  /\.module\.(scss|sass|css)$/.test(f)
)
for (const f of files) await plugin.transform.call({}, '', f)

// Generation is fire-and-forget inside the plugin, so wait for the writes.
await new Promise((r) => setTimeout(r, 3000))
console.log('regenerated from', files.length, 'module files')
