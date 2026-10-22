import { readFile, writeFile } from 'node:fs/promises'

export async function replaceReadmeSection(file, section, body) {
  const start = `<!-- ${section}:start -->`
  const end = `<!-- ${section}:end -->`
  const content = await readFile(file, 'utf8')
  const from = content.indexOf(start)
  const to = content.indexOf(end)
  if (from === -1 || to < from) throw new Error(`Markers for "${section}" not found in ${file}`)
  const next = `${content.slice(0, from + start.length)}\n${body}\n${content.slice(to)}`
  if (next === content) return false
  await writeFile(file, next)
  return true
}
