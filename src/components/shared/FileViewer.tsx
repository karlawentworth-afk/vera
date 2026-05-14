import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Download, Eye, FileText, AlertTriangle } from 'lucide-react'

interface FileViewerProps {
  bucket: string
  path: string       // e.g. "{org_id}/{job_id}/source"
  label?: string     // "Source file" / "Verified translation"
  accent?: boolean   // Rainbow accent for primary download (delivered file)
  showPreview?: boolean
}

export function FileViewer({ bucket, path, label, accent, showPreview = true }: FileViewerProps) {
  const [previewing, setPreviewing] = useState(false)

  // List files at the path
  const { data: files, isLoading, error: listError } = useQuery({
    queryKey: ['storage-files', bucket, path],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(bucket).list(path)
      if (error) throw error
      return data?.filter(f => f.name && !f.name.startsWith('.')) ?? []
    },
  })

  // Generate signed URL for the first file
  const file = files?.[0]
  const filePath = file ? `${path}/${file.name}` : null

  const { data: signedUrl } = useQuery({
    queryKey: ['signed-url', bucket, filePath],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath!, 3600)
      if (error) throw error
      return data.signedUrl
    },
    enabled: !!filePath,
  })

  // Preview content for text files
  const { data: textContent } = useQuery({
    queryKey: ['file-text', bucket, filePath],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(bucket).download(filePath!)
      if (error) throw error
      return await data.text()
    },
    enabled: !!filePath && previewing && (file?.name?.endsWith('.txt') || file?.name?.endsWith('.csv')),
  })

  if (isLoading) {
    return <div className="border border-gray-200 rounded-lg p-3 animate-pulse h-12" />
  }

  if (listError || !files || files.length === 0) {
    return (
      <div className="border border-dashed border-gray-200 rounded-lg p-3 flex items-center gap-2 text-gray-400">
        <AlertTriangle className="w-4 h-4" />
        <span className="text-xs">{label ? `${label}: ` : ''}No file found</span>
      </div>
    )
  }

  const fileName = file!.name
  const fileSize = file!.metadata?.size ? `${Math.round(file!.metadata.size / 1024)} KB` : ''
  const isText = fileName.endsWith('.txt') || fileName.endsWith('.csv')
  const isPdf = fileName.endsWith('.pdf')
  const isImage = /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(fileName)
  const canPreview = isText || isPdf || isImage

  async function handleDownload() {
    if (!signedUrl) return
    // Audit log (fire and forget)
    supabase.from('audit_log').insert({
      actor_id: null,
      action: 'file_downloaded',
      entity_type: 'storage',
      entity_id: filePath!,
      details: { bucket, filename: fileName },
    }).then(() => {})

    const a = document.createElement('a')
    a.href = signedUrl
    a.download = fileName
    a.click()
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${accent ? 'border-gray-900' : 'border-gray-200'}`}>
      <div className={`flex items-center justify-between p-3 ${accent ? 'bg-gray-900 text-white' : 'bg-white'}`}>
        <div className="flex items-center gap-2 min-w-0">
          <FileText className={`w-4 h-4 shrink-0 ${accent ? 'text-gray-300' : 'text-gray-400'}`} />
          <div className="min-w-0">
            {label && <p className={`text-xs font-medium ${accent ? 'text-gray-300' : 'text-gray-500'}`}>{label}</p>}
            <p className={`text-sm truncate ${accent ? 'text-white' : 'text-gray-900'}`}>{fileName}</p>
            {fileSize && <p className={`text-[10px] ${accent ? 'text-gray-400' : 'text-gray-400'}`}>{fileSize}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {canPreview && showPreview && (
            <button onClick={() => setPreviewing(!previewing)}
              className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${accent ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}>
              <Eye className="w-3 h-3" /> {previewing ? 'Close' : 'Preview'}
            </button>
          )}
          <button onClick={handleDownload} disabled={!signedUrl}
            className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
              accent ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-gray-900 text-white hover:bg-gray-800'
            } disabled:opacity-50`}>
            <Download className="w-3 h-3" /> Download
          </button>
        </div>
      </div>

      {/* Inline preview */}
      {previewing && (
        <div className="border-t border-gray-200 bg-gray-50 max-h-96 overflow-auto">
          {isText && textContent && (
            <pre className="p-4 text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">{textContent}</pre>
          )}
          {isText && !textContent && (
            <div className="p-4 text-xs text-gray-400 animate-pulse">Loading preview...</div>
          )}
          {isPdf && signedUrl && (
            <iframe src={signedUrl} className="w-full h-96 border-0" title="PDF preview" />
          )}
          {isImage && signedUrl && (
            <img src={signedUrl} alt={fileName} className="max-w-full h-auto p-4" />
          )}
          {!isText && !isPdf && !isImage && (
            <div className="p-4 text-xs text-gray-400">Preview not available — download to view</div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Lists all files at a storage path and renders FileViewer for each.
 */
export function FileList({ bucket, path, label, accent }: { bucket: string; path: string; label?: string; accent?: boolean }) {
  return <FileViewer bucket={bucket} path={path} label={label} accent={accent} />
}
