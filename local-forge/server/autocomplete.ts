import type { AppConfig } from './config.ts'
import { chatCompletion } from './llm.ts'
import { assertLocalProvider } from './offline.ts'

/** Ghost-text / tab autocomplete from the local model. */
export async function completePrefix(
  config: AppConfig,
  opts: { prefix: string; suffix: string; language: string; path: string },
): Promise<string> {
  assertLocalProvider(config.baseUrl, config.offlineMode)

  if (config.provider === 'demo') {
    const line = opts.prefix.split('\n').at(-1) ?? ''
    if (/function\s+\w+\s*\([^)]*\)\s*\{\s*$/.test(line.trim()) || opts.prefix.trimEnd().endsWith('{')) {
      return '\n  // TODO\n}'
    }
    if (line.trim().endsWith('=')) return ' null'
    return ''
  }

  const prompt = `You are a code completion engine. Continue the code at the cursor.
Return ONLY the completion text to insert — no markdown fences, no explanations.
File: ${opts.path || 'unknown'} (${opts.language})

CODE BEFORE CURSOR:
${opts.prefix.slice(-2400)}

CODE AFTER CURSOR:
${opts.suffix.slice(0, 800)}

Completion:`

  const upstream = await chatCompletion(config, {
    messages: [
      { role: 'system', content: 'Complete code. Output only the missing text.' },
      { role: 'user', content: prompt },
    ],
    stream: false,
    temperature: 0.1,
  })

  // Non-stream responses differ by provider
  const text = await upstream.text()
  try {
    // Ollama non-stream JSON
    const json = JSON.parse(text) as { message?: { content?: string }; choices?: Array<{ message?: { content?: string } }> }
    const content = json.message?.content ?? json.choices?.[0]?.message?.content ?? ''
    return sanitizeCompletion(content)
  } catch {
    // Maybe NDJSON last line or raw
    const lines = text.trim().split('\n').filter(Boolean)
    for (const line of lines.reverse()) {
      try {
        const json = JSON.parse(line) as { message?: { content?: string } }
        if (json.message?.content) return sanitizeCompletion(json.message.content)
      } catch {
        /* continue */
      }
    }
    return sanitizeCompletion(text)
  }
}

function sanitizeCompletion(raw: string): string {
  let s = raw.trim()
  if (s.startsWith('```')) {
    s = s.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '')
  }
  // Cap runaway completions
  if (s.length > 800) s = s.slice(0, 800)
  return s
}
