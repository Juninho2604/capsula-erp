
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('👤 Verificando usuarios...');

    const existingUser = await prisma.user.findFirst({
        where: { email: 'admin@shanklish.com' }
    });

    if (existingUser) {
        console.log('✅ Usuario admin ya existe:', existingUser.id);
        return;
    }

    const user = await prisma.user.create({
        data: {
            email: 'admin@shanklish.com',
            password: 'admin', // En prod usar hash
            firstName: 'Admin',
            lastName: 'Sistema',
            role: 'ADMIN',
        }
    });

    console.log('✅ Usuario creado exitosamente:', user.id);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
