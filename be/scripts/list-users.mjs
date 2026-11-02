import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const u = await p.appUser.findMany({ select: { email: true, role: true } });
console.log(u);
await p.$disconnect();
