import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { RAINBOW } from '../../lib/constants'
import { Zap } from 'lucide-react'

const TOOL_COLORS: Record<string, string> = {
  'ChatGPT': RAINBOW.green,
  'Claude': RAINBOW.purple,
  'Gemini': RAINBOW.blue,
  'DeepL': RAINBOW.cyan,
  'Google Translate': RAINBOW.orange,
  'Microsoft Translator': RAINBOW.pink,
  'Other': '#6B7280',
  'Not AI / Human-generated': '#9CA3AF',
  'Unknown / Mixed sources': '#D1D5DB',
}

interface JobWithScore {
  id: string
  ai_tool_used: string
  source_language: string
  target_language: string
  content_type: string
  word_count: number
  hter_score: number | null
}

export function AdminInsights() {
  const { session } = useAuth()
  const [langFilter, setLangFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [generatingFor, setGeneratingFor] = useState<string | null>(null)
  const [genResult, setGenResult] = useState<string | null>(null)

  // Fetch all delivered jobs with their scores
  const { data: jobs, isLoading } = useQuery({
    queryKey: ['insights-jobs'],
    queryFn: async () => {
      const { data: jobData, error: jobErr } = await supabase
        .from('jobs')
        .select('id, ai_tool_used, source_language, target_language, content_type, word_count, status')
        .eq('status', 'delivered')
      if (jobErr) throw jobErr

      const jobIds = jobData.map(j => j.id)
      const { data: scoreData, error: scoreErr } = await supabase
        .from('scores')
        .select('job_id, hter_score')
        .in('job_id', jobIds)
      if (scoreErr) throw scoreErr

      const scoreMap: Record<string, number> = {}
      scoreData.forEach(s => { scoreMap[s.job_id] = Number(s.hter_score) })

      return jobData.map(j => ({
        ...j,
        hter_score: scoreMap[j.id] ?? null,
      })) as JobWithScore[]
    },
  })

  if (isLoading) return <div className="bg-white border border-gray-200 rounded-lg h-96 animate-pulse" />

  // Apply filters
  const filtered = jobs?.filter(j => {
    if (langFilter) {
      const pair = `${j.source_language} → ${j.target_language}`
      if (pair !== langFilter) return false
    }
    if (typeFilter && j.content_type !== typeFilter) return false
    return true
  }) ?? []

  // Unique language pairs and content types for filters
  const langPairs = [...new Set(jobs?.map(j => `${j.source_language} → ${j.target_language}`) ?? [])]
  const contentTypes = [...new Set(jobs?.map(j => j.content_type) ?? [])]

  // AI tool performance (avg hTER per tool)
  const toolPerf: Record<string, { hterSum: number; count: number; words: number }> = {}
  filtered.forEach(j => {
    const tool = j.ai_tool_used || 'Unknown'
    if (!toolPerf[tool]) toolPerf[tool] = { hterSum: 0, count: 0, words: 0 }
    toolPerf[tool].words += j.word_count
    if (j.hter_score !== null) {
      toolPerf[tool].hterSum += j.hter_score
      toolPerf[tool].count += 1
    }
  })

  const toolPerfSorted = Object.entries(toolPerf)
    .map(([tool, stats]) => ({
      tool,
      avgHter: stats.count > 0 ? stats.hterSum / stats.count : null,
      words: stats.words,
      count: stats.count,
    }))
    .sort((a, b) => (a.avgHter ?? 1) - (b.avgHter ?? 1))

  // Worst-performing combinations
  const combos: Record<string, { hterSum: number; count: number; words: number }> = {}
  filtered.forEach(j => {
    if (j.hter_score === null) return
    const key = `${j.ai_tool_used}||${j.source_language} → ${j.target_language}||${j.content_type}`
    if (!combos[key]) combos[key] = { hterSum: 0, count: 0, words: 0 }
    combos[key].hterSum += j.hter_score
    combos[key].count += 1
    combos[key].words += j.word_count
  })

  const worstCombos = Object.entries(combos)
    .map(([key, stats]) => {
      const [tool, lang, type] = key.split('||')
      return { tool, lang, type, avgHter: stats.hterSum / stats.count, count: stats.count, words: stats.words }
    })
    .sort((a, b) => b.avgHter - a.avgHter)
    .slice(0, 10)

  function hterColor(h: number): string {
    if (h < 0.15) return RAINBOW.green
    if (h < 0.25) return RAINBOW.cyan
    return RAINBOW.orange
  }

  const maxWords = Math.max(...toolPerfSorted.map(t => t.words), 1)

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <select value={langFilter} onChange={e => setLangFilter(e.target.value)} className="text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:border-gray-400">
          <option value="">All language pairs</option>
          {langPairs.map(lp => <option key={lp} value={lp}>{lp}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:border-gray-400">
          <option value="">All content types</option>
          {contentTypes.map(ct => <option key={ct} value={ct}>{ct}</option>)}
        </select>
        <span className="text-xs text-gray-400">{filtered.length} delivered jobs</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* AI tool performance (hTER) */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <RainbowStripe height={3} />
          <div className="p-6">
            <h3 className="font-medium text-gray-900 mb-1">AI tool performance</h3>
            <p className="text-sm text-gray-500 mb-6">Average hTER score per tool — lower is better</p>

            {toolPerfSorted.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No scored data yet</p>
            ) : (
              <div className="space-y-3">
                {toolPerfSorted.map(t => (
                  <div key={t.tool} className="flex items-center gap-3">
                    <div className="w-32 text-sm font-medium text-gray-900 truncate">{t.tool}</div>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden relative">
                      {t.avgHter !== null && (
                        <div
                          className="h-full rounded-full flex items-center justify-end pr-2"
                          style={{
                            width: `${Math.max((t.avgHter / 0.4) * 100, 10)}%`,
                            background: TOOL_COLORS[t.tool] ?? '#6B7280',
                          }}
                        >
                          <span className="text-[10px] text-white font-medium">{t.avgHter.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                    <div className="w-16 text-xs text-gray-500 text-right">{t.count} jobs</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* AI tool usage (volume) */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <RainbowStripe height={3} />
          <div className="p-6">
            <h3 className="font-medium text-gray-900 mb-1">AI tool usage</h3>
            <p className="text-sm text-gray-500 mb-6">Words reviewed per tool</p>

            {toolPerfSorted.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No data yet</p>
            ) : (
              <div className="space-y-3">
                {toolPerfSorted.sort((a, b) => b.words - a.words).map(t => (
                  <div key={t.tool} className="flex items-center gap-3">
                    <div className="w-32 text-sm font-medium text-gray-900 truncate">{t.tool}</div>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(t.words / maxWords) * 100}%`,
                          background: TOOL_COLORS[t.tool] ?? '#6B7280',
                        }}
                      />
                    </div>
                    <div className="w-20 text-xs text-gray-500 text-right">{t.words.toLocaleString()}w</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Worst-performing combinations */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <RainbowStripe height={3} />
        <div className="p-6">
          <h3 className="font-medium text-gray-900 mb-1">Where AI struggles most</h3>
          <p className="text-sm text-gray-500 mb-4">Tool + language + content type combinations with highest hTER (most editing needed)</p>

          {worstCombos.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Not enough scored data yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr className="text-xs uppercase tracking-wide text-gray-500">
                  <th className="text-left py-2 px-3 font-medium">AI tool</th>
                  <th className="text-left py-2 px-3 font-medium">Language pair</th>
                  <th className="text-left py-2 px-3 font-medium">Content type</th>
                  <th className="text-right py-2 px-3 font-medium">Avg hTER</th>
                  <th className="text-right py-2 px-3 font-medium">Jobs</th>
                  <th className="text-right py-2 px-3 font-medium">Words</th>
                </tr>
              </thead>
              <tbody>
                {worstCombos.map((c, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 px-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: TOOL_COLORS[c.tool] ?? '#6B7280' }} />
                        {c.tool}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-600">{c.lang}</td>
                    <td className="py-2 px-3 text-gray-600">{c.type}</td>
                    <td className="py-2 px-3 text-right font-mono" style={{ color: hterColor(c.avgHter) }}>{c.avgHter.toFixed(3)}</td>
                    <td className="py-2 px-3 text-right text-gray-500">{c.count}</td>
                    <td className="py-2 px-3 text-right text-gray-500">{c.words.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* AI Recommendations generation */}
      <GenerateRecommendations session={session} generatingFor={generatingFor} setGeneratingFor={setGeneratingFor} genResult={genResult} setGenResult={setGenResult} />
    </div>
  )
}

// Sub-component for generating recommendations
function GenerateRecommendations({ session, generatingFor, setGeneratingFor, genResult, setGenResult }: {
  session: { access_token: string } | null
  generatingFor: string | null
  setGeneratingFor: (v: string | null) => void
  genResult: string | null
  setGenResult: (v: string | null) => void
}) {
  const { data: clientOrgs } = useQuery({
    queryKey: ['client-orgs-for-recs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organisations')
        .select('id, name')
        .eq('type', 'client')
        .order('name')
      if (error) throw error
      return data
    },
  })

  async function generate(orgId: string) {
    setGeneratingFor(orgId)
    setGenResult(null)
    try {
      const resp = await fetch('/.netlify/functions/generate-recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ organisation_id: orgId }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        setGenResult(`Error: ${data.error}`)
      } else {
        setGenResult(`Generated ${data.count} recommendations`)
      }
    } catch (err) {
      setGenResult(`Failed: ${err}`)
    } finally {
      setGeneratingFor(null)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <RainbowStripe height={3} />
      <div className="p-6">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4" style={{ color: RAINBOW.purple }} />
          <h3 className="font-medium text-gray-900">AI-generated recommendations</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">Generate personalised recommendations for each client using Claude AI. Analyses their hTER scores, AI tool usage, and reviewer feedback.</p>

        {genResult && (
          <div className={`text-sm mb-4 px-3 py-2 rounded ${genResult.startsWith('Error') || genResult.startsWith('Failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {genResult}
          </div>
        )}

        <div className="space-y-2">
          {clientOrgs?.map(org => (
            <div key={org.id} className="flex items-center justify-between p-3 border border-gray-100 rounded">
              <span className="text-sm font-medium text-gray-900">{org.name}</span>
              <button
                onClick={() => generate(org.id)}
                disabled={!!generatingFor}
                className="text-xs bg-gray-900 text-white rounded px-3 py-1.5 hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1"
              >
                <Zap className="w-3 h-3" />
                {generatingFor === org.id ? 'Generating...' : 'Generate'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
