import { pgPool } from '../db/connection.js';
import { AppError } from '../lib/errors.js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface FacultyExperience {
  title: string;
  organization: string;
  role_type?: string;
  start_year: string;
  end_year: string;
  description: string;
}

export interface FacultyPublication {
  title: string;
  journal_or_conference: string;
  year: string;
  doi_or_url?: string;
  citations?: string;
}

export interface FacultyGrant {
  title: string;
  funding_agency: string;
  grant_amount: string;
  year: string;
  status: 'Active' | 'Completed' | 'Under Review';
  role: string;
}

export interface FacultyProject {
  title: string;
  area: string;
  description: string;
  role: string;
  year: string;
  url?: string;
}

export interface FacultyConsulting {
  client_partner: string;
  area: string;
  duration: string;
  outcomes: string;
}

export interface FacultyProfile {
  id: string;
  user_id?: string;
  name: string;
  email: string;
  institution: string;
  department?: string;
  designation?: string;
  bio?: string;
  domains: string[];
  experience: FacultyExperience[];
  research_projects: FacultyProject[];
  publications: FacultyPublication[];
  grants: FacultyGrant[];
  consulting: FacultyConsulting[];
  google_scholar_url?: string;
  orcid_id?: string;
  has_resume?: boolean;
  resume_filename?: string;
  resume_mimetype?: string;
  resume_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FacultyProgram {
  id: string;
  title: string;
  organization: string;
  type: 'FDP' | 'Faculty Internship' | 'Industrial Training' | 'Research Grant' | 'Consultancy';
  description: string;
  domain: string;
  stipend_grant?: string;
  duration?: string;
  deadline?: string;
  eligibility?: string;
}

export interface FacultyApplication {
  id: string;
  program_id: string;
  faculty_name: string;
  faculty_email: string;
  institution: string;
  proposal_summary?: string;
  cv_attached?: boolean;
  past_grants_summary?: string;
  experience_summary?: string;
  resume_url?: string;
  status: 'Submitted' | 'Under Review' | 'Approved' | 'Completed';
  applied_at: string;
  program?: FacultyProgram;
}

export async function getFacultyProfile(email: string): Promise<FacultyProfile> {
  try {
    const { rows } = await pgPool.query('SELECT * FROM faculty_profiles WHERE email = $1', [email]);
    if (rows.length > 0) {
      const r = rows[0];
      return {
        id: r.id,
        user_id: r.user_id,
        name: r.name,
        email: r.email,
        institution: r.institution,
        department: r.department || '',
        designation: r.designation || 'Faculty Member',
        bio: r.bio || '',
        domains: Array.isArray(r.domains) ? r.domains : [],
        experience: Array.isArray(r.experience) ? r.experience : [],
        research_projects: Array.isArray(r.research_projects) ? r.research_projects : [],
        publications: Array.isArray(r.publications) ? r.publications : [],
        grants: Array.isArray(r.grants) ? r.grants : [],
        consulting: Array.isArray(r.consulting) ? r.consulting : [],
        google_scholar_url: r.google_scholar_url || '',
        orcid_id: r.orcid_id || '',
        has_resume: true,
        resume_filename: r.resume_filename || `${(r.name || 'Faculty').replace(/[^a-zA-Z0-9]/g, '_')}_Academic_CV.pdf`,
        resume_mimetype: r.resume_mimetype || 'application/pdf',
        resume_url: `/api/faculty/profile/${encodeURIComponent(r.email)}/cv`,
        created_at: r.created_at,
        updated_at: r.updated_at,
      };
    }

    // Fallback: check users table to build an initial profile
    const userRes = await pgPool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userRes.rows[0];
    const newProfile: FacultyProfile = {
      id: `fac-prof-${Date.now()}`,
      name: user?.name || 'Faculty Member',
      email,
      institution: user?.institution_or_company || 'Academic Institution',
      department: 'Academic Department',
      designation: 'Assistant / Associate Professor',
      bio: 'Academic researcher and faculty instructor.',
      domains: ['Higher Education', 'Research'],
      experience: [],
      research_projects: [],
      publications: [],
      grants: [],
      consulting: [],
      has_resume: true,
      resume_filename: `${(user?.name || 'Faculty').replace(/[^a-zA-Z0-9]/g, '_')}_Academic_CV.pdf`,
      resume_mimetype: 'application/pdf',
      resume_url: `/api/faculty/profile/${encodeURIComponent(email)}/cv`
    };

    return newProfile;
  } catch (error: any) {
    throw new AppError(500, 'DB_ERROR', 'Failed to retrieve faculty profile: ' + error.message);
  }
}

export async function updateFacultyProfile(email: string, payload: Partial<FacultyProfile>): Promise<FacultyProfile> {
  try {
    // Ensure faculty record exists
    await pgPool.query(`
      INSERT INTO faculty_profiles (id, name, email, institution, created_at, updated_at)
      VALUES ('fac-prof-' || md5($1), 'Faculty Member', $1, 'Academic Institution', NOW(), NOW())
      ON CONFLICT (email) DO NOTHING
    `, [email]);

    const updates: string[] = [];
    const values: any[] = [email];

    if (payload.name !== undefined) {
      values.push(payload.name);
      updates.push(`name = $${values.length}`);
    }
    if (payload.institution !== undefined) {
      values.push(payload.institution);
      updates.push(`institution = $${values.length}`);
    }
    if (payload.department !== undefined) {
      values.push(payload.department);
      updates.push(`department = $${values.length}`);
    }
    if (payload.designation !== undefined) {
      values.push(payload.designation);
      updates.push(`designation = $${values.length}`);
    }
    if (payload.bio !== undefined) {
      values.push(payload.bio);
      updates.push(`bio = $${values.length}`);
    }
    if (payload.domains !== undefined) {
      values.push(JSON.stringify(payload.domains));
      updates.push(`domains = $${values.length}`);
    }
    if (payload.experience !== undefined) {
      values.push(JSON.stringify(payload.experience));
      updates.push(`experience = $${values.length}`);
    }
    if (payload.research_projects !== undefined) {
      values.push(JSON.stringify(payload.research_projects));
      updates.push(`research_projects = $${values.length}`);
    }
    if (payload.publications !== undefined) {
      values.push(JSON.stringify(payload.publications));
      updates.push(`publications = $${values.length}`);
    }
    if (payload.grants !== undefined) {
      values.push(JSON.stringify(payload.grants));
      updates.push(`grants = $${values.length}`);
    }
    if (payload.consulting !== undefined) {
      values.push(JSON.stringify(payload.consulting));
      updates.push(`consulting = $${values.length}`);
    }
    if (payload.google_scholar_url !== undefined) {
      values.push(payload.google_scholar_url);
      updates.push(`google_scholar_url = $${values.length}`);
    }
    if (payload.orcid_id !== undefined) {
      values.push(payload.orcid_id);
      updates.push(`orcid_id = $${values.length}`);
    }

    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);
      const updateQuery = `UPDATE faculty_profiles SET ${updates.join(', ')} WHERE email = $1`;
      await pgPool.query(updateQuery, values);
    }

