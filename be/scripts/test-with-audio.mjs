import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const api = 'http://localhost:3004/api/v1';
const prisma = new PrismaClient();
const admin = await prisma.appUser.findFirst({ where: { role: 'ADMIN' } });
const token = jwt.sign(
  { sub: admin.id, email: admin.email, role: admin.role },
  process.env.JWT_SECRET ?? 'finance-dev-jwt-secret',
  { expiresIn: '1h' },
);

const form = new FormData();
form.append('file', new Blob(['fake'], { type: 'application/octet-stream' }), 'demo.mp3');
form.append('songCode', `TEST-${Date.now()}`);
form.append('contestantCode', 'TS');
form.append('performerName', 'A');
form.append('authorName', 'B');
form.append('songTitle', 'C');
form.append('publicStatus', 'PUBLIC');

const res = await fetch(`${api}/music-tracks/with-audio`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
console.log(res.status, (await res.text()).slice(0, 300));
await prisma.$disconnect();
