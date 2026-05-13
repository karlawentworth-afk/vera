import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useClientOrgId } from '../../lib/useClientOrg'
import { RAINBOW } from '../../lib/constants'
import { MetricCard } from '../../components/shared/MetricCard'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { Download, ChevronRight } from 'lucide-react'

const COLORS = { green: '#0F8F4D', cyan: '#1FA1D6', purple: '#8E2882', orange: '#EE7C24' }

interface LangPairStats {
  pair: string
  avgHter: number
  words: number
  count: number
}

export function ClientAudit() {
  const orgId = useClientOrgId()

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['client-audit-jobs', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, job_number, source_language, target_language, content_type, word_count, status, submitted_at, delivered_at, reviewer_id, ai_tool_used')
        .eq('organisation_id', orgId!)
        .order('submitted_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })

  const { data: scores } = useQuery({
    queryKey: ['client-audit-scores', orgId],
    queryFn: async () => {
      const jobIds = jobs?.map(j => j.id) ?? []
      if (jobIds.length === 0) return []
      const { data, error } = await supabase
        .from('scores')
        .select('*, reviewer:profiles!scores_reviewer_id_fkey(full_name)')
        .in('job_id', jobIds)
      if (error) throw error
      return data
    },
    enabled: !!jobs && jobs.length > 0,
  })

  const { data: org } = useQuery({
    queryKey: ['client-org-name', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('organisations').select('name').eq('id', orgId!).single()
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })

  if (isLoading) {
    return <div className="space-y-6"><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-24 bg-white border border-gray-200 rounded-lg animate-pulse" />)}</div></div>
  }

  // Score map: job_id → score
  const scoreMap: Record<string, typeof scores extends (infer T)[] | undefined ? T : never> = {}
  scores?.forEach(s => { scoreMap[s.job_id] = s })

  // Aggregate hTER
  const hterValues = scores?.map(s => Number(s.hter_score)) ?? []
  const avgHter = hterValues.length > 0 ? hterValues.reduce((a, b) => a + b, 0) / hterValues.length : 0
  const healthScore = hterValues.length > 0 ? Math.round((1 - avgHter) * 100) : null

  // Delivered jobs with scores
  const deliveredWithScores = jobs?.filter(j => j.status === 'delivered' && scoreMap[j.id]) ?? []
  const totalReviewedWords = deliveredWithScores.reduce((sum, j) => sum + j.word_count, 0)

  // Risk events: scores where risk < 7
  const highRiskCount = scores?.filter(s => s.risk <= 3).length ?? 0
  const lowRiskCount = scores?.filter(s => s.risk > 3 && s.risk <= 6).length ?? 0

  // Language pair breakdown
  const langPairMap: Record<string, { hterSum: number; count: number; words: number }> = {}
  deliveredWithScores.forEach(j => {
    const pair = `${j.source_language} → ${j.target_language}`
    const score = scoreMap[j.id]
    if (!score) return
    if (!langPairMap[pair]) langPairMap[pair] = { hterSum: 0, count: 0, words: 0 }
    langPairMap[pair].hterSum += Number(score.hter_score)
    langPairMap[pair].count += 1
    langPairMap[pair].words += j.word_count
  })

  const langPairs: LangPairStats[] = Object.entries(langPairMap)
    .map(([pair, stats]) => ({
      pair,
      avgHter: stats.hterSum / stats.count,
      words: stats.words,
      count: stats.count,
    }))
    .sort((a, b) => a.avgHter - b.avgHter)

  function hterColor(hter: number): string {
    if (hter < 0.15) return COLORS.green
    if (hter < 0.25) return COLORS.cyan
    return COLORS.orange
  }

  function hterLabel(hter: number): string {
    if (hter < 0.15) return 'Strong'
    if (hter < 0.25) return 'Good'
    return 'Needs attention'
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-widest text-gray-400 font-medium">AI health & audit</p>
        <h1 className="text-2xl font-light text-gray-900 mt-1">{org?.name}</h1>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Overall AI Health"
          value={healthScore !== null ? String(healthScore) : '—'}
          unit="/100"
          trend={healthScore !== null && healthScore > (hterValues.length > 1 ? Math.round((1 - hterValues[0]) * 100) : healthScore) ? '↑ trending up' : `${hterValues.length} reviews`}
          color={COLORS.green}
        />
        <MetricCard
          label="Avg. hTER"
          value={hterValues.length > 0 ? avgHter.toFixed(2) : '—'}
          trend="Industry: 0.31"
          color={COLORS.cyan}
        />
        <MetricCard
          label="Risk events"
          value={String(highRiskCount)}
          unit="high"
          trend={`${lowRiskCount} low-risk flagged`}
          color={highRiskCount === 0 ? COLORS.green : COLORS.orange}
        />
        <MetricCard
          label="Content reviewed"
          value={String(deliveredWithScores.length)}
          unit="docs"
          trend={`${totalReviewedWords.toLocaleString()} words`}
          color={COLORS.purple}
        />
      </div>

      {/* Language pair breakdown */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <RainbowStripe height={3} />
        <div className="p-6">
          <h3 className="font-medium text-gray-900 mb-1">Performance by language pair</h3>
          <p className="text-sm text-gray-500 mb-6">hTER scores — lower is better. Your AI's edit-distance against expert review.</p>

          {langPairs.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No reviewed content yet.</p>
          ) : (
            <div className="space-y-4">
              {langPairs.map(row => (
                <div key={row.pair} className="grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-2 font-medium text-sm">{row.pair}</div>
                  <div className="col-span-6">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min((row.avgHter / 0.5) * 100, 100)}%`, background: hterColor(row.avgHter) }}
                      />
                    </div>
                  </div>
                  <div className="col-span-1 text-sm font-mono">{row.avgHter.toFixed(2)}</div>
                  <div className="col-span-2 text-xs" style={{ color: hterColor(row.avgHter) }}>{hterLabel(row.avgHter)}</div>
                  <div className="col-span-1 text-xs text-gray-500 text-right">{row.words.toLocaleString()}w</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI tool performance */}
      {(() => {
        const toolStats: Record<string, { hterSum: number; count: number; words: number }> = {}
        deliveredWithScores.forEach(j => {
          const tool = j.ai_tool_used || 'Unknown'
          const score = scoreMap[j.id]
          if (!toolStats[tool]) toolStats[tool] = { hterSum: 0, count: 0, words: 0 }
          toolStats[tool].words += j.word_count
          if (score) {
            toolStats[tool].hterSum += Number(score.hter_score)
            toolStats[tool].count += 1
          }
        })
        const toolList = Object.entries(toolStats)
          .map(([tool, s]) => ({ tool, avgHter: s.count > 0 ? s.hterSum / s.count : null, words: s.words, count: s.count }))
          .sort((a, b) => (a.avgHter ?? 1) - (b.avgHter ?? 1))

        if (toolList.length === 0) return null

        const best = toolList[0]
        const worst = toolList[toolList.length - 1]

        return (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <RainbowStripe height={3} />
            <div className="p-6">
              <h3 className="font-medium text-gray-900 mb-1">Your AI tools — how each one performs for you</h3>
              {best && worst && best.tool !== worst.tool && best.avgHter !== null && worst.avgHter !== null && (
                <p className="text-sm text-gray-500 mb-4">
                  <span className="font-medium" style={{ color: RAINBOW.green }}>{best.tool}</span> performs best (hTER {best.avgHter.toFixed(2)}).
                  {worst.avgHter > 0.2 && <> <span className="font-medium" style={{ color: RAINBOW.orange }}>{worst.tool}</span> needs the most editing (hTER {worst.avgHter.toFixed(2)}).</>}
                </p>
              )}
              <div className="space-y-3">
                {toolList.map(t => (
                  <div key={t.tool} className="flex items-center gap-3">
                    <div className="w-36 text-sm font-medium text-gray-900 truncate">{t.tool}</div>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      {t.avgHter !== null && (
                        <div className="h-full rounded-full" style={{
                          width: `${Math.min((t.avgHter / 0.4) * 100, 100)}%`,
                          background: t.avgHter < 0.15 ? RAINBOW.green : t.avgHter < 0.25 ? RAINBOW.cyan : RAINBOW.orange,
                        }} />
                      )}
                    </div>
                    <div className="w-12 text-xs font-mono text-gray-600">{t.avgHter !== null ? t.avgHter.toFixed(2) : '—'}</div>
                    <div className="w-16 text-xs text-gray-500 text-right">{t.words.toLocaleString()}w</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Audit trail */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <RainbowStripe height={3} />
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium text-gray-900">Audit trail</h3>
              <p className="text-sm text-gray-500">Every reviewed job. Defensible to procurement, board, regulators.</p>
            </div>
            <button className="flex items-center gap-2 text-sm border border-gray-200 rounded px-3 py-1.5 hover:bg-gray-50">
              <Download className="w-4 h-4" /> Export PDF
            </button>
          </div>

          {deliveredWithScores.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No delivered jobs yet.</p>
          ) : (
            <div className="space-y-2">
              {deliveredWithScores.map(job => {
                const score = scoreMap[job.id]
                const reviewer = score?.reviewer as { full_name: string } | null
                const deliveredDate = job.delivered_at ? new Date(job.delivered_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'

                return (
                  <div key={job.id} className="grid grid-cols-12 gap-3 p-3 border border-gray-100 rounded items-center text-sm">
                    <span className="col-span-1 text-xs font-mono text-gray-400">{job.job_number}</span>
                    <span className="col-span-3 text-gray-900">{job.content_type}</span>
                    <span className="col-span-2 text-gray-500">{job.source_language} → {job.target_language}</span>
                    <span className="col-span-2 text-gray-500">{reviewer?.full_name ?? '—'}</span>
                    <span className="col-span-1 text-gray-500">{deliveredDate}</span>
                    <span className="col-span-1 font-mono text-sm" style={{ color: hterColor(Number(score?.hter_score ?? 0)) }}>
                      {score ? Number(score.hter_score).toFixed(2) : '—'}
                    </span>
                    <span className="col-span-1"><StatusBadge status={job.status} /></span>
                    <button className="col-span-1 text-xs text-gray-600 hover:text-gray-900 flex items-center justify-end">
                      Record <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
