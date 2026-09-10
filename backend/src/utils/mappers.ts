import { User } from '@prisma/client';

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
};

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
