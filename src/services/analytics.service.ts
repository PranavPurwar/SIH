import { pgPool } from '../db/connection.js';
import { AppError } from '../lib/errors.js';
import type { EvaluatedSkill, JobSkillRequirement } from '../types/index.js';

interface AnalyticsApplicationRow {
  id: string;
  student_id: string;
  status: string;
}

interface AnalyticsStudentRow {
  id: string;
  name: string;
  email: string;
  degree: string;
  institution: string;
  parsed_skills?: string[];
  evaluated_skills?: EvaluatedSkill[];
  applications?: AnalyticsApplicationRow[];
}

interface AnalyticsJobRow {
  job_id: string;
  required_skills?: JobSkillRequirement[];
}

export interface CohortStudentSummary {
  id: string;
  name: string;
  email: string;
  degree: string;
  institution: string;
  parsed_skills: string[];
  readiness_pct: number;
  applications_count: number;
  latest_status: string;
}

export interface InstitutionAnalytics {
  institution_name: string;
  placement_readiness_pct: number;
  total_students: number;
  total_jobs: number;
  total_applications: number;
  placed_or_shortlisted_count: number;
  top_in_demand_skills: { skill: string; demand_count: number; avg_gap_pct: number }[];
  domain_competency_distribution: { domain: string; avg_score: number; student_count: number }[];
  hiring_funnel: {
    applied: number;
    under_review: number;
    shortlisted: number;
    selected: number;
    rejected: number;
  };
  cohort_students: CohortStudentSummary[];
}

export function getInstitutionSearchTerms(name: string): string[] {
  if (!name) return [];
  const terms = new Set<string>();
  const trimmed = name.trim();
  if (!trimmed) return [];

  terms.add(trimmed);

  // If name has an acronym or parenthesis e.g. "National Centre for Biological Sciences (NCBS)"
  const match = trimmed.match(/^(.*?)\s*\(([^)]+)\)/);
  if (match) {
    const fullName = match[1].trim();
    const acronym = match[2].trim();
    if (fullName) terms.add(fullName);
    if (acronym) terms.add(acronym);
  }

  return Array.from(terms);
}

interface SectorSkillDefinition {
  skill: string;
  demand_count: number;
  baseline_coverage: number;
  keywords: string[];
}

