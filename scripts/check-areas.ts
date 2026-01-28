
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const areas = await prisma.area.findMany();
    console.log('Áreas encontradas:');
    areas.forEach(a => console.log(`- [${a.id}] "${a.name}" (Slug: ${a.slug})`));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