    const updated = await getFacultyProfile(email);

    // Refresh generated CV if needed so new projects/grants appear immediately in the downloadable CV
    try {
      const { rows } = await pgPool.query('SELECT resume_filename, resume_data FROM faculty_profiles WHERE email = $1', [email]);
      if (rows.length && (!rows[0].resume_data || rows[0].resume_data.length <= 1200 || rows[0].resume_filename?.includes('_Academic_CV.pdf'))) {
        const cvBuf = await generateAcademicCVPdf(updated);
        const fn = `${(updated.name || 'Faculty').replace(/[^a-zA-Z0-9]/g, '_')}_Academic_CV.pdf`;
        await pgPool.query(
          `UPDATE faculty_profiles SET resume_data = $1, resume_filename = $2, resume_mimetype = 'application/pdf' WHERE email = $3`,
          [cvBuf.toString('base64'), fn, email]
        );
      }
    } catch {
      // Non-fatal
    }

    return updated;
  } catch (error: any) {
    throw new AppError(500, 'DB_ERROR', 'Failed to update faculty profile: ' + error.message);
  }
}

export async function uploadFacultyCV(
  email: string,
  buffer: Buffer,
  filename: string,
  mimetype: string
): Promise<{ filename: string; resume_url: string }> {
  try {
    const base64Data = buffer.toString('base64');
    const query = `
      INSERT INTO faculty_profiles (
        id, name, email, institution, resume_data, resume_filename, resume_mimetype, updated_at
      ) VALUES (
        'fac-prof-' || md5($1), 'Faculty Member', $1, 'Academic Institution', $2, $3, $4, NOW()
      )
      ON CONFLICT (email) DO UPDATE SET
        resume_data = EXCLUDED.resume_data,
        resume_filename = EXCLUDED.resume_filename,
        resume_mimetype = EXCLUDED.resume_mimetype,
        updated_at = NOW();
    `;
    await pgPool.query(query, [email, base64Data, filename, mimetype]);
    return {
      filename,
      resume_url: `/api/faculty/profile/${encodeURIComponent(email)}/cv`
    };
  } catch (error: any) {
    throw new AppError(500, 'DB_ERROR', 'Failed to save faculty CV: ' + error.message);
  }
}

