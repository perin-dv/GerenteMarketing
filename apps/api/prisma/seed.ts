import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME?.trim() || "Administrador";
  const companyName = process.env.SEED_COMPANY_NAME?.trim() || "Tem Na Loja";

  if (!email || !password) {
    throw new Error("Defina SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD no apps/api/.env antes de executar o seed.");
  }

  if (password.length < 10) {
    throw new Error("A senha inicial precisa ter pelo menos 10 caracteres.");
  }

  const passwordHash = await hash(password, 12);
  const company = await prisma.company.upsert({
    where: { slug: slugify(companyName) },
    update: { name: companyName },
    create: { name: companyName, slug: slugify(companyName) },
  });

  const user = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, active: true },
    create: { email, name, passwordHash },
  });

  await prisma.membership.upsert({
    where: { userId_companyId: { userId: user.id, companyId: company.id } },
    update: { role: UserRole.OWNER },
    create: { userId: user.id, companyId: company.id, role: UserRole.OWNER },
  });

  console.log(`Usuário inicial preparado: ${email}`);
  console.log(`Empresa inicial preparada: ${companyName}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
