import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { Play, CheckCircle, XCircle, Clock } from 'lucide-react'

const JOBS = [
  { name: 'calculate-ai-health', label: 'Calculate AI Health', schedule: 'Daily 02:00 UTC', desc: 'Generates health snapshots for all client orgs' },
  { name: 'generate-recommendations', label: 'Generate Recommendations', schedule: 'Weekly Mon 03:00 UTC', desc: 'AI-powered recommendations for clients with recent jobs' },
  { name: 'calculate-monthly-commissions', label: 'Monthly Commissions', schedule: '1st of month 04:00 UTC', desc: 'Calculate recurring commission payouts for salespeople' },
  { name: 'generate-reviewer-payouts', label: 'Reviewer Payouts', schedule: '1st of month 05:00 UTC', desc: 'Generate payout records from delivered jobs' },
  { name: 'generate-client-invoices', label: 'Client Invoices', schedule: '1st of month 06:00 UTC', desc: 'Generate draft invoices for active subscriptions' },
  { name: 'check-allowance-warnings', label: 'Allowance Warnings', schedule: 'Daily 07:00 UTC', desc: 'Email clients approaching 90% of word allowance' },
]

const COLORS = { green: '#0F8F4D', red: '#D9211E', orange: '#EE7C24', cyan: '#1FA1D6' }

export function AdminCron() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const [running, setRunning] = useState<string | null>(null)
  const [result, setResult] = useState<Record<string, string>>({})

  const { data: runs } = useQuery({
    queryKey: ['cron-runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cron_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data
    },
  })

  // Latest run per job
  const latestByJob: Record<string, { status: string; started_at: string; records_processed: number; error_message: string | null }> = {}
  runs?.forEach(r => {
    if (!latestByJob[r.job_name]) latestByJob[r.job_name] = r
  })

  async function runJob(jobName: string, endpoint: string) {
    setRunning(jobName)
    setResult(prev => ({ ...prev, [jobName]: '' }))
    try {
      const resp = await fetch(`/.netlify/functions/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(endpoint === 'run-cron-job' ? { job_name: jobName } : {}),
      })
      const data = await resp.json()
      setResult(prev => ({
        ...prev,
        [jobName]: resp.ok ? `Success: ${data.processed ?? data.results?.length ?? 0} processed` : `Error: ${data.error}`,
      }))
      queryClient.invalidateQueries({ queryKey: ['cron-runs'] })
    } catch (err) {
      setResult(prev => ({ ...prev, [jobName]: `Failed: ${err}` }))
    } finally {
      setRunning(null)
    }
  }

  function getEndpoint(jobName: string): string {
    if (jobName === 'calculate-ai-health') return 'calculate-ai-health'
    if (jobName === 'generate-recommendations') return 'generate-recommendations'
    return 'run-cron-job'
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <RainbowStripe height={3} />
        <div className="p-6">
          <h3 className="font-medium text-gray-900 mb-1">Scheduled jobs</h3>
          <p className="text-sm text-gray-500 mb-6">Automated tasks that run on schedule. Use "Run now" to trigger manually for testing.</p>

          <div className="space-y-3">
            {JOBS.map(job => {
              const latest = latestByJob[job.name]
              const statusColor = latest?.status === 'success' ? COLORS.green : latest?.status === 'failed' ? COLORS.red : COLORS.orange
              const jobResult = result[job.name]

              return (
                <div key={job.name} className="border border-gray-100 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">{job.label}</p>
                        {latest && (
                          <span className="flex items-center gap-1 text-[10px]" style={{ color: statusColor }}>
                            {latest.status === 'success' ? <CheckCircle className="w-3 h-3" /> : latest.status === 'failed' ? <XCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {latest.status}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{job.desc}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span>Schedule: {job.schedule}</span>
                        {latest && <span>Last: {new Date(latest.started_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
                        {latest?.records_processed !== undefined && latest.records_processed > 0 && <span>{latest.records_processed} processed</span>}
                      </div>
                      {latest?.error_message && <p className="text-xs text-red-600 mt-1">{latest.error_message}</p>}
                      {jobResult && (
                        <p className={`text-xs mt-1 ${jobResult.startsWith('Success') ? 'text-green-600' : 'text-red-600'}`}>{jobResult}</p>
                      )}
                    </div>
                    <button
                      onClick={() => runJob(job.name, getEndpoint(job.name))}
                      disabled={!!running}
                      className="text-xs bg-gray-900 text-white rounded px-3 py-1.5 hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1 shrink-0"
                    >
                      <Play className="w-3 h-3" />
                      {running === job.name ? 'Running...' : 'Run now'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Run history */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <RainbowStripe height={3} />
        <div className="p-6">
          <h3 className="font-medium text-gray-900 mb-4">Run history</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr className="text-xs uppercase tracking-wide text-gray-500">
                  <th className="text-left py-2 px-3 font-medium">Job</th>
                  <th className="text-left py-2 px-3 font-medium">Started</th>
                  <th className="text-left py-2 px-3 font-medium">Duration</th>
                  <th className="text-right py-2 px-3 font-medium">Processed</th>
                  <th className="text-left py-2 px-3 font-medium">Status</th>
                  <th className="text-left py-2 px-3 font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {(!runs || runs.length === 0) && (
                  <tr><td colSpan={6} className="py-8 text-center text-sm text-gray-400">No runs yet. Click "Run now" to test.</td></tr>
                )}
                {runs?.map(r => {
                  const duration = r.completed_at
                    ? `${((new Date(r.completed_at).getTime() - new Date(r.started_at).getTime()) / 1000).toFixed(1)}s`
                    : '—'
                  const sc = r.status === 'success' ? COLORS.green : r.status === 'failed' ? COLORS.red : COLORS.orange
                  return (
                    <tr key={r.id} className="border-b border-gray-50">
                      <td className="py-2 px-3 text-gray-900">{r.job_name}</td>
                      <td className="py-2 px-3 text-xs text-gray-500">{new Date(r.started_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="py-2 px-3 text-xs text-gray-500">{duration}</td>
                      <td className="py-2 px-3 text-right">{r.records_processed ?? 0}</td>
                      <td className="py-2 px-3"><span className="text-xs px-1.5 py-0.5 rounded" style={{ background: sc + '20', color: sc }}>{r.status}</span></td>
                      <td className="py-2 px-3 text-xs text-red-600 max-w-xs truncate">{r.error_message || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