export async function generateAcademicCVPdf(profile: FacultyProfile): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique);

  function clean(str?: string): string {
    if (!str) return '';
    return str
      .replace(/₹/g, 'INR ')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[—–]/g, '-')
      .replace(/[•]/g, '-')
      .replace(/[^\x00-\x7F]/g, '');
  }

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const margin = 45;
  const contentWidth = pageWidth - (margin * 2);

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - 50;

  function checkNewPage(neededSpace: number = 50) {
    if (y - neededSpace < 50) {
      page.drawText(clean('Curriculum Vitae • ' + (profile.name || 'Faculty Member')), {
        x: margin,
        y: 25,
        size: 8,
        font: fontItalic,
        color: rgb(0.5, 0.5, 0.5)
      });
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - 50;
    }
  }

  function drawSectionHeader(title: string) {
    checkNewPage(45);
    y -= 10;
    page.drawRectangle({
      x: margin,
      y: y - 2,
      width: contentWidth,
      height: 18,
      color: rgb(0.95, 0.94, 0.98)
    });
    page.drawText(clean(title.toUpperCase()), {
      x: margin + 8,
      y: y + 2,
      size: 10,
      font: fontBold,
      color: rgb(0.35, 0.11, 0.53)
    });
    y -= 20;
  }

  // Header Banner
  page.drawRectangle({
    x: margin,
    y: y - 55,
    width: contentWidth,
    height: 65,
    color: rgb(0.98, 0.97, 1.0)
  });

  page.drawText(clean(profile.name || 'Faculty Member'), {
    x: margin + 12,
    y: y - 10,
    size: 18,
    font: fontBold,
    color: rgb(0.15, 0.1, 0.25)
  });

  page.drawText(clean(`${profile.designation || 'Faculty Member'} • ${profile.department || 'Department of Computer Science'}`), {
    x: margin + 12,
    y: y - 28,
    size: 10,
    font: fontBold,
    color: rgb(0.3, 0.3, 0.35)
  });

  page.drawText(clean(`${profile.institution || 'Academic Institution'} • Email: ${profile.email || ''}${profile.orcid_id ? ' • ORCID: ' + profile.orcid_id : ''}`), {
    x: margin + 12,
    y: y - 44,
    size: 9,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.45)
  });

  y -= 75;

  // Bio / Research Statement
  if (profile.bio) {
    drawSectionHeader('Executive Research Statement');
    const words = profile.bio.split(' ');
    let currentLine = '';
    for (const word of words) {
      if ((currentLine + ' ' + word).length > 85) {
        checkNewPage(18);
        page.drawText(clean(currentLine), { x: margin + 5, y, size: 9.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
        y -= 14;
        currentLine = word;
      } else {
        currentLine = currentLine ? currentLine + ' ' + word : word;
      }
    }
    if (currentLine) {
      checkNewPage(18);
      page.drawText(clean(currentLine), { x: margin + 5, y, size: 9.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
      y -= 14;
    }
  }

  // Domains
  if (profile.domains && profile.domains.length) {
    y -= 5;
    checkNewPage(25);
    page.drawText(clean('Primary Fields: ' + profile.domains.join('  •  ')), {
      x: margin + 5,
      y,
      size: 8.5,
      font: fontItalic,
      color: rgb(0.35, 0.11, 0.53)
    });
    y -= 15;
  }

  // Research Projects / Agenda
  if (profile.research_projects && profile.research_projects.length) {
    drawSectionHeader('Research Agenda & Laboratory Projects');
    for (const proj of profile.research_projects) {
      checkNewPage(50);
      page.drawText(clean(`• ${proj.title} (${proj.year || 'Ongoing'})`), {
        x: margin + 5,
        y,
        size: 10,
        font: fontBold,
        color: rgb(0.15, 0.15, 0.2)
      });
      y -= 13;
      page.drawText(clean(`  Area: ${proj.area || 'General'} | Role: ${proj.role || 'Principal Investigator'}`), {
        x: margin + 5,
        y,
        size: 8.5,
        font: fontItalic,
        color: rgb(0.4, 0.4, 0.4)
      });
      y -= 12;
      if (proj.description) {
        page.drawText(clean(`  ${proj.description.slice(0, 110)}${proj.description.length > 110 ? '...' : ''}`), {
          x: margin + 5,
          y,
          size: 8.5,
          font: fontRegular,
          color: rgb(0.25, 0.25, 0.25)
        });
        y -= 14;
      }
      y -= 5;
    }
  }

  // Funded Research Grants
  if (profile.grants && profile.grants.length) {
    drawSectionHeader('Sponsored Research Grants Won & Principal Investigator Roles');
    for (const g of profile.grants) {
      checkNewPage(45);
      page.drawText(clean(`• ${g.title}`), {
        x: margin + 5,
        y,
        size: 10,
        font: fontBold,
        color: rgb(0.15, 0.15, 0.2)
      });
      y -= 13;
      page.drawText(clean(`  Funding Agency: ${g.funding_agency} | Amount: ${g.grant_amount} | Status: ${g.status} (${g.year})`), {
        x: margin + 5,
        y,
        size: 8.5,
        font: fontRegular,
        color: rgb(0.1, 0.45, 0.2)
      });
      y -= 12;
      page.drawText(clean(`  Role: ${g.role}`), {
        x: margin + 5,
        y,
        size: 8.5,
        font: fontItalic,
        color: rgb(0.4, 0.4, 0.4)
      });
      y -= 16;
    }
  }

  // Peer-Reviewed Publications
  if (profile.publications && profile.publications.length) {
    drawSectionHeader('Selected Peer-Reviewed Publications & Books');
    for (const pub of profile.publications) {
      checkNewPage(42);
      page.drawText(clean(`• "${pub.title}"`), {
        x: margin + 5,
        y,
        size: 9.5,
        font: fontBold,
        color: rgb(0.15, 0.15, 0.2)
      });
      y -= 13;
      page.drawText(clean(`  ${pub.journal_or_conference} (${pub.year})${pub.citations ? ' • Citations: ' + pub.citations : ''}`), {
        x: margin + 5,
        y,
        size: 8.5,
        font: fontItalic,
        color: rgb(0.35, 0.35, 0.35)
      });
      y -= 12;
      if (pub.doi_or_url) {
        page.drawText(clean(`  URL/DOI: ${pub.doi_or_url}`), {
          x: margin + 5,
          y,
          size: 8,
          font: fontRegular,
          color: rgb(0.2, 0.3, 0.6)
        });
        y -= 12;
      }
      y -= 4;
    }
  }

  // Academic & Industry Appointments
  if (profile.experience && profile.experience.length) {
    drawSectionHeader('Academic & Professional Appointments');
    for (const exp of profile.experience) {
      checkNewPage(45);
      page.drawText(clean(`• ${exp.title} — ${exp.organization}`), {
        x: margin + 5,
        y,
        size: 9.5,
        font: fontBold,
        color: rgb(0.15, 0.15, 0.2)
      });
      y -= 13;
      page.drawText(clean(`  Period: ${exp.start_year} - ${exp.end_year} | Type: ${exp.role_type || 'Academic Appointment'}`), {
        x: margin + 5,
        y,
        size: 8.5,
        font: fontItalic,
        color: rgb(0.4, 0.4, 0.4)
      });
      y -= 12;
      if (exp.description) {
        page.drawText(clean(`  ${exp.description.slice(0, 110)}${exp.description.length > 110 ? '...' : ''}`), {
          x: margin + 5,
          y,
          size: 8.5,
          font: fontRegular,
          color: rgb(0.25, 0.25, 0.25)
        });
        y -= 14;
      }
      y -= 5;
    }
  }

  // Industry Consulting
  if (profile.consulting && profile.consulting.length) {
    drawSectionHeader('Industry Advisory & Technical Consulting');
    for (const c of profile.consulting) {
      checkNewPage(42);
      page.drawText(clean(`• ${c.client_partner} (${c.duration})`), {
        x: margin + 5,
        y,
        size: 9.5,
        font: fontBold,
        color: rgb(0.15, 0.15, 0.2)
      });
      y -= 13;
      page.drawText(clean(`  Area: ${c.area}`), {
        x: margin + 5,
        y,
        size: 8.5,
        font: fontItalic,
        color: rgb(0.4, 0.4, 0.4)
      });
      y -= 12;
      if (c.outcomes) {
        page.drawText(clean(`  ${c.outcomes.slice(0, 110)}${c.outcomes.length > 110 ? '...' : ''}`), {
          x: margin + 5,
          y,
          size: 8.5,
          font: fontRegular,
          color: rgb(0.25, 0.25, 0.25)
        });
        y -= 14;
      }
      y -= 4;
    }
  }

  // Footer on last page
  page.drawText(clean('Curriculum Vitae • ' + (profile.name || 'Faculty Member') + ' • Verified via SkillBridge Platform'), {
    x: margin,
    y: 25,
    size: 8,
    font: fontItalic,
    color: rgb(0.5, 0.5, 0.5)
  });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

export async function getFacultyCV(email: string): Promise<{ buffer: Buffer; filename: string; mimetype: string } | null> {
  try {
    const { rows } = await pgPool.query(
      'SELECT resume_data, resume_filename, resume_mimetype FROM faculty_profiles WHERE email = $1',
      [email]
    );

    // If a valid custom/generated CV exists (> 1200 bytes base64)
    if (rows.length && rows[0].resume_data && rows[0].resume_data.length > 1200) {
      return {
        buffer: Buffer.from(rows[0].resume_data, 'base64'),
        filename: rows[0].resume_filename || 'Faculty_CV.pdf',
        mimetype: rows[0].resume_mimetype || 'application/pdf',
      };
    }

    // Otherwise generate a complete academic CV from the profile
    const profile = await getFacultyProfile(email);
    if (!profile) return null;

    const buffer = await generateAcademicCVPdf(profile);
    const filename = `${(profile.name || 'Faculty').replace(/[^a-zA-Z0-9]/g, '_')}_Academic_CV.pdf`;

    await pgPool.query(
      `UPDATE faculty_profiles SET resume_data = $1, resume_filename = $2, resume_mimetype = 'application/pdf', updated_at = NOW() WHERE email = $3`,
      [buffer.toString('base64'), filename, email]
    );

    return {
      buffer,
      filename,
      mimetype: 'application/pdf'
    };
  } catch (error: any) {
    throw new AppError(500, 'DB_ERROR', 'Failed to retrieve faculty CV: ' + error.message);
  }
}

export async function getFacultyPrograms(filter?: { type?: string; domain?: string }): Promise<FacultyProgram[]> {
  try {
    let query = `SELECT * FROM faculty_programs WHERE 1=1`;
    const params: any[] = [];

    if (filter?.type && filter.type !== 'All') {
      params.push(filter.type);
      query += ` AND type = $${params.length}`;
    }
    if (filter?.domain && filter.domain !== 'All') {
      params.push(`%${filter.domain}%`);
      query += ` AND domain ILIKE $${params.length}`;
    }

    query += ` ORDER BY created_at DESC`;
    const { rows } = await pgPool.query(query, params);
    return rows;
  } catch (error: any) {
    throw new AppError(500, 'DB_ERROR', 'Failed to retrieve faculty programs');
  }
}

export async function applyFacultyProgram(payload: {
  program_id: string;
  faculty_name: string;
  faculty_email: string;
  institution: string;
  proposal_summary?: string;
  cv_attached?: boolean;
  past_grants_summary?: string;
  experience_summary?: string;
  resume_url?: string;
}): Promise<FacultyApplication> {
  try {
    const query = `
      INSERT INTO faculty_applications (
        program_id, faculty_name, faculty_email, institution, proposal_summary,
        cv_attached, past_grants_summary, experience_summary, resume_url, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Submitted')
      RETURNING *;
    `;
    const { rows } = await pgPool.query(query, [
      payload.program_id,
      payload.faculty_name,
      payload.faculty_email,
      payload.institution,
      payload.proposal_summary || null,
      Boolean(payload.cv_attached),
      payload.past_grants_summary || null,
      payload.experience_summary || null,
      payload.resume_url || null,
    ]);
    return rows[0];
  } catch (error: any) {
    throw new AppError(500, 'DB_ERROR', 'Failed to submit faculty application: ' + error.message);
  }
}

export async function getFacultyApplications(facultyEmail: string): Promise<FacultyApplication[]> {
  try {
    const query = `
      SELECT 
        fa.id, fa.program_id, fa.faculty_name, fa.faculty_email, fa.institution,
        fa.proposal_summary, fa.cv_attached, fa.past_grants_summary, fa.experience_summary,
        fa.resume_url, fa.status, fa.applied_at,
        json_build_object(
          'id', fp.id,
          'title', fp.title,
          'organization', fp.organization,
          'type', fp.type,
          'stipend_grant', fp.stipend_grant
        ) as program
      FROM faculty_applications fa
      LEFT JOIN faculty_programs fp ON fa.program_id = fp.id
      WHERE fa.faculty_email = $1
      ORDER BY fa.applied_at DESC;
    `;
    const { rows } = await pgPool.query(query, [facultyEmail]);
    return rows;
  } catch (error: any) {
    throw new AppError(500, 'DB_ERROR', 'Failed to retrieve faculty applications');
  }
}

