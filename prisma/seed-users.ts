
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const USERS = [
    // Nivel 1: Dueños
    { firstName: 'Carlos', lastName: 'Dueño', email: 'carlos@shanklish.com', role: 'OWNER' },
    { firstName: 'Nour', lastName: 'Dueño', email: 'nour@shanklish.com', role: 'OWNER' },

    // Nivel 2: Auditor
    { firstName: 'Christian', lastName: 'Auditor', email: 'christian@shanklish.com', role: 'AUDITOR' },

    // Nivel 3: Gerentes Admin
    { firstName: 'Maurizio', lastName: 'Administrador', email: 'maurizio@shanklish.com', role: 'GERENTE_ADMIN' },
    { firstName: 'David', lastName: 'Administrador', email: 'david@shanklish.com', role: 'GERENTE_ADMIN' },

    // Nivel 4: Gerentes Ops
    { firstName: 'Nahomy', lastName: 'Operaciones', email: 'nahomy@shanklish.com', role: 'GERENTE_OPS' },
    { firstName: 'Omar', lastName: 'Operaciones', email: 'omar@shanklish.com', role: 'GERENTE_OPS' },

    // Nivel 5: RRHH
    { firstName: 'Karina', lastName: 'RRHH', email: 'karina@shanklish.com', role: 'RRHH' },

    // Nivel 6: Chefs
    { firstName: 'Victor', lastName: 'Chef', email: 'victor@shanklish.com', role: 'CHEF' },
    { firstName: 'Miguel', lastName: 'Chef', email: 'miguel@shanklish.com', role: 'CHEF' },

    // Nivel 7: Jefes de Area
    { firstName: 'Oscar', lastName: 'Jefe Area', email: 'oscar@shanklish.com', role: 'JEFE_AREA' },
    { firstName: 'Ramiro', lastName: 'Jefe Area', email: 'ramiro@shanklish.com', role: 'JEFE_AREA' },
    { firstName: 'Hadkin', lastName: 'Jefe Area', email: 'hadkin@shanklish.com', role: 'JEFE_AREA' },
    { firstName: 'Alexis', lastName: 'Jefe Area', email: 'alexis@shanklish.com', role: 'JEFE_AREA' },
    { firstName: 'Yair', lastName: 'Jefe Area', email: 'yair@shanklish.com', role: 'JEFE_AREA' },
];

async function main() {
    console.log('👥 Iniciando carga de usuarios...');

    // Limpiar usuarios anteriores (Opcional, cuidado en prod)
    // await prisma.user.deleteMany(); 

    for (const u of USERS) {
        // Verificar si existe
        const exists = await prisma.user.findUnique({
            where: { email: u.email }
        });

        if (!exists) {
            await prisma.user.create({
                data: {
                    email: u.email,
                    firstName: u.firstName,
                    lastName: u.lastName,
                    role: u.role,
                    passwordHash: 'shanklish123', // Password temporal simple
                }
            });
            console.log(`✅ Creado: ${u.firstName} (${u.role})`);
        } else {
            // Actualizar rol si cambió
            await prisma.user.update({
                where: { email: u.email },
                data: { role: u.role }
            });
            console.log(`🔄 Actualizado: ${u.firstName} (${u.role})`);
        }
    }

    console.log('✅ Carga de usuarios completada.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
