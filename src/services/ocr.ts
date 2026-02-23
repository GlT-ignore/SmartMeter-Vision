import Tesseract from 'tesseract.js'

export async function extractReadingFromFile(file: File) {
  const { data } = await Tesseract.recognize(file, 'eng')
  const text = data.text || ''
  // Debug: help tune heuristics for real meters during development.
   
  console.debug('[OCR raw text]', text)

  let candidate: string | null = null

  // Heuristic 1: look for an integer+decimal pattern like "00190 981"
  // and prefer SMALLER integer parts to avoid serial numbers like 709223.
  const pattern = /(\d{4,6})\D+(\d{3})/g
  let match: RegExpExecArray | null
  const candidates: string[] = []
  const ints: number[] = []
  while ((match = pattern.exec(text)) !== null) {
    const whole = match[1]
    const decimals = match[2]
    const wholeNum = Number(whole)
    // Skip obviously large serial numbers; gas dials are typically < 100000.
    if (!Number.isNaN(wholeNum) && wholeNum <= 200000) {
      candidates.push(`${whole}.${decimals}`)
      ints.push(wholeNum)
    }
  }
  if (candidates.length > 0) {
    // Prefer the LAST candidate (usually the dial row), among those with small integers.
    candidate = candidates[candidates.length - 1] ?? null
  }

  // Heuristic 2: handle runs like "00190981" → 00190.981
  if (!candidate) {
    const longGroups = text.match(/\d{8,9}/g) || []
    for (const g of longGroups) {
      if (g.length >= 8) {
        const whole = g.slice(0, g.length - 3)
        const decimals = g.slice(-3)
        const wholeNum = Number(whole)
        if (!Number.isNaN(wholeNum) && wholeNum <= 200000) {
          candidate = `${whole}.${decimals}`
        }
      }
    }
  }

  // Heuristic 3 (last resort): prefer the last 4–8 digit group.
  if (!candidate) {
    const groups = text.match(/\d{4,8}/g) || text.match(/\d+/g)
    if (groups && groups.length > 0) {
      candidate = groups[groups.length - 1] || null
    }
  }

  const value = candidate ? Number(candidate) : null
  const confidence = typeof data.confidence === 'number' ? data.confidence : null
  return { value, confidence }
}

