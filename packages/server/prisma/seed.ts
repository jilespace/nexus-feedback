import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await argon2.hash('admin123');
  await prisma.admin.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', password_hash: passwordHash },
  });

  // Multi-tenant seed data
  const orgSlug = 'demo';
  const memberPasswordHash = await argon2.hash('admin123');
  const projectApiKey = 'nf_demo_project_key_789';
  const projectApiKeyHash = crypto.createHash('sha256').update(projectApiKey).digest('hex');

  const existingOrg = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!existingOrg) {
    await prisma.organization.create({
      data: {
        name: 'Demo Org',
        slug: orgSlug,
        members: {
          create: {
            email: 'admin@nexus.dev',
            password_hash: memberPasswordHash,
            display_name: 'Admin',
            role: 'owner',
          },
        },
        projects: {
          create: {
            name: 'Demo Project',
            slug: 'demo-project',
            api_key_hash: projectApiKeyHash,
            api_key_prefix: projectApiKey.slice(0, 8),
            allowed_origins: ['http://localhost:8080'],
          },
        },
      },
    });
  }

  console.log('Seed complete.');
  console.log(`Demo Project API Key: ${projectApiKey}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
