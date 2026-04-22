import 'dotenv/config';
import path from 'node:path';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@/lib/generated/prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
}

function resolveDatabaseUrl(): string {
  // Prisma 7 resolves `file:./path` relative to cwd (not the schema dir).
  // We mirror that so the app reads the same DB file as migrations/seed.
  const raw = process.env.DATABASE_URL ?? 'file:./dev.db';
  const filePath = raw.startsWith('file:') ? raw.slice('file:'.length) : raw;
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(process.cwd(), filePath);
}

function createClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: `file:${resolveDatabaseUrl()}` });
  return new PrismaClient({ adapter });
}

export const prisma = global.prisma ?? createClient();
if (process.env.NODE_ENV !== 'production') global.prisma = prisma;
