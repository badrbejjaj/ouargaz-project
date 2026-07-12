import { exec } from 'child_process';
import { NextResponse } from 'next/server';

/**
 * POST /api/migrate-seed
 *
 * Runs Prisma migrations (deploy) and then executes the seed script.
 * This endpoint is intended for one‑off production initialisation.
 *
 * SECURITY: It requires a secret token passed in the `Authorization` header
 * (`Bearer <TOKEN>`). Set the token in Vercel as `MIGRATE_SEED_TOKEN`.
 */
export async function POST(req: Request) {
  const auth = req.headers.get('authorization');
  const expected = process.env.MIGRATE_SEED_TOKEN;
  if (!expected || auth !== `Bearer ${expected}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // Run migrations in production (deploy) mode
    await new Promise((resolve, reject) => {
      exec('npx prisma migrate deploy', (error, stdout, stderr) => {
        if (error) {
          console.error('Migrate error:', stderr);
          reject(error);
        } else {
          console.log('Migrate output:', stdout);
          resolve(undefined);
        }
      });
    });

    // Run the seed script (node prisma/seed.ts)
    await new Promise((resolve, reject) => {
      exec('node prisma/seed.ts', (error, stdout, stderr) => {
        if (error) {
          console.error('Seed error:', stderr);
          reject(error);
        } else {
          console.log('Seed output:', stdout);
          resolve(undefined);
        }
      });
    });

    return NextResponse.json({ ok: true, message: 'Migrations and seed applied successfully' });
  } catch (e: any) {
    console.error('Migration & seed failure:', e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'unknown' }, { status: 500 });
  }
}
