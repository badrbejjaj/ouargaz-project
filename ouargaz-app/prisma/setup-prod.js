const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'schema.prisma');
let content = fs.readFileSync(schemaPath, 'utf8');

// Vercel sets the VERCEL environment variable to "1" during build
if (process.env.VERCEL) {
  content = content.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');
  fs.writeFileSync(schemaPath, content);
  console.log('✅ Updated Prisma schema to use PostgreSQL for Vercel deployment.');
} else {
  console.log('ℹ️ Local environment detected. Keeping SQLite provider.');
}
