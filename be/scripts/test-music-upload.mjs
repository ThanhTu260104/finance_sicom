import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const api = 'http://localhost:3004/api/v1';
const prisma = new PrismaClient();
const admin = await prisma.appUser.findFirst({ where: { role: 'ADMIN' } });
if (!admin) throw new Error('no admin');
const token = jwt.sign(
  { sub: admin.id, email: admin.email, role: admin.role },
  process.env.JWT_SECRET ?? 'finance-dev-jwt-secret',
  { expiresIn: '1h' },
);

const trackId = '213b6c1c-6e04-41b0-b94e-fba23540344b';
const tmp = join(process.cwd(), 'scripts', 'test-audio.mp3');
writeFileSync(tmp, Buffer.from('fake mp3 content for test'));

const form = new FormData();
form.append('file', new Blob([readFileSync(tmp)], { type: 'audio/mpeg' }), 'test.mp3');

const uploadRes = await fetch(`${api}/music-tracks/${trackId}/audio`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
const uploadText = await uploadRes.text();
console.log('Upload status', uploadRes.status);
console.log(uploadText.slice(0, 800));

await prisma.$disconnect();
