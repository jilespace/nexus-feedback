import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/client.js';
import { env } from '../config/index.js';
import { AuthError } from '../utils/errors.js';

export async function adminLogin(username: string, password: string) {
  const admin = await prisma.admin.findUnique({ where: { username } });
  if (!admin) {
    throw new AuthError(40110, 'Invalid credentials');
  }

  const valid = await argon2.verify(admin.password_hash, password);
  if (!valid) {
    throw new AuthError(40110, 'Invalid credentials');
  }

  // Get the first organization for the admin
  const firstOrg = await prisma.organization.findFirst();
  const defaultOrgId = firstOrg?.id;

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const token = jwt.sign(
    { sub: admin.id, orgId: defaultOrgId, typ: 'admin' },
    env.JWT_SECRET,
    {
      expiresIn: '24h',
      algorithm: 'HS256',
    }
  );

  return {
    token,
    expires_at: expiresAt.toISOString(),
  };
}
