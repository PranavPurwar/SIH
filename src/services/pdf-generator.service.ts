import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { StudentProfile, RadarChartMetric } from '../types/index.js';

interface WrapOptions {
  x: number;
  y: number;
  size: number;
  font: any;
  color?: any;
  maxWidth?: number;
  lineHeight?: number;
}

function sanitizePdfText(text: string): string {
  if (!text) return '';
  return text
    .replace(/[^\x00-\x7F\xA0-\xFF]/g, (char) => {
      if (char === '•') return '•';
      if (char === '—' || char === '–') return '-';
      if (char === '“' || char === '”') return '"';
      if (char === '‘' || char === '’') return "'";
      if (char === '🔗' || char === '↗') return '';
      return ' ';
    });
}

function wrapText(text: string, maxW: number, font: any, size: number): string[] {
  const safeText = sanitizePdfText(text);
  const words = safeText.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, size);
    if (testWidth > maxW && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export async function generateStudentResumePDF(
  student: StudentProfile,
  _radarMetrics: RadarChartMetric[] = []
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  const fontTitle = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontBodyBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontBody = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBodyOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const cBlack = rgb(0.10, 0.04, 0.18);
  const cBody = rgb(0.24, 0.18, 0.30);
  const cMuted = rgb(0.42, 0.36, 0.48);
  const cLine = rgb(0.88, 0.82, 0.92);
  const cSubtleLine = rgb(0.94, 0.91, 0.96);
  const cPillBg = rgb(0.96, 0.95, 1.0);
  const cPillBorder = rgb(0.87, 0.84, 1.0);
  const cAccent = rgb(0.35, 0.11, 0.53);

  let page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const margin = 46;
  const contentWidth = width - margin * 2;
  let cursorY = height - margin;

  function checkPageBreak(requiredHeight: number) {
    if (cursorY - requiredHeight < margin + 25) {
      page = pdfDoc.addPage([595.28, 841.89]);
      cursorY = height - margin;
    }
  }

  function drawWrappedText(text: string, options: WrapOptions): number {
    const { x, y, size, font, color = cBody, maxWidth = contentWidth, lineHeight = size * 1.32 } = options;
    const lines = wrapText(text, maxWidth, font, size);
    let currentY = y;
    for (const line of lines) {
      page.drawText(line, { x, y: currentY, size, font, color });
      currentY -= lineHeight;
    }
    return lines.length * lineHeight;
  }

  function drawSectionTitle(title: string) {
    checkPageBreak(35);
    cursorY -= 8;

    page.drawText(title.toUpperCase(), {
      x: margin,
      y: cursorY,
      size: 11,
      font: fontBodyBold,
      color: cBlack,
    });

    cursorY -= 4;

    page.drawLine({
      start: { x: margin, y: cursorY },
      end: { x: width - margin, y: cursorY },
      thickness: 1,
      color: cLine,
    });

    cursorY -= 20;
  }

  const candidateName = sanitizePdfText(student.name || 'Candidate Profile');
  const nameSize = 22;
  const nameWidth = fontTitle.widthOfTextAtSize(candidateName, nameSize);
  const nameX = margin + (contentWidth - nameWidth) / 2;

  page.drawText(candidateName, {
    x: nameX,
    y: cursorY,
    size: nameSize,
    font: fontTitle,
    color: cBlack,
  });
  cursorY -= 18;

  if (student.degree) {
    const degText = sanitizePdfText(student.degree);
    const degSize = 9.5;
    const degWidth = fontBody.widthOfTextAtSize(degText, degSize);
    const degX = margin + (contentWidth - degWidth) / 2;
    page.drawText(degText, {
      x: degX,
      y: cursorY,
      size: degSize,
      font: fontBody,
      color: cMuted,
    });
    cursorY -= 14;
  }

  const contactList = [
    student.email ? student.email : null,
    `github.com/${student.id}`
  ].filter(Boolean).join('   |   ');

  const contactText = sanitizePdfText(contactList);
  const contactSize = 8.5;
  const contactWidth = fontBody.widthOfTextAtSize(contactText, contactSize);
  const contactX = margin + (contentWidth - contactWidth) / 2;

  page.drawText(contactText, {
    x: contactX,
    y: cursorY,
    size: contactSize,
    font: fontBody,
    color: cBody,
  });

  cursorY -= 16;

  page.drawLine({
    start: { x: margin, y: cursorY },
    end: { x: width - margin, y: cursorY },
    thickness: 0.5,
    color: cLine,
  });
  cursorY -= 10;

  const allSkills = Array.from(new Set([
    ...(student.parsed_skills || []),
    ...(student.evaluated_skills || []).map(s => s.skill_name)
  ])).filter(Boolean);

  if (allSkills.length > 0) {
    drawSectionTitle('Skills');

    let curPillX = margin;
    let curPillY = cursorY;
    const pillPaddingX = 6;
    const pillHeight = 15;
    const pillFontSize = 8;
    const pillMarginRight = 5;
    const pillMarginBottom = 5;

    for (const rawSkill of allSkills.slice(0, 32)) {
      const skill = sanitizePdfText(rawSkill);
      const textW = fontBody.widthOfTextAtSize(skill, pillFontSize);
      const curPillW = textW + pillPaddingX * 2;

      if (curPillX + curPillW > width - margin) {
        curPillX = margin;
        curPillY -= (pillHeight + pillMarginBottom);
        checkPageBreak(pillHeight + 15);
      }

      page.drawRectangle({
        x: curPillX,
        y: curPillY - pillHeight,
        width: curPillW,
        height: pillHeight,
        color: cPillBg,
        borderColor: cPillBorder,
        borderWidth: 0.5,
      });

      page.drawText(skill, {
        x: curPillX + pillPaddingX,
        y: curPillY - pillHeight + 4,
        size: pillFontSize,
        font: fontBody,
        color: cBlack,
      });

      curPillX += (curPillW + pillMarginRight);
    }

    cursorY = curPillY - pillHeight - 12;
  }

  const projects = student.projects || [];
  if (projects.length > 0) {
    drawSectionTitle('Portfolio');

    projects.forEach((proj, idx) => {
      checkPageBreak(75);

      const titleText = sanitizePdfText(proj.title || 'Untitled Project');
      const categoryTag = sanitizePdfText(proj.category ? `[${proj.category}]` : '');
      const linkUrl = sanitizePdfText(proj.url || proj.project_url || '');

      let timelineStr = '';
      if (proj.start_date && proj.end_date) {
        timelineStr = `${proj.start_date} – ${proj.end_date}`;
      } else if (proj.start_date) {
        timelineStr = proj.is_current ? `${proj.start_date} – Present` : proj.start_date;
      } else if (proj.duration) {
        timelineStr = proj.duration;
      }

      page.drawText(titleText, {
        x: margin,
        y: cursorY,
        size: 10.5,
        font: fontBodyBold,
        color: cBlack,
      });

      const titleWidth = fontBodyBold.widthOfTextAtSize(titleText, 10.5);

      if (categoryTag) {
        page.drawText(categoryTag, {
          x: margin + titleWidth + 6,
          y: cursorY,
          size: 8,
          font: fontBody,
          color: cAccent,
        });
      }

      if (timelineStr) {
        const timeText = sanitizePdfText(timelineStr);
        const timeW = fontBodyOblique.widthOfTextAtSize(timeText, 8);
        page.drawText(timeText, {
          x: width - margin - timeW,
          y: cursorY,
          size: 8,
          font: fontBodyOblique,
          color: cMuted,
        });
      } else if (linkUrl) {
        const linkDisplay = linkUrl.length > 36 ? linkUrl.slice(0, 34) + '...' : linkUrl;
        const linkW = fontBody.widthOfTextAtSize(linkDisplay, 8);
        page.drawText(linkDisplay, {
          x: width - margin - linkW,
          y: cursorY,
          size: 8,
          font: fontBody,
          color: cAccent,
        });
      }

      cursorY -= 13;

      if (proj.description) {
        const descHeight = drawWrappedText(proj.description, {
          x: margin,
          y: cursorY,
          size: 8.5,
          font: fontBody,
          color: cBody,
          maxWidth: contentWidth,
          lineHeight: 12,
        });
        cursorY -= (descHeight + 2);
      }

      if (proj.tools_used && proj.tools_used.length > 0) {
        const toolsStr = sanitizePdfText(`Technologies: ${proj.tools_used.join(', ')}`);
        page.drawText(toolsStr, {
          x: margin,
          y: cursorY,
          size: 8,
          font: fontBodyOblique,
          color: cMuted,
        });
        cursorY -= 11;
      }

      if (idx < projects.length - 1) {
        cursorY -= 4;
        page.drawLine({
          start: { x: margin, y: cursorY },
          end: { x: width - margin, y: cursorY },
          thickness: 0.5,
          color: cSubtleLine,
        });
        cursorY -= 8;
      } else {
        cursorY -= 8;
      }
    });
  }

  const certs = student.certifications || [];
  const asmts = (student.assessments || []).filter(a => a.passed);

  if (certs.length > 0 || asmts.length > 0) {
    drawSectionTitle('Certifications & Assessments');

    const allItems = [
      ...certs.map(c => ({
        title: sanitizePdfText(c.name),
        meta: sanitizePdfText(`${c.issuer || 'Credential'}${c.issue_date ? ` (${c.issue_date})` : ''}`),
        badge: 'Verified'
      })),
      ...asmts.map(a => ({
        title: sanitizePdfText(a.title || a.code || 'Assessment'),
        meta: sanitizePdfText(`${a.institution || 'Assessment Suite'} • Scored ${Math.round(a.score_pct || a.score * 100)}%`),
        badge: 'Passed'
      }))
    ];

    allItems.forEach((item, idx) => {
      checkPageBreak(25);

      page.drawText(`• ${item.title}`, {
        x: margin,
        y: cursorY,
        size: 9,
        font: fontBodyBold,
        color: cBlack,
      });

      const titleW = fontBodyBold.widthOfTextAtSize(`• ${item.title} `, 9);
      page.drawText(`— ${item.meta}`, {
        x: margin + titleW,
        y: cursorY,
        size: 8.5,
        font: fontBody,
        color: cMuted,
      });

      const badgeW = fontBody.widthOfTextAtSize(item.badge, 7.5);
      page.drawText(item.badge, {
        x: width - margin - badgeW,
        y: cursorY,
        size: 7.5,
        font: fontBody,
        color: cAccent,
      });

      cursorY -= 12;

      if (idx < allItems.length - 1) {
        cursorY -= 2;
        page.drawLine({
          start: { x: margin + 12, y: cursorY },
          end: { x: width - margin, y: cursorY },
          thickness: 0.5,
          color: cSubtleLine,
        });
        cursorY -= 6;
      }
    });

    cursorY -= 8;
  }

  const totalPages = pdfDoc.getPageCount();
  for (let i = 0; i < totalPages; i++) {
    const p = pdfDoc.getPage(i);
    p.drawLine({
      start: { x: margin, y: 28 },
      end: { x: width - margin, y: 28 },
      thickness: 0.5,
      color: cLine,
    });

    p.drawText(`SkillBridge Profile • candidate/${student.id}`, {
      x: margin,
      y: 18,
      size: 7.5,
      font: fontBody,
      color: cMuted,
    });

    const pageStr = `Page ${i + 1} of ${totalPages}`;
    const pageW = fontBody.widthOfTextAtSize(pageStr, 7.5);
    p.drawText(pageStr, {
      x: width - margin - pageW,
      y: 18,
      size: 7.5,
      font: fontBody,
      color: cMuted,
    });
  }

  return await pdfDoc.save();
}
