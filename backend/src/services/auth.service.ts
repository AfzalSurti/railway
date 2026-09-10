import { User } from '@prisma/client';
import { userRepository } from '../repositories/user.repository';
import { hashPassword, comparePassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { AppError } from '../utils/AppError';
import { toPublicUser, PublicUser } from '../utils/mappers';
import { LoginInput, RegisterInput } from '../schemas/auth.schema';

export type AuthResult = {
  user: PublicUser;
  token: string;
};

export const authService = {
  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw AppError.conflict('An account with this email already exists');
    }

    const passwordHash = await hashPassword(input.password);
    const user = await userRepository.create({
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash,
    });

    return {
      user: toPublicUser(user),
      token: signToken(user.id),
    };
  },

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await userRepository.findByEmail(input.email);
    if (!user) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const matches = await comparePassword(input.password, user.passwordHash);
    if (!matches) {
      throw AppError.unauthorized('Invalid email or password');
    }

    return {
      user: toPublicUser(user),
      token: signToken(user.id),
    };
  },

  async getCurrentUser(userId: string): Promise<PublicUser> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw AppError.unauthorized('User not found');
    }
    return toPublicUser(user);
  },

  async requireUser(userId: string): Promise<User> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw AppError.unauthorized('User not found');
    }
    return user;
  },
};
