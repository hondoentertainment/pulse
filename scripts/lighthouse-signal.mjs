/**
 * Lighthouse audits for Pulse Signal surfaces.
 *
 * Usage (after preview is running on port 4176):
 *   npm run build
 *   npm run preview -- --host 127.0.0.1 --port 4176
 *   npm run lighthouse:signal
 *
 * Optional: LIGHTHOUSE_BASE_URL=https://pulse-chi-nine.vercel.app npm run lighthouse:signal
 */

import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const outDir = path.join(root, 'test-results', 'lighthouse')
const baseUrl = process.env.LIGHTHOUSE_BASE_URL ?? 'http://127.0.0.1:4176'

const routes = [
  { name: 'login', path: '/' },
  { name: 'trends', path: '/trends' },
]

function runLighthouse(url, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      url,
      '--quiet',
      '--chrome-flags=--headless --no-sandbox --disable-gpu',
      '--only-categories=performance,accessibility,best-practices',
      '--output=json',
      `--output-path=${outputPath}`,
    ]
    const child = spawn('npx', ['lighthouse', ...args], {
      cwd: root,
      stdio: 'inherit',
      shell: true,
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve(undefined)
      else reject(new Error(`lighthouse exited with code ${code} for ${url}`))
    })
  })
}

async function summarizeReport(filePath) {
  const raw = await import('node:fs/promises').then((fs) => fs.readFile(filePath, 'utf8'))
  const report = JSON.parse(raw)
  const categories = report.categories ?? {}
  return {
    performance: Math.round((categories.performance?.score ?? 0) * 100),
    accessibility: Math.round((categories.accessibility?.score ?? 0) * 100),
    bestPractices: Math.round((categories['best-practices']?.score ?? 0) * 100),
    lcp: report.audits?.['largest-contentful-paint']?.displayValue ?? 'n/a',
    cls: report.audits?.['cumulative-layout-shift']?.displayValue ?? 'n/a',
  }
}

await mkdir(outDir, { recursive: true })

const summary = {}

for (const route of routes) {
  const url = `${baseUrl.replace(/\/$/, '')}${route.path}`
  const outputPath = path.join(outDir, `signal-${route.name}.json`)
  console.log(`\nAuditing ${url} …`)
  try {
    await runLighthouse(url, outputPath)
    summary[route.name] = await summarizeReport(outputPath)
    console.log(`${route.name}:`, summary[route.name])
  } catch (error) {
    console.warn(`Skipping ${route.name}:`, error instanceof Error ? error.message : error)
    summary[route.name] = { error: String(error) }
  }
}

const summaryPath = path.join(outDir, 'summary.json')
await writeFile(summaryPath, JSON.stringify(summary, null, 2))
console.log(`\nWrote ${summaryPath}`)
if (Object.values(summary).some((report) => 'error' in report)) process.exitCode = 1
