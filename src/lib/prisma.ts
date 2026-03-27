import { PrismaClient } from '@prisma/client';

function buildDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const json = process.env.DATABASE_CONNECTION_DETAILS;
  if (json) {
    const d = JSON.parse(json);
    const password = encodeURIComponent(d.password);
    const port = d.port || 5432;
    const dbname = d.dbname || 'people_project';
    return `postgresql://${d.username}:${password}@${d.host}:${port}/${dbname}?sslmode=require`;
  }

  throw new Error('DATABASE_URL or DATABASE_CONNECTION_DETAILS must be set');
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: buildDatabaseUrl(),
    },
  },
});

// Prevent hot reload from creating new Prisma Client instances
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
