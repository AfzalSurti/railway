import { ProviderSession, ProviderSessionStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

/**
 * Provider session abstraction (Phase 5.3).
 *
 * A ProviderSession is an opaque handle to a session that a human established
 * with a provider (e.g. after completing login + OTP). We store only:
 *   - which user + provider it belongs to
 *   - an opaque `reference` (never a raw password, cookie jar, or OTP)
 *   - a status and an expiry
 *
 * Authenticated browser storage state is intentionally NOT persisted in this
 * phase. This module just models the lifecycle so later phases can attach a
 * real, encrypted secret store behind the same interface.
 */

export type ProviderSessionView = {
  id: string;
  provider: string;
  status: ProviderSessionStatus;
  createdAt: string;
  expiresAt: string;
};

function toView(session: ProviderSession): ProviderSessionView {
  return {
    id: session.id,
    provider: session.provider,
    status: session.status,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
  };
}

export const providerSessionService = {
  async create(input: {
    userId: string;
    provider: string;
    reference: string;
    ttlMs: number;
  }): Promise<ProviderSessionView> {
    // Supersede any prior active session for this user + provider.
    await prisma.providerSession.updateMany({
      where: { userId: input.userId, provider: input.provider.toUpperCase(), status: 'ACTIVE' },
      data: { status: 'REVOKED' },
    });
    const session = await prisma.providerSession.create({
      data: {
        userId: input.userId,
        provider: input.provider.toUpperCase(),
        reference: input.reference,
        expiresAt: new Date(Date.now() + input.ttlMs),
      },
    });
    logger.info('Provider session created', {
      service: 'api',
      event: 'PROVIDER_SESSION_CREATED',
      provider: session.provider,
      // reference is deliberately not logged
    });
    return toView(session);
  },

  async getActive(userId: string, provider: string): Promise<ProviderSession | null> {
    const session = await prisma.providerSession.findFirst({
      where: { userId, provider: provider.toUpperCase(), status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    if (!session) {
      return null;
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      await prisma.providerSession.update({ where: { id: session.id }, data: { status: 'EXPIRED' } });
      return null;
    }
    return session;
  },

  async isValid(userId: string, provider: string): Promise<boolean> {
    return (await this.getActive(userId, provider)) !== null;
  },

  async revoke(id: string): Promise<void> {
    await prisma.providerSession
      .update({ where: { id }, data: { status: 'REVOKED' } })
      .catch(() => undefined);
  },

  async expireOverdue(now = new Date()): Promise<number> {
    const result = await prisma.providerSession.updateMany({
      where: { status: 'ACTIVE', expiresAt: { lt: now } },
      data: { status: 'EXPIRED' },
    });
    return result.count;
  },
};
