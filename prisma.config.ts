import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// The Prisma CLI doesn't read Next's env files on its own.
config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Not required for `prisma generate` (runs on postinstall), only for db push / studio.
    url: process.env.DATABASE_URL,
  },
});
