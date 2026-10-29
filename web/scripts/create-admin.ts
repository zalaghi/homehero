import { getPrisma } from "../src/server/db/prisma";
import { hashPassword } from "../src/server/auth/password";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

async function main() {
  const prisma = getPrisma();
  const email = (argValue("--email") ?? process.env.ADMIN_EMAIL)?.trim().toLowerCase();
  const password = argValue("--password") ?? process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("Usage: npm run create:admin -- --email you@example.com --password 'long password'");
    process.exit(1);
  }

  const existing = await prisma.authUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin already exists for ${email}`);
    return;
  }

  const passwordHash = await hashPassword(password);
  await prisma.authUser.create({
    data: {
      role: "ADMIN",
      email,
      passwordHash,
    },
  });

  console.log(`Created admin user: ${email}`);

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });

