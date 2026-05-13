import { supabase } from './supabase'

export async function downloadJobFile(orgId: string, jobId: string, folder: 'source' | 'delivered'): Promise<void> {
  const dir = `${orgId}/${jobId}/${folder}`
  const { data: files } = await supabase.storage.from('job-files').list(dir)

  if (!files || files.length === 0) {
    alert('No file found')
    return
  }

  const filePath = `${dir}/${files[0].name}`
  const { data, error } = await supabase.storage.from('job-files').download(filePath)

  if (error || !data) {
    alert('Download failed')
    return
  }

  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = files[0].name
  a.click()
  URL.revokeObjectURL(url)
}
