import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../db/connection.js';
import { getUniqueUserId } from '../lib/id-generator.js';
import { AuthenticationError, ConflictError, NotFoundError, AppError } from '../lib/errors.js';
import type { AuthUser, AuthResult } from '../types/index.js';
import type { RegisterInput, LoginInput } from '../schemas/auth.schema.js';

const JWT_SECRET = process.env.JWT_SECRET || 'skillbridge-jwt-secret-key-2026';
const JWT_EXPIRY = '7d';

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      institution_or_company: user.institution_or_company || null,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  const email = input.email.toLowerCase().trim();

  const { data: existingUser } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', email)
    .single();

  if (existingUser) {
    throw new ConflictError(`An account with email ${email} already exists`);
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(input.password, salt);

  const userId = await getUniqueUserId(
    input.name,
    email,
    input.role,
    input.institution_or_company
  );

  const newUser: AuthUser = {
    id: userId,
    name: input.name.trim(),
    email,
    role: input.role,
    institution_or_company: input.institution_or_company?.trim() || (input.role === 'recruiter' ? 'Tech Recruiter' : input.role === 'faculty' ? 'Academic Institution' : 'IIT Delhi'),
    created_at: new Date().toISOString(),
  };

  const { error: userInsertError } = await supabase.from('users').insert({
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    password_hash: passwordHash,
    role: newUser.role,
    institution_or_company: newUser.institution_or_company,
    metadata: { degree: input.degree || null },
    created_at: newUser.created_at,
    updated_at: newUser.created_at,
  });

  if (userInsertError) {
    throw new AppError(500, 'DB_ERROR', `Failed to create user: ${userInsertError.message}`);
  }

  if (input.role === 'student') {
    await supabase.from('students').upsert({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      degree: input.degree?.trim() || 'B.Tech in Computer Science',
      parsed_skills: [],
      projects: [],
      certifications: [],
      assessments: [],
      evaluated_skills: [],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  }

  const token = generateToken(newUser);
  return { token, user: newUser };
}

export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const email = input.email.toLowerCase().trim();

  const { data: user, error } = await supabase
    .from('users')
    .select('id, name, email, password_hash, role, institution_or_company, created_at')
    .eq('email', email)
    .single();

  if (error || !user) {
    throw new AuthenticationError('Invalid email or password');
  }

  const isMatch = await bcrypt.compare(input.password, user.password_hash);
  if (!isMatch) {
    throw new AuthenticationError('Invalid email or password');
  }

  const authUser: AuthUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    institution_or_company: user.institution_or_company || undefined,
    created_at: user.created_at,
  };

  const token = generateToken(authUser);
  return { token, user: authUser };
}

export async function getUserById(id: string): Promise<AuthUser> {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, name, email, role, institution_or_company, created_at')
    .eq('id', id)
    .single();

  if (error || !user) {
    throw new NotFoundError(`User ${id} not found`);
  }

  return user as AuthUser;
}
