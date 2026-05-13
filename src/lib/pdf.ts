import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const RAINBOW = ['#E5187A', '#8E2882', '#1B4F9E', '#1FA1D6', '#0F8F4D', '#F4D31E', '#EE7C24', '#D9211E']

function addHeader(doc: jsPDF, title: string, subtitle?: string) {
  // Rainbow stripe
  const stripeW = doc.internal.pageSize.getWidth() / RAINBOW.length
  RAINBOW.forEach((color, i) => {
    doc.setFillColor(color)
    doc.rect(i * stripeW, 0, stripeW + 0.5, 4, 'F')
  })

  // Logo text
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(24)
  doc.setTextColor('#111827')
  doc.text('vera', 20, 22)

  // Title
  doc.setFontSize(16)
  doc.text(title, 20, 35)

  if (subtitle) {
    doc.setFontSize(10)
    doc.setTextColor('#6B7280')
    doc.text(subtitle, 20, 43)
  }

  doc.setTextColor('#111827')
  return 50
}

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    const h = doc.internal.pageSize.getHeight()
    const w = doc.internal.pageSize.getWidth()
    doc.setFontSize(8)
    doc.setTextColor('#9CA3AF')
    doc.text(`Vera — Human-verified AI translation governance | Generated ${new Date().toLocaleDateString('en-GB')} | Page ${i} of ${pageCount} | Confidential`, w / 2, h - 10, { align: 'center' })
  }
}

// ============================================================
// Client Audit Report
// ============================================================

export function generateClientAuditPdf(data: {
  orgName: string
  healthScore: number | null
  avgHter: number | null
  totalJobs: number
  totalWords: number
  langPairs: { pair: string; hter: number; words: number; status: string }[]
  toolPerf: { tool: string; hter: number; words: number }[]
  jobs: { ref: string; date: string; type: string; lang: string; reviewer: string; hter: string; status: string }[]
}) {
  const doc = new jsPDF()
  let y = addHeader(doc, `AI Health & Audit Report`, `${data.orgName} · ${new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`)

  // Summary
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Summary', 20, y)
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const summary = [
    ['AI Health Score', data.healthScore !== null ? `${data.healthScore}/100` : 'N/A'],
    ['Average hTER', data.avgHter !== null ? data.avgHter.toFixed(3) : 'N/A'],
    ['Jobs reviewed', String(data.totalJobs)],
    ['Words reviewed', data.totalWords.toLocaleString()],
  ]
  summary.forEach(([label, value]) => {
    doc.setTextColor('#6B7280')
    doc.text(label, 20, y)
    doc.setTextColor('#111827')
    doc.text(value, 80, y)
    y += 6
  })
  y += 8

  // Language pairs
  if (data.langPairs.length > 0) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor('#111827')
    doc.text('Performance by Language Pair', 20, y)
    y += 4

    autoTable(doc, {
      startY: y,
      head: [['Language Pair', 'Avg hTER', 'Words', 'Status']],
      body: data.langPairs.map(lp => [lp.pair, lp.hter.toFixed(3), lp.words.toLocaleString(), lp.status]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: '#111827', textColor: '#ffffff' },
      margin: { left: 20, right: 20 },
    })
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  }

  // AI tools
  if (data.toolPerf.length > 0) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor('#111827')
    doc.text('Performance by AI Tool', 20, y)
    y += 4

    autoTable(doc, {
      startY: y,
      head: [['AI Tool', 'Avg hTER', 'Words']],
      body: data.toolPerf.map(t => [t.tool, t.hter.toFixed(3), t.words.toLocaleString()]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: '#111827', textColor: '#ffffff' },
      margin: { left: 20, right: 20 },
    })
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  }

  // Audit trail
  if (data.jobs.length > 0) {
    if (y > 220) { doc.addPage(); y = 20 }
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor('#111827')
    doc.text('Audit Trail', 20, y)
    y += 4

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Ref', 'Type', 'Languages', 'Reviewer', 'hTER', 'Status']],
      body: data.jobs.map(j => [j.date, j.ref, j.type, j.lang, j.reviewer, j.hter, j.status]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: '#111827', textColor: '#ffffff' },
      margin: { left: 20, right: 20 },
    })
  }

  addFooter(doc)
  doc.save(`vera-audit-report-${data.orgName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`)
}

// ============================================================
// Audit Log PDF
// ============================================================

export function generateAuditLogPdf(data: {
  filters: string
  entries: { timestamp: string; actor: string; role: string; action: string; entity: string; summary: string }[]
}) {
  const doc = new jsPDF('landscape')
  let y = addHeader(doc, 'Audit Log Export', `Filters: ${data.filters} · ${data.entries.length} entries`)

  autoTable(doc, {
    startY: y,
    head: [['Timestamp', 'Actor', 'Role', 'Action', 'Entity', 'Summary']],
    body: data.entries.map(e => [e.timestamp, e.actor, e.role, e.action, e.entity, e.summary]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: '#111827', textColor: '#ffffff' },
    margin: { left: 15, right: 15 },
    columnStyles: { 5: { cellWidth: 80 } },
  })

  addFooter(doc)
  doc.save(`vera-audit-log-${new Date().toISOString().split('T')[0]}.pdf`)
}
