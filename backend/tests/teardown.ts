import { prisma } from '../src/config/database';

export default async function teardown(): Promise<void> {
  await prisma.$disconnect();
}
