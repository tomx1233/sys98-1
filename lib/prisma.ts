import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function create(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — see .env.example");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

function client(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = create();
  return globalForPrisma.prisma;
}

// Lazy on purpose: `next build` imports route modules without a database around,
// so the connection (and the missing-env error) only happens on first real use.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const c = client() as unknown as Record<string | symbol, unknown>;
    const value = c[prop];
    return typeof value === "function" ? value.bind(c) : value;
  },
});