const SECTOR_SKILLS_MAP: Record<string, SectorSkillDefinition[]> = {
  biology: [
    { skill: 'Cryo-EM & Structural Refinement', demand_count: 8, baseline_coverage: 92, keywords: ['cryo-em', 'structural biology', 'relion', 'pymol'] },
    { skill: 'Single-Molecule Fluorescence Imaging', demand_count: 7, baseline_coverage: 88, keywords: ['fluorescence microscopy', 'single molecule', 'tirf'] },
    { skill: 'Cellular Biophysics', demand_count: 7, baseline_coverage: 94, keywords: ['cellular biophysics', 'biophysics', 'membrane dynamics'] },
    { skill: 'Bioimage Informatics & Segmentation', demand_count: 6, baseline_coverage: 84, keywords: ['bioimage', 'imagej', 'python', 'deep learning'] },
    { skill: 'Single-Cell RNA-seq (scRNA-seq)', demand_count: 5, baseline_coverage: 65, keywords: ['scrna-seq', 'transcriptomics', 'genomics'] },
    { skill: 'Next-Generation Sequencing (NGS)', demand_count: 5, baseline_coverage: 60, keywords: ['next-generation sequencing', 'ngs', 'bioinformatics'] },
    { skill: 'Molecular Dynamics Simulation', demand_count: 4, baseline_coverage: 78, keywords: ['molecular dynamics', 'gromacs', 'simulation'] },
    { skill: 'High-Throughput Screening Assays', demand_count: 4, baseline_coverage: 70, keywords: ['screening', 'biochemistry', 'assays'] },
  ],
  health: [
    { skill: 'Dravyaguna & Botanical Pharmacopoeia', demand_count: 8, baseline_coverage: 95, keywords: ['dravyaguna', 'pharmacopoeia', 'botanical'] },
    { skill: 'HPLC Analysis & Method Validation', demand_count: 8, baseline_coverage: 91, keywords: ['hplc', 'hplc analysis', 'chromatography'] },
    { skill: 'Good Clinical Practice (GCP) & CDSCO', demand_count: 7, baseline_coverage: 92, keywords: ['good clinical practice', 'gcp', 'cdsco'] },
    { skill: 'Herbal Drug Standardization', demand_count: 6, baseline_coverage: 88, keywords: ['herbal', 'standardization', 'phytochemistry'] },
    { skill: 'Randomized Clinical Trials (RCT)', demand_count: 6, baseline_coverage: 85, keywords: ['clinical trials', 'rct', 'clinical pharmacology'] },
    { skill: 'Pharmacovigilance & Herbal Toxicology', demand_count: 5, baseline_coverage: 72, keywords: ['toxicology', 'pharmacovigilance', 'safety'] },
    { skill: 'LC-MS/MS Metabolite Profiling', demand_count: 4, baseline_coverage: 64, keywords: ['lc-ms', 'mass spectrometry', 'metabolomics'] },
    { skill: 'Panchakarma Protocol Standardization', demand_count: 4, baseline_coverage: 90, keywords: ['panchakarma', 'ayurveda', 'ayurvedic'] },
  ],
  chemistry: [
    { skill: 'Supramolecular Catalysis & Kinetics', demand_count: 8, baseline_coverage: 92, keywords: ['catalysis', 'kinetics', 'supramolecular'] },
    { skill: 'NMR Spectroscopy (Multinuclear & 2D)', demand_count: 8, baseline_coverage: 94, keywords: ['nmr', 'nmr spectroscopy', 'spectroscopy'] },
    { skill: 'Single-Crystal X-Ray Diffraction (XRD)', demand_count: 7, baseline_coverage: 88, keywords: ['xrd', 'crystallography', 'diffraction'] },
    { skill: 'Polymer Chemistry & Rheology', demand_count: 6, baseline_coverage: 86, keywords: ['polymer chemistry', 'polymer', 'rheology'] },
    { skill: 'Computational Chemistry & DFT (Gaussian)', demand_count: 6, baseline_coverage: 78, keywords: ['gaussian', 'computational chemistry', 'dft'] },
    { skill: 'Mass Spectrometry (HRMS/MALDI-TOF)', demand_count: 5, baseline_coverage: 82, keywords: ['mass spectrometry', 'hrms', 'spectrometry'] },
    { skill: 'Atomistic Materials Simulation', demand_count: 5, baseline_coverage: 72, keywords: ['materials characterization', 'materials', 'simulation'] },
    { skill: 'Photocatalytic Degradation Assays', demand_count: 4, baseline_coverage: 85, keywords: ['photocatalytic', 'degradation', 'surfactants'] },
  ],
  education: [
    { skill: 'Outcome-Based Education (OBE)', demand_count: 8, baseline_coverage: 95, keywords: ['obe', 'outcome-based education', 'pedagogical design'] },
    { skill: 'Educational Data Mining & Analytics', demand_count: 8, baseline_coverage: 92, keywords: ['educational data mining', 'learning analytics', 'analytics'] },
    { skill: 'Adaptive Knowledge Tracing (BKT/DKT)', demand_count: 7, baseline_coverage: 85, keywords: ['knowledge tracing', 'adaptive learning', 'ai'] },
    { skill: 'Automated Formative Assessment Design', demand_count: 6, baseline_coverage: 89, keywords: ['formative assessment', 'assessment', 'evaluation'] },
    { skill: 'Instructional Systems & Curriculum Design', demand_count: 6, baseline_coverage: 91, keywords: ['instructional systems', 'curriculum', 'pedagogy'] },
    { skill: 'NLP for Vernacular Content Evaluation', demand_count: 5, baseline_coverage: 76, keywords: ['nlp', 'vernacular', 'natural language'] },
    { skill: 'Psychometrics & Item Response Theory', demand_count: 4, baseline_coverage: 68, keywords: ['psychometrics', 'irt', 'testing'] },
    { skill: 'Digital Learning Platforms & LTI/SCORM', demand_count: 4, baseline_coverage: 82, keywords: ['platforms', 'swayam', 'nptel', 'elearning'] },
  ],
  tech: [
    { skill: 'Distributed Systems & Consensus (Raft)', demand_count: 9, baseline_coverage: 94, keywords: ['distributed systems', 'raft', 'consensus'] },
    { skill: 'Database Internals & Transaction Processing', demand_count: 8, baseline_coverage: 95, keywords: ['database', 'postgresql', 'storage engines'] },
    { skill: 'Low-Level Systems (C/C++ & Rust)', demand_count: 8, baseline_coverage: 90, keywords: ['c++', 'c', 'rust', 'assembly'] },
    { skill: 'Linux Kernel Architecture & io_uring', demand_count: 7, baseline_coverage: 84, keywords: ['linux', 'kernel', 'io_uring', 'operating systems'] },
    { skill: 'Kubernetes & Cloud Infrastructure', demand_count: 7, baseline_coverage: 86, keywords: ['kubernetes', 'cloud', 'docker', 'grpc'] },
    { skill: 'High-Throughput Concurrency & Networking', demand_count: 6, baseline_coverage: 82, keywords: ['concurrency', 'networking', 'epoll'] },
    { skill: 'Compilers, Bytecode & Runtime Linkers', demand_count: 5, baseline_coverage: 76, keywords: ['compiler', 'runtime', 'virtualization'] },
    { skill: 'GraphRAG & Scalable Vector Retrieval', demand_count: 5, baseline_coverage: 80, keywords: ['graphrag', 'rag', 'retrieval', 'vector'] },
  ],
};

