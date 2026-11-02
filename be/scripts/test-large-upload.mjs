import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const api = 'http://localhost:3004/api/v1';
const prisma = new PrismaClient();
const admin = await prisma.appUser.findFirst({ where: { role: 'ADMIN' } });
const token = jwt.sign(
  { sub: admin.id, email: admin.email, role: admin.role },
  process.env.JWT_SECRET ?? 'finance-dev-jwt-secret',
  { expiresIn: '1h' },
);

const tmp = join(process.cwd(), 'scripts', 'big-test.mp3');
writeFileSync(tmp, Buffer.alloc(8 * 1024 * 1024, 1));
const form = new FormData();
form.append('file', new Blob([Buffer.alloc(8 * 1024 * 1024, 1)], { type: 'audio/mpeg' }), 'big.mp3');
form.append('songCode', `BIG-${Date.now()}`);
form.append('contestantCode', 'TS');
form.append('performerName', 'A');
form.append('authorName', 'B');
form.append('songTitle', 'Big');
form.append('publicStatus', 'PUBLIC');

const t0 = Date.now();
const res = await fetch(`${api}/music-tracks/with-audio`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
console.log('status', res.status, 'ms', Date.now() - t0);
try {
  unlinkSync(tmp);
} catch {
  /* ignore */
}
await prisma.$disconnect();
