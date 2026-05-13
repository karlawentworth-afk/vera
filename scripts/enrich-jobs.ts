/**
 * Enriches all demo jobs with:
 * - More segments (10-20 per job, replacing existing 3-6)
 * - Pre-flight data on scored jobs
 * - Delivered files for completed jobs
 * - Richer reviewer notes on scores
 * Run: npx tsx scripts/enrich-jobs.ts
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }

// ============================================================
// Segment pools by content type — much larger now
// ============================================================
const SEGMENT_POOLS: Record<string, Array<{ src: string; ai: string }>> = {
  'Compliance documentation': [
    { src: 'All personnel must complete mandatory safety training before accessing restricted areas of the facility.', ai: 'Alle Mitarbeiter müssen die obligatorische Sicherheitsschulung absolvieren, bevor sie die gesperrten Bereiche der Einrichtung betreten.' },
    { src: 'The fire suppression line indicates the maximum permitted loading height for cargo.', ai: 'Die Brandschutzlinie gibt die maximal zulässige Beladungshöhe für Fracht an.' },
    { src: 'Non-compliance with these procedures may result in regulatory penalties and suspension of operating certificates.', ai: 'Die Nichteinhaltung dieser Verfahren kann zu behördlichen Strafen und der Aussetzung von Betriebsgenehmigungen führen.' },
    { src: 'Emergency evacuation routes must be clearly marked and free of obstructions at all times.', ai: 'Notevakuierungswege müssen jederzeit deutlich gekennzeichnet und frei von Hindernissen sein.' },
    { src: 'Quarterly audits will be conducted to ensure ongoing compliance with all applicable regulations.', ai: 'Vierteljährliche Audits werden durchgeführt, um die fortlaufende Einhaltung aller geltenden Vorschriften sicherzustellen.' },
    { src: 'Document all incidents within 24 hours using the standardised reporting form.', ai: 'Dokumentieren Sie alle Vorfälle innerhalb von 24 Stunden unter Verwendung des standardisierten Meldeformulars.' },
    { src: 'Personal protective equipment must be worn at all times in designated hazardous zones.', ai: 'Persönliche Schutzausrüstung muss jederzeit in ausgewiesenen Gefahrenzonen getragen werden.' },
    { src: 'The responsible supervisor must sign off on all safety inspections before operations resume.', ai: 'Der zuständige Vorgesetzte muss alle Sicherheitsinspektionen genehmigen, bevor der Betrieb wieder aufgenommen wird.' },
    { src: 'Access to controlled substances requires dual authorisation from qualified personnel.', ai: 'Der Zugang zu kontrollierten Substanzen erfordert eine doppelte Genehmigung durch qualifiziertes Personal.' },
    { src: 'Environmental monitoring stations must be calibrated weekly according to ISO 14001 standards.', ai: 'Umweltüberwachungsstationen müssen wöchentlich gemäß ISO 14001 kalibriert werden.' },
    { src: 'All subcontractors must complete the site induction programme before commencing work.', ai: 'Alle Subunternehmer müssen das Standorteinweisungsprogramm abschließen, bevor sie mit der Arbeit beginnen.' },
    { src: 'Record retention periods for compliance documentation are set at seven years from the date of creation.', ai: 'Die Aufbewahrungsfristen für Compliance-Dokumentation betragen sieben Jahre ab dem Erstellungsdatum.' },
    { src: 'Any deviation from approved procedures must be reported to the compliance officer within four hours.', ai: 'Jede Abweichung von genehmigten Verfahren muss innerhalb von vier Stunden dem Compliance-Beauftragten gemeldet werden.' },
    { src: 'Risk assessments must be reviewed and updated whenever there is a material change to operations.', ai: 'Risikobewertungen müssen überprüft und aktualisiert werden, wenn es eine wesentliche Änderung des Betriebs gibt.' },
    { src: 'The organisation maintains a zero-tolerance policy towards bribery and corruption in all jurisdictions.', ai: 'Die Organisation verfolgt eine Null-Toleranz-Politik gegenüber Bestechung und Korruption in allen Rechtsordnungen.' },
  ],
  'Marketing campaign': [
    { src: 'Discover a world of possibilities with our award-winning service, designed for discerning travellers.', ai: 'Découvrez un monde de possibilités avec notre service primé, conçu pour les voyageurs exigeants.' },
    { src: 'Our commitment to excellence has earned us recognition as the industry leader for three consecutive years.', ai: 'Notre engagement envers l\'excellence nous a valu la reconnaissance en tant que leader du secteur.' },
    { src: 'Join thousands of satisfied customers who have made the switch to a smarter approach.', ai: 'Rejoignez des milliers de clients satisfaits qui ont adopté une approche plus intelligente.' },
    { src: 'Limited-time offer: upgrade your experience today and enjoy exclusive benefits.', ai: 'Offre limitée : améliorez votre expérience aujourd\'hui et profitez d\'avantages exclusifs.' },
    { src: 'From our family to yours, we bring quality, reliability, and innovation to every interaction.', ai: 'De notre famille à la vôtre, nous apportons qualité, fiabilité et innovation à chaque interaction.' },
    { src: 'Experience the difference that genuine craftsmanship makes in every detail of your journey.', ai: 'Découvrez la différence que fait un véritable savoir-faire dans chaque détail de votre voyage.' },
    { src: 'Our sustainability commitment means every choice we make considers the planet alongside the passenger.', ai: 'Notre engagement en matière de développement durable signifie que chaque choix que nous faisons tient compte de la planète.' },
    { src: 'Premium lounges now available in twelve major international airports across three continents.', ai: 'Des salons premium sont désormais disponibles dans douze grands aéroports internationaux sur trois continents.' },
    { src: 'Book before midnight to secure our early-bird pricing with complimentary seat upgrade.', ai: 'Réservez avant minuit pour bénéficier de notre tarif early-bird avec surclassement de siège offert.' },
    { src: 'Your feedback shapes our future — tell us what matters most to you.', ai: 'Vos commentaires façonnent notre avenir — dites-nous ce qui compte le plus pour vous.' },
    { src: 'We believe travel should enrich lives, broaden perspectives, and create lasting memories.', ai: 'Nous croyons que le voyage devrait enrichir les vies, élargir les perspectives et créer des souvenirs durables.' },
    { src: 'Award-winning customer service available 24/7 in fourteen languages across all time zones.', ai: 'Service client primé disponible 24h/24, 7j/7 en quatorze langues dans tous les fuseaux horaires.' },
  ],
  'Training materials': [
    { src: 'Welcome to Module 3: Emergency Procedures. In this session, you will learn correct protocols.', ai: 'モジュール3へようこそ：緊急手順。このセッションでは、正しいプロトコルを学びます。' },
    { src: 'Step 1: Assess the situation calmly and determine the severity level.', ai: 'ステップ1：状況を冷静に評価し、重大度レベルを判断します。' },
    { src: 'All cabin crew must demonstrate proficiency during annual recertification.', ai: 'すべての客室乗務員は、年次再認定の際に習熟度を示す必要があります。' },
    { src: 'Practice exercise: Work through the scenario and record your actions in the response log.', ai: '練習演習：シナリオを実行し、対応ログに行動を記録してください。' },
    { src: 'Clear communication between crew members is the most important factor in emergency response.', ai: '乗務員間の明確なコミュニケーションは、緊急対応において最も重要な要素です。' },
    { src: 'Review the decision tree on page 14 before attempting the assessment questions.', ai: '評価質問に取り組む前に、14ページの意思決定ツリーを確認してください。' },
    { src: 'Successful completion requires a minimum score of 85% on the practical assessment.', ai: '合格には、実技評価で最低85%のスコアが必要です。' },
    { src: 'This module should take approximately 45 minutes including the simulation exercise.', ai: 'このモジュールは、シミュレーション演習を含めて約45分かかります。' },
    { src: 'Refer to the quick reference card attached to the back of your training manual.', ai: 'トレーニングマニュアルの裏に添付されているクイックリファレンスカードを参照してください。' },
    { src: 'Debrief with your supervisor after completing the scenario to discuss lessons learned.', ai: 'シナリオ完了後、学んだ教訓について上司とデブリーフィングを行ってください。' },
    { src: 'The competency framework outlines five levels of proficiency from novice to expert.', ai: '能力フレームワークは、初心者からエキスパートまでの5つの習熟レベルを概説しています。' },
  ],
  'Customer communications': [
    { src: 'Dear valued customer, we are writing to inform you of important changes to our terms.', ai: 'Estimado cliente, le escribimos para informarle sobre cambios importantes en nuestros términos.' },
    { src: 'Your account has been upgraded to our premium tier with enhanced features.', ai: 'Su cuenta ha sido actualizada a nuestro nivel premium con funciones mejoradas.' },
    { src: 'We appreciate your continued loyalty and look forward to serving you.', ai: 'Agradecemos su continua lealtad y esperamos poder atenderle.' },
    { src: 'If you have any questions, please do not hesitate to contact our support team.', ai: 'Si tiene alguna pregunta, no dude en ponerse en contacto con nuestro equipo de soporte.' },
    { src: 'Please review the attached summary for a complete overview of changes.', ai: 'Por favor, revise el resumen adjunto para una visión completa de los cambios.' },
    { src: 'Your monthly statement is now available for download in your account portal.', ai: 'Su extracto mensual ya está disponible para descarga en su portal de cuenta.' },
    { src: 'We have detected unusual activity on your account and recommend updating your security settings.', ai: 'Hemos detectado actividad inusual en su cuenta y recomendamos actualizar su configuración de seguridad.' },
    { src: 'As a valued member, you are invited to our exclusive preview event on 15th November.', ai: 'Como miembro valioso, está invitado a nuestro evento exclusivo de presentación el 15 de noviembre.' },
    { src: 'Your recent feedback has been shared with our product team for consideration.', ai: 'Sus comentarios recientes han sido compartidos con nuestro equipo de producto para su consideración.' },
    { src: 'We are pleased to confirm your appointment has been scheduled for the requested date.', ai: 'Nos complace confirmar que su cita ha sido programada para la fecha solicitada.' },
    { src: 'Please ensure your contact details are up to date to continue receiving important notifications.', ai: 'Asegúrese de que sus datos de contacto estén actualizados para seguir recibiendo notificaciones importantes.' },
  ],
  'Technical documentation': [
    { src: 'The system architecture follows a microservices pattern with independent deployment.', ai: 'Die Systemarchitektur folgt einem Microservices-Muster mit unabhängiger Bereitstellung.' },
    { src: 'API endpoints require authentication via OAuth 2.0 bearer tokens.', ai: 'API-Endpunkte erfordern eine Authentifizierung über OAuth 2.0 Bearer-Token.' },
    { src: 'Error handling follows standard HTTP response code conventions.', ai: 'Die Fehlerbehandlung folgt den Standard-HTTP-Antwortcode-Konventionen.' },
    { src: 'Database migrations must be backward-compatible for zero-downtime deployments.', ai: 'Datenbankmigrationen müssen abwärtskompatibel sein für Bereitstellungen ohne Ausfallzeiten.' },
    { src: 'The load balancer distributes traffic across three availability zones for redundancy.', ai: 'Der Load Balancer verteilt den Verkehr über drei Verfügbarkeitszonen für Redundanz.' },
    { src: 'Logging output is structured as JSON and forwarded to the centralised monitoring stack.', ai: 'Die Protokollausgabe ist als JSON strukturiert und wird an den zentralisierten Überwachungsstapel weitergeleitet.' },
    { src: 'Cache invalidation occurs automatically when the underlying data source is updated.', ai: 'Die Cache-Invalidierung erfolgt automatisch, wenn die zugrunde liegende Datenquelle aktualisiert wird.' },
    { src: 'Rate limiting is enforced at 1000 requests per minute per API key.', ai: 'Die Ratenbegrenzung wird bei 1000 Anfragen pro Minute pro API-Schlüssel durchgesetzt.' },
    { src: 'Webhook payloads include a cryptographic signature for verification by the receiving system.', ai: 'Webhook-Nutzlasten enthalten eine kryptographische Signatur zur Überprüfung durch das empfangende System.' },
    { src: 'Configuration values are injected via environment variables following twelve-factor app methodology.', ai: 'Konfigurationswerte werden über Umgebungsvariablen gemäß der Twelve-Factor-App-Methodik eingespeist.' },
  ],
  'Clinical summaries': [
    { src: 'The Phase III trial enrolled 2,400 participants across 18 sites in 6 European countries.', ai: 'L\'essai de phase III a recruté 2 400 participants dans 18 sites de 6 pays européens.' },
    { src: 'Primary endpoint: statistically significant reduction in symptom severity (p<0.001).', ai: 'Critère d\'évaluation principal : réduction statistiquement significative de la sévérité des symptômes (p<0,001).' },
    { src: 'Adverse events were consistent with the known safety profile.', ai: 'Les événements indésirables étaient cohérents avec le profil de sécurité connu.' },
    { src: 'Patient-reported outcomes demonstrated meaningful improvements in quality of life.', ai: 'Les résultats rapportés par les patients ont démontré des améliorations significatives de la qualité de vie.' },
    { src: 'The pharmacokinetic profile showed linear dose-response across all treatment arms.', ai: 'Le profil pharmacocinétique a montré une dose-réponse linéaire dans tous les bras de traitement.' },
    { src: 'Subgroup analysis by age, gender, and baseline severity confirmed consistency of treatment effect.', ai: 'L\'analyse par sous-groupes selon l\'âge, le sexe et la sévérité initiale a confirmé la cohérence de l\'effet du traitement.' },
    { src: 'The safety monitoring board recommended continuation without modification at the interim analysis.', ai: 'Le comité de surveillance de la sécurité a recommandé la poursuite sans modification lors de l\'analyse intermédiaire.' },
    { src: 'Biomarker levels normalised within 12 weeks in 78% of the active treatment group.', ai: 'Les niveaux de biomarqueurs se sont normalisés dans les 12 semaines chez 78% du groupe de traitement actif.' },
    { src: 'Concomitant medication use was permitted and documented throughout the study period.', ai: 'L\'utilisation de médicaments concomitants était autorisée et documentée tout au long de la période d\'étude.' },
    { src: 'The study protocol received ethics committee approval in all participating jurisdictions.', ai: 'Le protocole d\'étude a reçu l\'approbation du comité d\'éthique dans toutes les juridictions participantes.' },
  ],
}

// Default pool for unlisted content types
const DEFAULT_POOL = [
  { src: 'This content has been prepared for professional review by qualified linguists.', ai: 'Ce contenu a été préparé pour une révision professionnelle par des linguistes qualifiés.' },
  { src: 'Please review all segments carefully, paying attention to terminology and tone.', ai: 'Veuillez examiner attentivement tous les segments, en prêtant attention à la terminologie et au ton.' },
  { src: 'Any concerns should be flagged using the severity indicators provided.', ai: 'Toute préoccupation doit être signalée à l\'aide des indicateurs de gravité fournis.' },
  { src: 'The verified output will form part of the permanent audit trail.', ai: 'Le résultat vérifié fera partie du registre d\'audit permanent.' },
  { src: 'Quality standards require a minimum of two review passes before publication.', ai: 'Les normes de qualité exigent un minimum de deux passes de révision avant publication.' },
  { src: 'All terminology must align with the approved glossary for this client organisation.', ai: 'Toute la terminologie doit être conforme au glossaire approuvé pour cette organisation cliente.' },
  { src: 'Brand voice guidelines specify a formal, professional register for external communications.', ai: 'Les directives de la voix de marque spécifient un registre formel et professionnel pour les communications externes.' },
  { src: 'Cross-references to regulatory standards must be verified against the latest published versions.', ai: 'Les références croisées aux normes réglementaires doivent être vérifiées par rapport aux dernières versions publiées.' },
  { src: 'The target audience for this material is senior management with industry expertise.', ai: 'Le public cible de ce matériel est la direction générale ayant une expertise sectorielle.' },
  { src: 'Ensure numerical values, dates, and currency symbols are correctly localised for the target market.', ai: 'Assurez-vous que les valeurs numériques, les dates et les symboles monétaires sont correctement localisés pour le marché cible.' },
]

const REVIEWER_NOTES_POOL = [
  'Excellent output — near-publishable quality. Minor terminology adjustment in paragraph 3.',
  'Two terminology choices flagged for client glossary update. Otherwise clean AI output.',
  'Significant rework needed — tone registers consistently informal for this premium brand.',
  'Excellent output from Claude on regulated content. Near-publishable quality.',
  'Google Translate struggled with banking register. Multiple formal tone corrections needed.',
  'Strong DeepL output for technical content. One terminology correction per EASA standards.',
  'Brand voice issues — ChatGPT defaulted to conversational rather than professional register.',
  'Glossary alignment good. Two risk segments flagged for legal review.',
  'Clean medical terminology throughout. One consent language adjustment.',
  'Minor cultural adaptation needed for honorifics in training context.',
  'Literal translation produced awkward phrasing in three segments. Reworked for natural flow.',
  'All regulatory references verified against latest published standards. Two updates applied.',
  'Consistent quality across all segments. Recommend this tool for similar future content.',
  'Five segments required significant editing. Consider alternative AI tool for this language pair.',
  'Terminology accurate but register too formal for customer-facing content. Softened three segments.',
  'Numbers and currency symbols correctly localised. Date format corrected in two instances.',
  'Excellent adaptation of idiomatic expressions. Natural reading in target language.',
  'Three ambiguous source segments clarified with client before finalising translation.',
  'Brand tagline required creative adaptation rather than direct translation. Client approved alternative.',
  'Safety-critical content reviewed twice. All regulatory terminology verified against approved glossary.',
]

const SEVERITIES = ['fine', 'fine', 'fine', 'fine', 'minor', 'minor', 'major', null, null, null] as const

const PREFLIGHT_SUMMARIES = [
  'AI output generally strong. Minor terminology review recommended.',
  'Good quality output. Two glossary terms need verification.',
  'Moderate confidence. Register may need adjustment for client brand voice.',
  'Strong output from this AI tool on this content type. Minimal issues expected.',
  'Several segments flagged for review. Terminology consistency needs checking.',
  'High confidence output. One risk segment identified for legal review.',
  'Output quality varies by segment. Marketing phrases need creative review.',
  'Near-publishable quality. Recommend focusing review on technical terminology.',
]

async function enrich() {
  console.log('Enriching all demo jobs with richer content...\n')

  const { data: jobs } = await supabase.from('jobs').select('id, job_number, organisation_id, content_type, source_language, target_language, status, reviewer_id').order('submitted_at')
  if (!jobs) { console.log('No jobs found'); return }

  let segmentsCreated = 0
  let filesCreated = 0
  let preflightUpdated = 0
  let notesUpdated = 0

  for (const job of jobs) {
    // 1. Replace segments with richer content (10-18 per job)
    await supabase.from('job_segments').delete().eq('job_id', job.id)

    const pool = SEGMENT_POOLS[job.content_type] ?? DEFAULT_POOL
    const allPool = [...pool, ...DEFAULT_POOL]
    const count = rand(10, 18)
    const selected = Array.from({ length: count }, (_, i) => {
      const seg = allPool[i % allPool.length]
      const edited = Math.random() < 0.15 // 15% of segments get reviewer edits
      const severity = pick(SEVERITIES)
      return {
        job_id: job.id,
        segment_index: i,
        source_text: seg.src,
        ai_translation: seg.ai,
        reviewer_translation: edited ? seg.ai + ' [reviewed]' : null,
        reviewer_comment: edited ? pick(['Terminology adjusted per glossary.', 'Register corrected to formal.', 'Cultural reference adapted.', 'Minor phrasing improvement.']) : null,
        severity: edited ? (severity ?? 'minor') : severity,
        edited,
      }
    })

    await supabase.from('job_segments').insert(selected)
    segmentsCreated += selected.length

    // 2. Upload source file if missing
    const dir = `${job.organisation_id}/${job.id}/source`
    const { data: existingFiles } = await supabase.storage.from('job-files').list(dir)
    if (!existingFiles || existingFiles.length === 0) {
      const fileName = `${job.content_type.toLowerCase().replace(/\s+/g, '_')}_${job.source_language}_${job.target_language}.txt`
      const content = [
        `=== ${job.content_type} ===`,
        `Reference: ${job.job_number} | ${job.source_language} → ${job.target_language}`,
        '', '--- SOURCE ---', '',
        ...selected.map((s, i) => `[${i+1}] ${s.source_text}`),
        '', '--- AI TRANSLATION ---', '',
        ...selected.map((s, i) => `[${i+1}] ${s.ai_translation}`),
        '', '--- END ---',
      ].join('\n')
      const blob = new Blob([content], { type: 'text/plain' })
      await supabase.storage.from('job-files').upload(`${dir}/${fileName}`, blob, { contentType: 'text/plain', upsert: true })
      filesCreated++
    }

    // 3. Upload delivered file for completed jobs
    if (job.status === 'delivered') {
      const delDir = `${job.organisation_id}/${job.id}/delivered`
      const { data: delFiles } = await supabase.storage.from('job-files').list(delDir)
      if (!delFiles || delFiles.length === 0) {
        const fileName = `verified_${job.content_type.toLowerCase().replace(/\s+/g, '_')}_${job.target_language}.txt`
        const content = [
          `=== VERIFIED TRANSLATION ===`,
          `Reference: ${job.job_number} | Verified by Vera`,
          '',
          ...selected.map((s, i) => `[${i+1}] ${s.reviewer_translation ?? s.ai_translation}`),
          '', '--- Verified and signed off ---',
        ].join('\n')
        const blob = new Blob([content], { type: 'text/plain' })
        await supabase.storage.from('job-files').upload(`${delDir}/${fileName}`, blob, { contentType: 'text/plain', upsert: true })
        filesCreated++
      }
    }

    // 4. Add pre-flight data if missing and job has a reviewer
    if (job.reviewer_id && !['unallocated'].includes(job.status)) {
      const { data: existing } = await supabase.from('jobs').select('preflight_data').eq('id', job.id).single()
      if (!existing?.preflight_data) {
        const preflight = {
          confidence_score: rand(5, 9),
          summary: pick(PREFLIGHT_SUMMARIES),
          glossary_violations: Math.random() < 0.4 ? [
            { term: 'compliance', expected: 'Konformität', severity: pick(['low', 'medium', 'high']) },
          ] : [],
          risky_segments: Math.random() < 0.3 ? [
            { description: 'Regulatory reference needs verification', reason: 'Legal compliance', severity: pick(['medium', 'high']) },
          ] : [],
          brand_voice_issues: Math.random() < 0.25 ? [
            { description: 'Register slightly informal for client style guide', severity: 'medium' },
          ] : [],
        }
        await supabase.from('jobs').update({ preflight_data: preflight }).eq('id', job.id)
        preflightUpdated++
      }
    }

    // 5. Update reviewer notes on scores to be more varied
    if (['delivered', 'awaiting_signoff'].includes(job.status)) {
      const { data: score } = await supabase.from('scores').select('id, reviewer_notes').eq('job_id', job.id).maybeSingle()
      if (score && (!score.reviewer_notes || score.reviewer_notes.length < 30)) {
        await supabase.from('scores').update({ reviewer_notes: pick(REVIEWER_NOTES_POOL) }).eq('id', score.id)
        notesUpdated++
      }
    }

    if ((segmentsCreated / 14) % 10 === 0) process.stdout.write('.')
  }

  console.log(`\n\nDone.`)
  console.log(`  Segments: ${segmentsCreated} (across ${jobs.length} jobs)`)
  console.log(`  Files uploaded: ${filesCreated}`)
  console.log(`  Pre-flight data: ${preflightUpdated} jobs`)
  console.log(`  Reviewer notes enriched: ${notesUpdated}`)
}

enrich().catch(console.error)
