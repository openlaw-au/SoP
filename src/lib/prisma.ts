import { PrismaClient } from '@prisma/client';

function buildDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const user = process.env.DATABASE_USERNAME;
  const password = process.env.DATABASE_PASSWORD;
  const host = process.env.DATABASE_HOST;
  const port = process.env.DATABASE_PORT || '5432';
  const name = process.env.DATABASE_NAME;

  if (user && password && host && name) {
    return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${name}?sslmode=require`;
  }

  throw new Error('DATABASE_URL or DATABASE_USERNAME/PASSWORD/HOST/NAME must be set');
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
