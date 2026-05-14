import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
import JSZip from "jszip"

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function extractParagraphs(xml: string): string[] {
  // Extract text from <w:p> elements
  const paragraphs: string[] = []
  const pRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g
  let match
  while ((match = pRegex.exec(xml)) !== null) {
    // Extract all <w:t> text within the paragraph
    const texts: string[] = []
    const tRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g
    let tMatch
    while ((tMatch = tRegex.exec(match[1])) !== null) {
      texts.push(tMatch[1])
    }
    const text = texts.join("").trim()
    if (text.length > 0) paragraphs.push(text)
  }
  return paragraphs
}

function extractTextFromTxt(content: string): string[] {
  return content.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 0)
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 })

  // Auth: verify caller has access to this job
  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 })
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""))
  if (!user) return new Response("Invalid token", { status: 401 })

  // Verify caller is admin or assigned reviewer for this job
  const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  const body = await req.json() as { job_id: string }
  if (!body.job_id) return new Response(JSON.stringify({ error: "job_id required" }), { status: 400 })

  if (callerProfile?.role !== "admin") {
    // Non-admin: verify they're the assigned reviewer
    const { data: job } = await supabase.from("jobs").select("reviewer_id").eq("id", body.job_id).single()
    if (job?.reviewer_id !== user.id) return new Response(JSON.stringify({ error: "Access denied" }), { status: 403 })
  }

  try {
    // Get job
    const { data: job } = await supabase.from("jobs").select("id, organisation_id").eq("id", body.job_id).single()
    if (!job) return new Response(JSON.stringify({ error: "Job not found" }), { status: 404 })

    // Check if segments already exist
    const { data: existing } = await supabase.from("job_segments").select("id").eq("job_id", job.id).limit(1)
    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ message: "Segments already parsed", count: existing.length }), { status: 200 })
    }

    // Find source file in storage
    const { data: files } = await supabase.storage.from("job-files").list(`${job.organisation_id}/${job.id}/source`)
    if (!files || files.length === 0) {
      // No file uploaded — create a single placeholder segment
      await supabase.from("job_segments").insert({
        job_id: job.id,
        segment_index: 0,
        source_text: "(Source text will appear here when file is uploaded)",
        ai_translation: "(AI translation will appear here)",
      })
      return new Response(JSON.stringify({ message: "No source file — placeholder created", count: 1 }), { status: 200 })
    }

    const fileName = files[0].name
    const filePath = `${job.organisation_id}/${job.id}/source/${fileName}`

    const { data: fileData, error: dlErr } = await supabase.storage.from("job-files").download(filePath)
    if (dlErr || !fileData) {
      return new Response(JSON.stringify({ error: "Failed to download file" }), { status: 500 })
    }

    let paragraphs: string[] = []

    if (fileName.endsWith(".docx")) {
      const arrayBuffer = await fileData.arrayBuffer()
      const zip = await JSZip.loadAsync(arrayBuffer)
      const docXml = await zip.file("word/document.xml")?.async("string")
      if (docXml) {
        paragraphs = extractParagraphs(docXml)
      }
    } else if (fileName.endsWith(".txt") || fileName.endsWith(".csv")) {
      const text = await fileData.text()
      paragraphs = extractTextFromTxt(text)
    } else {
      // PDF, XLIFF — single segment placeholder
      paragraphs = ["(Full document content — paragraph-level parsing not available for this file type)"]
    }

    if (paragraphs.length === 0) {
      paragraphs = ["(No text content extracted)"]
    }

    // For demo: use the same text as both source and AI translation
    // In production, there would be separate source and translated files
    const segments = paragraphs.map((text, i) => ({
      job_id: job.id,
      segment_index: i,
      source_text: text,
      ai_translation: text, // Same for now — would be the translated version
    }))

    const { error: insertErr } = await supabase.from("job_segments").insert(segments)
    if (insertErr) throw insertErr

    console.log(`[parse-segments] job=${job.id} segments=${segments.length}`)

    return new Response(JSON.stringify({ success: true, count: segments.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("[parse-segments] error:", err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
}
