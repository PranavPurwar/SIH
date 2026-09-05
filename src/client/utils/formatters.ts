/**
 * Utility string and date formatting helpers
 */

export function decodeHtml(html?: string): string {
  if (!html) return '';
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  let text = txt.value;
  text = text.replace(/\{\{[%<]\s*[a-zA-Z0-9_]+\s+"[^"]+"\s+"([^"]+)"\s*[%>]\}\}/g, '$1');
  text = text.replace(/\{\{[%<].*?[%>]\}\}/g, '');
  text = text.replace(/\s{2,}/g, ' ').trim();
  text = text.replace(/\*{3}([^*]+)\*{3}/g, '<strong>$1</strong>');
  text = text.replace(/\*{2}([^*]+)\*{2}/g, '<strong>$1</strong>');
  return text;
}

export function formatMonthYear(val?: string | number): string {
  if (!val) return '';
  const str = String(val).trim();
  if (str.toLowerCase() === 'present' || str.toLowerCase() === 'current') return 'Present';

  // If in YYYY-MM or YYYY-MM-DD format
  if (/^\d{4}-\d{2}/.test(str)) {
    const parts = str.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const d = new Date(year, month, 1);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
  }

  // If standard 4-digit year
  if (/^\d{4}$/.test(str)) {
    return str;
  }

  // Already formatted string like "Jan 2023"
  return str;
}

export function formatTimeline(startDate?: string, endDate?: string, isCurrent?: boolean, duration?: string): string {
  if (duration && !startDate && !endDate) return duration;

  const start = formatMonthYear(startDate);
  const end = isCurrent ? 'Present' : formatMonthYear(endDate);

  if (start && end) {
    return `${start} – ${end}`;
  }
  if (start) {
    return isCurrent ? `${start} – Present` : start;
  }
  if (end) {
    return end;
  }
  return '';
}

export function formatDate(iso?: string | Date): string {
  if (!iso) return 'Recent';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Recent';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
