/**
 * Generates and uploads source files for every job that doesn't have one.
 * Uses the job's segment content to create a realistic .txt file.
 * Run: npx tsx scripts/seed-files.ts
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function seed() {
  console.log('Uploading source files for all jobs...\n')

  // Get all jobs with their org
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, job_number, organisation_id, content_type, source_language, target_language')
    .order('submitted_at')
  if (error) throw error

  // Get all segments
  const { data: allSegments } = await supabase
    .from('job_segments')
    .select('job_id, segment_index, source_text, ai_translation')
    .order('segment_index')

  const segmentsByJob: Record<string, Array<{ source_text: string; ai_translation: string }>> = {}
  allSegments?.forEach(s => {
    if (!segmentsByJob[s.job_id]) segmentsByJob[s.job_id] = []
    segmentsByJob[s.job_id].push(s)
  })

  let uploaded = 0
  let skipped = 0

  for (const job of jobs ?? []) {
    const dir = `${job.organisation_id}/${job.id}/source`

    // Check if file already exists
    const { data: existing } = await supabase.storage.from('job-files').list(dir)
    if (existing && existing.length > 0) {
      skipped++
      continue
    }

    const segments = segmentsByJob[job.id]
    if (!segments || segments.length === 0) {
      skipped++
      continue
    }

    // Build source document content
    const fileName = `${job.content_type.toLowerCase().replace(/\s+/g, '_')}_${job.source_language}_${job.target_language}.txt`

    const lines = [
      `=== ${job.content_type} ===`,
      `Job Reference: ${job.job_number}`,
      `Source Language: ${job.source_language}`,
      `Target Language: ${job.target_language}`,
      ``,
      `--- SOURCE TEXT ---`,
      ``,
      ...segments.map((s, i) => `[${i + 1}] ${s.source_text}`),
      ``,
      `--- AI TRANSLATION ---`,
      ``,
      ...segments.map((s, i) => `[${i + 1}] ${s.ai_translation}`),
      ``,
      `--- END OF DOCUMENT ---`,
    ]

    const content = lines.join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const path = `${dir}/${fileName}`

    const { error: uploadErr } = await supabase.storage
      .from('job-files')
      .upload(path, blob, { contentType: 'text/plain', upsert: false })

    if (uploadErr) {
      // Might be bucket doesn't exist
      if (uploadErr.message.includes('Bucket not found') || uploadErr.message.includes('bucket')) {
        console.log('Creating job-files bucket...')
        await supabase.storage.createBucket('job-files', { public: false })
        // Retry
        const { error: retryErr } = await supabase.storage
          .from('job-files')
          .upload(path, blob, { contentType: 'text/plain', upsert: false })
        if (retryErr) {
          console.log(`  Error ${job.job_number}: ${retryErr.message}`)
          continue
        }
      } else {
        console.log(`  Error ${job.job_number}: ${uploadErr.message}`)
        continue
      }
    }

    uploaded++
    if (uploaded % 10 === 0) console.log(`  ${uploaded} files uploaded...`)
  }

  console.log(`\nDone. ${uploaded} files uploaded, ${skipped} skipped (already had files or no segments).`)
}

seed().catch(console.error)
