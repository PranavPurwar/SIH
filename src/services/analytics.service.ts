import { pgPool } from '../db/connection.js';
import { AppError } from '../lib/errors.js';

export interface InstitutionAnalytics {
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
}

export async function getInstitutionalAnalytics(): Promise<InstitutionAnalytics> {
  try {
    const [
      { rows: students },
      { rows: jobs },
      { rows: applications },
    ] = await Promise.all([
      pgPool.query('SELECT * FROM students'),
      pgPool.query('SELECT * FROM jobs'),
      pgPool.query('SELECT * FROM applications'),
    ]);

    const studentList = students || [];
    const jobList = jobs || [];
    const appList = applications || [];

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

    const demandMap = new Map<string, { count: number; studentMatches: number }>();
    for (const job of jobList) {
      const reqs = Array.isArray(job.required_skills) ? job.required_skills : [];
      for (const req of reqs) {
        const s = req.skill;
        if (!s) continue;
        const curr = demandMap.get(s) || { count: 0, studentMatches: 0 };
        curr.count++;
        demandMap.set(s, curr);
      }
    }

    for (const s of studentList) {
      const evalSkills = Array.isArray(s.evaluated_skills) ? s.evaluated_skills : [];
      const sSkills = new Set(evalSkills.map((e: any) => e.skill_name?.toLowerCase()));
      for (const [skillName, val] of demandMap.entries()) {
        if (sSkills.has(skillName.toLowerCase())) {
          val.studentMatches++;
        }
      }
    }

    const topDemand = Array.from(demandMap.entries())
      .map(([skill, data]) => {
        const coverageRatio = studentList.length > 0 ? (data.studentMatches / studentList.length) : 0.5;
        const gapPct = Math.round(Math.max(0, (1.0 - coverageRatio) * 100));
        return {
          skill,
          demand_count: data.count,
          avg_gap_pct: gapPct,
        };
      })
      .sort((a, b) => b.demand_count - a.demand_count)
      .slice(0, 8);

    const domainMap = new Map<string, { totalScore: number; count: number }>();
    for (const st of studentList) {
      const evalSkills = Array.isArray(st.evaluated_skills) ? st.evaluated_skills : [];
      for (const sk of evalSkills) {
        const d = sk.domain_track || 'General';
        const curr = domainMap.get(d) || { totalScore: 0, count: 0 };
        curr.totalScore += (sk.depth_score || 0) * 100;
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
      const avgScore = evalSkills.reduce((acc: number, e: any) => acc + (e.depth_score || 0), 0) /
        Math.max(1, evalSkills.length);
      return avgScore >= 0.65;
    });

    const readinessPct = studentList.length > 0 
      ? Math.round((readyStudents.length / studentList.length) * 100)
      : 85;

    return {
      placement_readiness_pct: readinessPct,
      total_students: studentList.length,
      total_jobs: jobList.length,
      total_applications: appList.length,
      placed_or_shortlisted_count: funnel.shortlisted + funnel.selected,
      top_in_demand_skills: topDemand,
      domain_competency_distribution: domainDist,
      hiring_funnel: funnel,
    };
  } catch (error: any) {
    throw new AppError(500, 'DB_ERROR', 'Failed to retrieve analytics data: ' + error.message);
  }
}
