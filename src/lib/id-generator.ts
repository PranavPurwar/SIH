import { supabase } from '../db/connection.js';

export function slugify(text: string): string {
  if (!text) return 'user';
  return text
    .toLowerCase()
    .replace(/^(prof\.|professor|dr\.|mr\.|ms\.|mrs\.)\s+/i, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export async function getUniqueUserId(
  name: string,
  email: string,
  role?: string,
  companyOrInstitution?: string
): Promise<string> {
  let base = 'user';
  if (role === 'recruiter' && companyOrInstitution) {
    base = slugify(companyOrInstitution);
  } else if (name && name.trim()) {
    base = slugify(name);
  } else if (email) {
    base = slugify(email.split('@')[0]);
  } else if (role) {
    base = `${role}-user`;
  }

  if (base.length < 2) base = 'user';

  let candidate = base;
  let counter = 1;

  while (true) {
    const { data } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', candidate)
      .single();

    if (!data || data.email?.toLowerCase() === email?.toLowerCase()) {
      break;
    }

    counter++;
    candidate = `${base}-${counter}`;
  }

  return candidate;
}
