import * as fs from 'fs';
import * as path from 'path';
import { redis } from './connection';
import { logger } from '../config/logger';

const luaScript = fs.readFileSync(
  path.join(__dirname, 'scripts', 'reserveSlot.lua'),
  'utf-8'
);

const NS = 'ri:';

export interface SlotResult {
  slot: number;
  window: number;
  spilled: boolean;
}

/**
 * Atomically reserve a send slot for a sender.
 * Respects minGapMs between sends and hourlyLimit per sender per window.
 */
export async function reserveSlot(
  senderId: string,
  nowMs: number,
  minGapMs: number,
  hourlyLimit: number
): Promise<SlotResult> {
  const gapKey = `gap:${senderId}`;
  const cntKey = `cnt:${senderId}`;

  const result = (await redis.eval(
    luaScript,
    2,
    gapKey,
    cntKey,
    String(nowMs),
    String(minGapMs),
    String(hourlyLimit),
    NS
  )) as [number, number, number];

  return {
    slot: result[0],
    window: result[1],
    spilled: result[2] === 1,
  };
}

/**
 * Increment the sent counter for a sender+window.
 * Returns the new count. If count equals limit, the caller should send a Slack notification.
 */
export async function incrSent(senderId: string, window: number): Promise<number> {
  const key = `${NS}sent:${senderId}:${window}`;
  const count = await redis.incr(key);
  await redis.expire(key, 7800); // 2h + margin
  return count;
}

/**
 * Check whether a slot is still valid (not expired).
 */
export async function getSlotStatus(senderId: string): Promise<number | null> {
  const key = `${NS}gap:${senderId}`;
  const val = await redis.get(key);
  return val ? parseInt(val, 10) : null;
}

/**
 * Acquire a reconciler lock (NX + PX).
 * Returns true if lock was acquired.
 */
export async function acquireReconcilerLock(ttlMs: number): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (redis as any).set(
    `${NS}reconciler:lock`,
    '1',
    'NX',
    'PX',
    ttlMs
  );
  return result === 'OK';
}

export async function releaseReconcilerLock(): Promise<void> {
  await redis.del(`${NS}reconciler:lock`);
}

logger.debug('Rate limiter module loaded');
