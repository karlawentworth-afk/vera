/**
 * Seeds realistic segments for all jobs that don't have them.
 * Run: npx tsx scripts/seed-segments.ts
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Realistic source segments by content type
const SEGMENTS: Record<string, { source: string; ai: string }[]> = {
  'Compliance documentation': [
    { source: 'All personnel must complete mandatory safety training before accessing restricted areas of the facility.', ai: 'Alle Mitarbeiter müssen die obligatorische Sicherheitsschulung absolvieren, bevor sie die gesperrten Bereiche der Einrichtung betreten.' },
    { source: 'The fire suppression line indicates the maximum permitted loading height for cargo. Crews must verify this marker is unobstructed before sealing the hold.', ai: 'Die Brandschutzlinie gibt die maximal zulässige Beladungshöhe für Fracht an. Die Besatzung muss diese Markierung vor dem Verschließen des Laderaums überprüfen.' },
    { source: 'Non-compliance with these procedures may result in regulatory penalties and suspension of operating certificates.', ai: 'Die Nichteinhaltung dieser Verfahren kann zu behördlichen Strafen und der Aussetzung von Betriebsgenehmigungen führen.' },
    { source: 'Emergency evacuation routes must be clearly marked and free of obstructions at all times.', ai: 'Notevakuierungswege müssen jederzeit deutlich gekennzeichnet und frei von Hindernissen sein.' },
    { source: 'Quarterly audits will be conducted to ensure ongoing compliance with all applicable regulations.', ai: 'Vierteljährliche Audits werden durchgeführt, um die fortlaufende Einhaltung aller geltenden Vorschriften sicherzustellen.' },
    { source: 'Document all incidents within 24 hours using the standardised reporting form available on the compliance portal.', ai: 'Dokumentieren Sie alle Vorfälle innerhalb von 24 Stunden unter Verwendung des standardisierten Meldeformulars, das auf dem Compliance-Portal verfügbar ist.' },
  ],
  'Marketing campaign': [
    { source: 'Discover a world of possibilities with our award-winning service, designed for discerning travellers who expect nothing but the best.', ai: 'Découvrez un monde de possibilités avec notre service primé, conçu pour les voyageurs exigeants qui n\'acceptent que le meilleur.' },
    { source: 'Our commitment to excellence has earned us recognition as the industry leader for three consecutive years.', ai: 'Notre engagement envers l\'excellence nous a valu la reconnaissance en tant que leader du secteur pendant trois années consécutives.' },
    { source: 'Join thousands of satisfied customers who have made the switch to a smarter, more sustainable approach.', ai: 'Rejoignez des milliers de clients satisfaits qui ont adopté une approche plus intelligente et plus durable.' },
    { source: 'Limited-time offer: upgrade your experience today and enjoy exclusive benefits reserved for our premium members.', ai: 'Offre limitée dans le temps : améliorez votre expérience aujourd\'hui et profitez d\'avantages exclusifs réservés à nos membres premium.' },
    { source: 'From our family to yours, we bring quality, reliability, and innovation to every interaction.', ai: 'De notre famille à la vôtre, nous apportons qualité, fiabilité et innovation à chaque interaction.' },
  ],
  'Training materials': [
    { source: 'Welcome to Module 3: Emergency Procedures. In this session, you will learn the correct protocols for handling in-flight emergencies.', ai: 'モジュール3へようこそ：緊急手順。このセッションでは、機内の緊急事態に対処するための正しいプロトコルを学びます。' },
    { source: 'Step 1: Assess the situation calmly and determine the severity level using the classification chart on page 12.', ai: 'ステップ1：状況を冷静に評価し、12ページの分類表を使用して重大度レベルを判断します。' },
    { source: 'All cabin crew must be able to demonstrate proficiency in these procedures during annual recertification.', ai: 'すべての客室乗務員は、年次再認定の際にこれらの手順の習熟度を示すことができなければなりません。' },
    { source: 'Practice exercise: Work through the scenario described below and record your actions in the response log.', ai: '練習演習：以下に記載されたシナリオを実行し、対応ログに行動を記録してください。' },
    { source: 'Key takeaway: Clear communication between crew members is the single most important factor in emergency response effectiveness.', ai: '重要なポイント：乗務員間の明確なコミュニケーションは、緊急対応の有効性において最も重要な要素です。' },
  ],
  'Customer communications': [
    { source: 'Dear valued customer, we are writing to inform you of important changes to our terms and conditions, effective from 1st January.', ai: 'Estimado cliente, le escribimos para informarle sobre cambios importantes en nuestros términos y condiciones, vigentes a partir del 1 de enero.' },
    { source: 'Your account has been upgraded to our premium tier, giving you access to enhanced features and priority support.', ai: 'Su cuenta ha sido actualizada a nuestro nivel premium, lo que le da acceso a funciones mejoradas y soporte prioritario.' },
    { source: 'We appreciate your continued loyalty and look forward to serving you in the coming year.', ai: 'Agradecemos su continua lealtad y esperamos poder atenderle en el próximo año.' },
    { source: 'If you have any questions about these changes, please do not hesitate to contact our dedicated support team.', ai: 'Si tiene alguna pregunta sobre estos cambios, no dude en ponerse en contacto con nuestro equipo de soporte dedicado.' },
    { source: 'Please review the attached summary document for a complete overview of what has changed and how it may affect your account.', ai: 'Por favor, revise el documento de resumen adjunto para obtener una visión completa de lo que ha cambiado y cómo puede afectar a su cuenta.' },
  ],
  'Technical documentation': [
    { source: 'The system architecture follows a microservices pattern with independent deployment capabilities for each component.', ai: 'Die Systemarchitektur folgt einem Microservices-Muster mit unabhängigen Bereitstellungsfähigkeiten für jede Komponente.' },
    { source: 'API endpoints require authentication via OAuth 2.0 bearer tokens with a maximum validity period of 3600 seconds.', ai: 'API-Endpunkte erfordern eine Authentifizierung über OAuth 2.0 Bearer-Token mit einer maximalen Gültigkeitsdauer von 3600 Sekunden.' },
    { source: 'Error handling follows the standard HTTP response code conventions. All 4xx errors include a descriptive error message in the response body.', ai: 'Die Fehlerbehandlung folgt den Standard-HTTP-Antwortcode-Konventionen. Alle 4xx-Fehler enthalten eine beschreibende Fehlermeldung im Antworttext.' },
    { source: 'Database migrations must be backward-compatible to support zero-downtime deployments in the production environment.', ai: 'Datenbankmigrationen müssen abwärtskompatibel sein, um Bereitstellungen ohne Ausfallzeiten in der Produktionsumgebung zu unterstützen.' },
  ],
  'Clinical summaries': [
    { source: 'The Phase III clinical trial enrolled 2,400 participants across 18 sites in 6 European countries over a 24-month period.', ai: 'L\'essai clinique de phase III a recruté 2 400 participants dans 18 sites de 6 pays européens sur une période de 24 mois.' },
    { source: 'Primary endpoint: statistically significant reduction in symptom severity (p<0.001) compared to placebo at week 12.', ai: 'Critère d\'évaluation principal : réduction statistiquement significative de la sévérité des symptômes (p<0,001) par rapport au placebo à la semaine 12.' },
    { source: 'Adverse events were consistent with the known safety profile. No new safety signals were identified during the monitoring period.', ai: 'Les événements indésirables étaient cohérents avec le profil de sécurité connu. Aucun nouveau signal de sécurité n\'a été identifié pendant la période de surveillance.' },
    { source: 'Patient-reported outcomes demonstrated meaningful improvements in quality of life measures across all treatment groups.', ai: 'Les résultats rapportés par les patients ont démontré des améliorations significatives des mesures de qualité de vie dans tous les groupes de traitement.' },
  ],
  'Legal disclaimers': [
    { source: 'This document constitutes a legally binding agreement between the parties identified herein, effective upon execution by authorised representatives.', ai: 'Ce document constitue un accord juridiquement contraignant entre les parties identifiées aux présentes, effectif dès son exécution par des représentants autorisés.' },
    { source: 'The information contained herein is confidential and proprietary. Unauthorised disclosure may result in civil and criminal penalties.', ai: 'Les informations contenues dans le présent document sont confidentielles et exclusives. La divulgation non autorisée peut entraîner des sanctions civiles et pénales.' },
    { source: 'All warranties, whether express or implied, are hereby disclaimed to the maximum extent permitted by applicable law.', ai: 'Toutes les garanties, qu\'elles soient expresses ou implicites, sont par la présente déclinées dans toute la mesure permise par la loi applicable.' },
  ],
  'Website content': [
    { source: 'About Us: We are a leading provider of innovative solutions, trusted by organisations across 40 countries worldwide.', ai: 'Sobre nosotros: Somos un proveedor líder de soluciones innovadoras, en el que confían organizaciones de 40 países de todo el mundo.' },
    { source: 'Our team of experts brings decades of combined experience to every project, ensuring results that exceed expectations.', ai: 'Nuestro equipo de expertos aporta décadas de experiencia combinada a cada proyecto, asegurando resultados que superan las expectativas.' },
    { source: 'Contact us today for a free consultation and discover how we can transform your business operations.', ai: 'Contáctenos hoy para una consulta gratuita y descubra cómo podemos transformar sus operaciones comerciales.' },
    { source: 'Privacy Policy: We take your data protection seriously. Read our comprehensive privacy policy to understand how we handle your information.', ai: 'Política de privacidad: Nos tomamos en serio la protección de sus datos. Lea nuestra política de privacidad completa para comprender cómo manejamos su información.' },
  ],
}

// Default segments for content types not in the map
const DEFAULT_SEGMENTS = [
  { source: 'This content has been prepared for professional review and verification by qualified linguists.', ai: 'Ce contenu a été préparé pour une révision professionnelle et une vérification par des linguistes qualifiés.' },
  { source: 'Please review all segments carefully, paying attention to terminology, tone, and cultural appropriateness.', ai: 'Veuillez examiner attentivement tous les segments, en prêtant attention à la terminologie, au ton et à l\'adéquation culturelle.' },
  { source: 'Any concerns should be flagged using the severity indicators provided alongside each segment.', ai: 'Toute préoccupation doit être signalée à l\'aide des indicateurs de gravité fournis à côté de chaque segment.' },
  { source: 'The verified output will form part of the permanent audit trail for this translation project.', ai: 'Le résultat vérifié fera partie du registre d\'audit permanent de ce projet de traduction.' },
]

async function seed() {
  console.log('Seeding segments for all jobs...\n')

  // Get all jobs
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, content_type')
    .order('submitted_at')

  if (error) throw error

  // Get jobs that already have segments
  const { data: existingSegments } = await supabase
    .from('job_segments')
    .select('job_id')

  const jobsWithSegments = new Set(existingSegments?.map(s => s.job_id) ?? [])

  let created = 0
  let skipped = 0

  for (const job of jobs ?? []) {
    if (jobsWithSegments.has(job.id)) {
      skipped++
      continue
    }

    const templateSegments = SEGMENTS[job.content_type] ?? DEFAULT_SEGMENTS
    // Pick 3-6 segments randomly
    const count = Math.min(templateSegments.length, 3 + Math.floor(Math.random() * 4))
    const selected = [...templateSegments].sort(() => Math.random() - 0.5).slice(0, count)

    const segments = selected.map((seg, i) => ({
      job_id: job.id,
      segment_index: i,
      source_text: seg.source,
      ai_translation: seg.ai,
      reviewer_translation: null,
      severity: null,
      edited: false,
    }))

    const { error: insertErr } = await supabase.from('job_segments').insert(segments)
    if (insertErr) {
      console.log(`  Error for job ${job.id}: ${insertErr.message}`)
    } else {
      created += segments.length
    }
  }

  console.log(`Done. ${created} segments created across ${(jobs?.length ?? 0) - skipped} jobs. ${skipped} jobs already had segments.`)
}

seed().catch(console.error)
