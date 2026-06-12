import { createHash, randomBytes } from 'crypto';
import { prisma } from '../lib/prisma.js';

export type AuthUser = { id: string; username: string; nombre: string; rol: string };

const SESSION_DAYS = 14;

export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export async function login(
  username: string,
  password: string
): Promise<{ user: AuthUser; token: string } | null> {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || user.passwordHash !== hashPassword(password)) return null;

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  await prisma.session.create({
    data: { userId: user.id, token, expiresAt }
  });

  return {
    user: { id: user.id, username: user.username, nombre: user.nombre, rol: user.rol },
    token
  };
}

export async function validateToken(token: string): Promise<AuthUser | null> {
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true }
  });
  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } });
    return null;
  }
  const u = session.user;
  return { id: u.id, username: u.username, nombre: u.nombre, rol: u.rol };
}

export async function logout(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } });
}

export async function migrateLegacyUsername(): Promise<void> {
  const legacy = await prisma.user.findUnique({ where: { username: 'yennifer' } });
  if (!legacy) return;
  const taken = await prisma.user.findUnique({ where: { username: 'jeniffer' } });
  if (!taken) {
    await prisma.user.update({
      where: { id: legacy.id },
      data: { username: 'jeniffer', nombre: 'Jeniffer' }
    });
  }
}

export async function listUsers(): Promise<AuthUser[]> {
  const users = await prisma.user.findMany({ orderBy: { username: 'asc' } });
  return users.map((u) => ({
    id: u.id,
    username: u.username,
    nombre: u.nombre,
    rol: u.rol
  }));
}

export async function createUser(input: {
  username: string;
  nombre: string;
  password: string;
  rol: string;
}): Promise<AuthUser> {
  const existing = await prisma.user.findUnique({ where: { username: input.username } });
  if (existing) throw new Error('Usuario ya existe');

  const user = await prisma.user.create({
    data: {
      username: input.username,
      nombre: input.nombre,
      passwordHash: hashPassword(input.password),
      rol: input.rol
    }
  });
  return { id: user.id, username: user.username, nombre: user.nombre, rol: user.rol };
}

export async function updateUser(
  id: string,
  input: { nombre?: string; password?: string; rol?: string }
): Promise<AuthUser> {
  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(input.nombre != null && { nombre: input.nombre }),
      ...(input.rol != null && { rol: input.rol }),
      ...(input.password != null && { passwordHash: hashPassword(input.password) })
    }
  });
  return { id: user.id, username: user.username, nombre: user.nombre, rol: user.rol };
}

export async function deleteUser(id: string): Promise<AuthUser> {
  await prisma.session.deleteMany({ where: { userId: id } });
  const user = await prisma.user.delete({ where: { id } });
  return { id: user.id, username: user.username, nombre: user.nombre, rol: user.rol };
}

export async function seedUsers(): Promise<void> {
  await migrateLegacyUsername();
  const count = await prisma.user.count();
  if (count > 0) return;
  await prisma.user.createMany({
    data: [
      {
        username: 'admin',
        nombre: 'Administrador',
        passwordHash: hashPassword('Admi123'),
        rol: 'admin'
      },
      {
        username: 'jeniffer',
        nombre: 'Jeniffer',
        passwordHash: hashPassword('1234'),
        rol: 'operador'
      }
    ]
  });
}
