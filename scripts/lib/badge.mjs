import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const OUT_DIR = process.env.OUT_DIR || 'dist'

export const nf = new Intl.NumberFormat('en-US')

export async function writeBadge(name, { label, message, color, namedLogo }) {
  await mkdir(OUT_DIR, { recursive: true })
  const file = join(OUT_DIR, `${name}.json`)
  await writeFile(file, JSON.stringify({ schemaVersion: 1, label, message, color, namedLogo }))
  return file
}
