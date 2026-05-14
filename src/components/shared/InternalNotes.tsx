import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Lock, Pin, MessageSquare, Reply, Trash2, Edit3 } from 'lucide-react'

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  admin: { bg: '#11182720', color: '#111827' },
  reviewer: { bg: '#0F8F4D20', color: '#0F8F4D' },
  salesperson: { bg: '#8E288220', color: '#8E2882' },
}

interface InternalNotesProps {
  jobId: string
  readOnly?: boolean
}

export function InternalNotes({ jobId, readOnly }: InternalNotesProps) {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const [newNote, setNewNote] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const { data: notes, isLoading } = useQuery({
    queryKey: ['internal-notes', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_internal_notes')
        .select('*, author:profiles!job_internal_notes_author_id_fkey(id, full_name, role)')
        .eq('job_id', jobId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const addNoteMutation = useMutation({
    mutationFn: async (opts: { body: string; parentId?: string }) => {
      // Extract @mentions (simple pattern: look for known names)
      const { error } = await supabase.from('job_internal_notes').insert({
        job_id: jobId,
        author_id: profile!.id,
        body: opts.body,
        parent_note_id: opts.parentId || null,
        is_demo: sessionStorage.getItem('vera_demo_mode') === 'true',
      })
      if (error) throw error

      await supabase.from('audit_log').insert({
        actor_id: profile!.id, action: 'internal_note_added', entity_type: 'job', entity_id: jobId,
        details: { body_preview: opts.body.substring(0, 50), is_reply: !!opts.parentId },
        is_demo: sessionStorage.getItem('vera_demo_mode') === 'true',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-notes', jobId] })
      setNewNote('')
      setReplyText('')
      setReplyingTo(null)
    },
  })

  const pinMutation = useMutation({
    mutationFn: async ({ noteId, pinned }: { noteId: string; pinned: boolean }) => {
      await supabase.from('job_internal_notes').update({ is_pinned: pinned }).eq('id', noteId)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['internal-notes', jobId] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      await supabase.from('job_internal_notes').delete().eq('id', noteId)
      await supabase.from('audit_log').insert({
        actor_id: profile!.id, action: 'internal_note_deleted', entity_type: 'job_internal_note', entity_id: noteId,
        is_demo: sessionStorage.getItem('vera_demo_mode') === 'true',
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['internal-notes', jobId] }),
  })

  const editMutation = useMutation({
    mutationFn: async ({ noteId, body }: { noteId: string; body: string }) => {
      await supabase.from('job_internal_notes').update({ body }).eq('id', noteId)
      await supabase.from('audit_log').insert({
        actor_id: profile!.id, action: 'internal_note_edited', entity_type: 'job_internal_note', entity_id: noteId,
        details: { new_body_preview: body.substring(0, 50) },
        is_demo: sessionStorage.getItem('vera_demo_mode') === 'true',
      })
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['internal-notes', jobId] }); setEditingId(null) },
  })

  // Separate top-level and replies
  const topLevel = notes?.filter(n => !n.parent_note_id) ?? []
  const replies = notes?.filter(n => n.parent_note_id) ?? []
  const repliesByParent: Record<string, typeof notes> = {}
  replies.forEach(r => {
    if (!repliesByParent[r.parent_note_id!]) repliesByParent[r.parent_note_id!] = []
    repliesByParent[r.parent_note_id!]!.push(r)
  })

  function canEdit(note: { author_id: string; created_at: string }) {
    if (profile?.role === 'admin') return true
    if (note.author_id !== profile?.id) return false
    const created = new Date(note.created_at)
    return (Date.now() - created.getTime()) < 24 * 60 * 60 * 1000
  }

  if (isLoading) return <div className="h-24 animate-pulse bg-amber-50/50 rounded-lg" />

  return (
    <div className="bg-amber-50/30 border border-amber-200/50 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 bg-amber-100/40 border-b border-amber-200/30 flex items-center gap-2">
        <Lock className="w-3.5 h-3.5 text-amber-700" />
        <span className="text-xs font-medium text-amber-800">Internal notes — never visible to client</span>
      </div>

      <div className="p-4 space-y-3">
        {/* Add note */}
        {!readOnly && (
          <div>
            <textarea
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="Add an internal note..."
              className="w-full border border-amber-200/60 rounded px-3 py-2 text-sm h-16 bg-white focus:outline-none focus:border-amber-400 resize-none"
            />
            <div className="flex justify-end mt-1">
              <button
                onClick={() => addNoteMutation.mutate({ body: newNote })}
                disabled={!newNote.trim() || addNoteMutation.isPending}
                className="text-xs bg-gray-900 text-white rounded px-3 py-1.5 hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1"
              >
                <MessageSquare className="w-3 h-3" /> {addNoteMutation.isPending ? 'Posting...' : 'Post note'}
              </button>
            </div>
          </div>
        )}

        {/* Notes feed */}
        {topLevel.length === 0 && (
          <p className="text-xs text-amber-600/60 text-center py-2">No internal notes yet.</p>
        )}

        {topLevel.map(note => {
          const author = note.author as { id: string; full_name: string; role: string }
          const rc = ROLE_COLORS[author?.role] ?? ROLE_COLORS.admin
          const isEditing = editingId === note.id
          const noteReplies = repliesByParent[note.id] ?? []

          return (
            <div key={note.id} className={`${note.is_pinned ? 'border-l-2 border-amber-400 pl-3' : ''}`}>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-medium shrink-0 mt-0.5">
                  {author?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-gray-900">{author?.full_name}</span>
                    <span className="text-[10px] px-1 py-0.5 rounded" style={{ background: rc.bg, color: rc.color }}>{author?.role}</span>
                    {note.is_pinned && <Pin className="w-3 h-3 text-amber-500" />}
                    <span className="text-[10px] text-gray-400">{new Date(note.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {isEditing ? (
                    <div className="mt-1">
                      <textarea value={editText} onChange={e => setEditText(e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1 text-sm h-14 focus:outline-none focus:border-gray-400" />
                      <div className="flex gap-1 mt-1">
                        <button onClick={() => editMutation.mutate({ noteId: note.id, body: editText })} className="text-[10px] bg-gray-900 text-white rounded px-2 py-0.5">Save</button>
                        <button onClick={() => setEditingId(null)} className="text-[10px] text-gray-500">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{note.body}</p>
                  )}

                  {/* Actions */}
                  {!readOnly && !isEditing && (
                    <div className="flex items-center gap-2 mt-1">
                      <button onClick={() => { setReplyingTo(note.id); setReplyText('') }} className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-0.5"><Reply className="w-3 h-3" /> Reply</button>
                      {profile?.role === 'admin' && (
                        <button onClick={() => pinMutation.mutate({ noteId: note.id, pinned: !note.is_pinned })} className="text-[10px] text-gray-400 hover:text-amber-600 flex items-center gap-0.5">
                          <Pin className="w-3 h-3" /> {note.is_pinned ? 'Unpin' : 'Pin'}
                        </button>
                      )}
                      {canEdit(note) && (
                        <>
                          <button onClick={() => { setEditingId(note.id); setEditText(note.body) }} className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-0.5"><Edit3 className="w-3 h-3" /> Edit</button>
                          <button onClick={() => { if (confirm('Delete this note?')) deleteMutation.mutate(note.id) }} className="text-[10px] text-gray-400 hover:text-red-600 flex items-center gap-0.5"><Trash2 className="w-3 h-3" /> Delete</button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Reply form */}
                  {replyingTo === note.id && (
                    <div className="mt-2 ml-4 border-l-2 border-gray-200 pl-2">
                      <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Reply..." className="w-full border border-gray-200 rounded px-2 py-1 text-xs h-10 focus:outline-none focus:border-gray-400" />
                      <div className="flex gap-1 mt-1">
                        <button onClick={() => addNoteMutation.mutate({ body: replyText, parentId: note.id })} disabled={!replyText.trim()} className="text-[10px] bg-gray-900 text-white rounded px-2 py-0.5 disabled:opacity-50">Reply</button>
                        <button onClick={() => setReplyingTo(null)} className="text-[10px] text-gray-500">Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* Threaded replies */}
                  {noteReplies.length > 0 && (
                    <div className="mt-2 ml-4 border-l-2 border-gray-100 pl-3 space-y-2">
                      {noteReplies.map(reply => {
                        const rAuthor = reply.author as { full_name: string; role: string }
                        const rrc = ROLE_COLORS[rAuthor?.role] ?? ROLE_COLORS.admin
                        return (
                          <div key={reply.id}>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-medium text-gray-700">{rAuthor?.full_name}</span>
                              <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: rrc.bg, color: rrc.color }}>{rAuthor?.role}</span>
                              <span className="text-[10px] text-gray-400">{new Date(reply.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-xs text-gray-600 mt-0.5">{reply.body}</p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
