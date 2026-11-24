import { prisma } from '../src/db/prisma';

async function main() {
  try {
    const deleted = await prisma.user.deleteMany({
      where: {
        OR: [
          { googleId: 'dev-mock-google-id' },
          { email: 'demo.tester@reachinbox.local' },
        ],
      },
    });
    console.log(`Deleted ${deleted.count} quick test user(s).`);

    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true },
    });
    console.log('Current users in database:', users);
  } catch (error) {
    console.error('Error deleting test user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
