import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const rows = await prisma.musicTrack.findMany({
  orderBy: { createdAt: 'desc' },
  take: 10,
});
console.log(JSON.stringify(rows, null, 2));
await prisma.$disconnect();