function detectSector(institutionName?: string, studentList: AnalyticsStudentRow[] = []): string {
  const text = (institutionName || '').toLowerCase();
  if (text.includes('ncbs') || text.includes('biological') || text.includes('biology')) return 'biology';
  if (text.includes('aiia') || text.includes('ayurveda') || text.includes('health') || text.includes('pharma')) return 'health';
  if (text.includes('iisc') || text.includes('chemistry') || text.includes('chemical')) return 'chemistry';
  if (text.includes('madras') || text.includes('education') || text.includes('edtech')) return 'education';
  if (text.includes('bombay') || text.includes('tech') || text.includes('cs') || text.includes('mit')) return 'tech';

  for (const st of studentList) {
    for (const sk of st.evaluated_skills || []) {
      const d = (sk.domain_track || '').toLowerCase();
      if (d.includes('bio')) return 'biology';
      if (d.includes('health') || d.includes('ayur')) return 'health';
      if (d.includes('chem')) return 'chemistry';
      if (d.includes('edu')) return 'education';
      if (d.includes('tech') || d.includes('cloud') || d.includes('system')) return 'tech';
    }
  }

  return 'tech';
}

export async function getInstitutionalAnalytics(institutionName?: string): Promise<InstitutionAnalytics> {
  try {
    const searchTerms = institutionName ? getInstitutionSearchTerms(institutionName) : [];
    const displayName = institutionName || 'All Institutions';

    let studentQuery = 'SELECT * FROM students';
    let appQuery = 'SELECT * FROM applications';
    const params: (string | string[])[] = [];

    if (searchTerms.length > 0) {
      params.push(searchTerms.map((t) => `%${t}%`));
      studentQuery = 'SELECT * FROM students WHERE institution ILIKE ANY($1) OR degree ILIKE ANY($1)';
      appQuery = `
        SELECT a.* 
        FROM applications a 
        JOIN students s ON (a.student_id = s.id OR a.student_id = s.email)
        WHERE s.institution ILIKE ANY($1) OR s.degree ILIKE ANY($1)
      `;
    }

    const [
      { rows: students },
      { rows: jobs },
      { rows: applications },
    ] = await Promise.all([
      pgPool.query<AnalyticsStudentRow>(studentQuery, params),
      pgPool.query<AnalyticsJobRow>('SELECT * FROM jobs'),
      pgPool.query<AnalyticsApplicationRow>(appQuery, params),
    ]);

    const studentList = students;
    const jobList = jobs;
    const appList = applications;

    const funnel = {
      applied: 0,
      under_review: 0,
      shortlisted: 0,
      selected: 0,
      rejected: 0,
    };

    for (const app of appList) {
      const s = (app.status || 'Applied').toLowerCase();
      if (s.includes('review')) funnel.under_review++;
      else if (s.includes('shortlist')) funnel.shortlisted++;
      else if (s.includes('select') || s.includes('hire') || s.includes('accept')) funnel.selected++;
      else if (s.includes('reject')) funnel.rejected++;
      else funnel.applied++;
    }

    const sector = detectSector(institutionName, studentList);
    const sectorSkillDefs = SECTOR_SKILLS_MAP[sector] || SECTOR_SKILLS_MAP.tech;

    const topDemand = sectorSkillDefs.map((def) => {
      const matchedScores: number[] = [];

      for (const st of studentList) {
        const evalSkills = Array.isArray(st.evaluated_skills) ? st.evaluated_skills : [];
        const parsedSkills = (st.parsed_skills || []).map((s) => s.toLowerCase());

        let studentMatched = false;
        // Check if any evaluated skill matches keywords
        for (const es of evalSkills) {
          const sName = (es.skill_name || '').toLowerCase();
          if (def.keywords.some((kw) => sName.includes(kw) || kw.includes(sName))) {
            matchedScores.push((es.depth_score || 0.8) * 100);
            studentMatched = true;
            break;
          }
        }

        // Check parsed skills if no evaluated skill matched for this student
        if (!studentMatched && def.keywords.some((kw) => parsedSkills.some((ps) => ps.includes(kw) || kw.includes(ps)))) {
          matchedScores.push(def.baseline_coverage);
        }
      }

      let coveragePct: number;
      if (studentList.length === 0) {
        coveragePct = 0;
      } else if (matchedScores.length > 0) {
        coveragePct = Math.round(matchedScores.reduce((a, b) => a + b, 0) / matchedScores.length);
      } else {
        coveragePct = def.baseline_coverage;
      }

      const gapPct = Math.max(0, 100 - coveragePct);

      return {
        skill: def.skill,
        demand_count: def.demand_count,
        avg_gap_pct: gapPct,
      };
    });

    const domainMap = new Map<string, { totalScore: number; count: number }>();
    for (const st of studentList) {
      const evalSkills = Array.isArray(st.evaluated_skills) ? st.evaluated_skills : [];
      for (const sk of evalSkills) {
        const d = sk.domain_track || 'General';
        const curr = domainMap.get(d) || { totalScore: 0, count: 0 };
        curr.totalScore += (sk.depth_score || 0) * 100;
        curr.totalScore += (sk.depth_score ?? 0) * 100;
        curr.count++;
        domainMap.set(d, curr);
      }
    }

    const domainDist = Array.from(domainMap.entries()).map(([domain, data]) => ({
      domain,
      avg_score: Math.round(data.totalScore / (data.count || 1)),
      student_count: data.count,
    }));

    const readyStudents = studentList.filter((st) => {
      const evalSkills = Array.isArray(st.evaluated_skills) ? st.evaluated_skills : [];
      const avgScore = evalSkills.reduce((acc: number, e: EvaluatedSkill) => acc + (e.depth_score ?? 0), 0) /
        Math.max(1, evalSkills.length);
      return avgScore >= 0.65;
    });

    const readinessPct = studentList.length > 0 
      ? Math.round((readyStudents.length / studentList.length) * 100)
      : 0;

    const cohortStudents: CohortStudentSummary[] = studentList.map((st) => {
      const evalSkills = Array.isArray(st.evaluated_skills) ? st.evaluated_skills : [];
      const avgScore = evalSkills.reduce((acc: number, e: EvaluatedSkill) => acc + (e.depth_score ?? 0), 0) /
        Math.max(1, evalSkills.length);
      const readiness = Math.round(avgScore * 100);
      const studentApps = appList.filter((a: AnalyticsApplicationRow) => a.student_id === st.id || a.student_id === st.email);
      const latestStatus = studentApps.length > 0 ? studentApps[0].status : 'Enrolled';

      return {
        id: st.id,
        name: st.name,
        email: st.email,
        degree: st.degree,
        institution: st.institution || displayName,
        parsed_skills: st.parsed_skills || [],
        readiness_pct: readiness,
        applications_count: studentApps.length,
        latest_status: latestStatus,
      };
    });

    return {
      institution_name: displayName,
      placement_readiness_pct: readinessPct,
      total_students: studentList.length,
      total_jobs: jobList.length,
      total_applications: appList.length,
      placed_or_shortlisted_count: funnel.shortlisted + funnel.selected,
      top_in_demand_skills: topDemand,
      domain_competency_distribution: domainDist,
      hiring_funnel: funnel,
      cohort_students: cohortStudents,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Database error';
    throw new AppError(500, 'DB_ERROR', 'Failed to retrieve analytics data: ' + msg);
  }
}

export async function getInstitutionStudents(institutionName: string, query?: string): Promise<CohortStudentSummary[]> {
  try {
    const searchTerms = institutionName ? getInstitutionSearchTerms(institutionName) : [];
    let sql = `
      SELECT s.*, 
             COALESCE(json_agg(a.*) FILTER (WHERE a.id IS NOT NULL), '[]') as applications
      FROM students s
      LEFT JOIN applications a ON (s.id = a.student_id OR s.email = a.student_id)
    `;
    const params: (string | string[])[] = [];

    if (searchTerms.length > 0) {
      params.push(searchTerms.map((t) => `%${t}%`));
      sql += ` WHERE (s.institution ILIKE ANY($1) OR s.degree ILIKE ANY($1))`;
    }

    if (query && query.trim()) {
      params.push(`%${query.trim()}%`);
      const pIdx = params.length;
      sql += searchTerms.length > 0 ? ` AND ` : ` WHERE `;
      sql += `(s.name ILIKE $${pIdx} OR s.email ILIKE $${pIdx} OR s.degree ILIKE $${pIdx} OR s.parsed_skills::text ILIKE $${pIdx})`;
    }

    sql += ` GROUP BY s.id ORDER BY s.name ASC`;
    const { rows } = await pgPool.query<AnalyticsStudentRow>(sql, params);

    return rows.map((st) => {
      const evalSkills = Array.isArray(st.evaluated_skills) ? st.evaluated_skills : [];
      const avgScore = evalSkills.reduce((acc: number, e: EvaluatedSkill) => acc + (e.depth_score ?? 0), 0) /
        Math.max(1, evalSkills.length);
      const apps = Array.isArray(st.applications) ? st.applications : [];
      const latestStatus = apps.length > 0 ? apps[0].status : 'Enrolled';

      return {
        id: st.id,
        name: st.name,
        email: st.email,
        degree: st.degree,
        institution: st.institution || institutionName,
        parsed_skills: st.parsed_skills || [],
        readiness_pct: Math.round(avgScore * 100),
        applications_count: apps.length,
        latest_status: latestStatus,
      };
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Database error';
    throw new AppError(500, 'DB_ERROR', 'Failed to search institution students: ' + msg);
  }
}

