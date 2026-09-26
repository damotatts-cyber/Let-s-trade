import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __guardrailPrisma: PrismaClient | undefined;
}

export function getPrismaClient(): PrismaClient | null {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!global.__guardrailPrisma) {
    global.__guardrailPrisma = new PrismaClient();
  }

  return global.__guardrailPrisma;
}
