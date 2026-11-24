import * as fs from 'fs';
import * as path from 'path';
import { redis } from './connection';
import { logger } from '../config/logger';

const FALLBACK_LUA_SCRIPT = `-- Reserve a slot for a sender respecting min-gap and hourly limit
local now      = tonumber(ARGV[1])
local minGap   = tonumber(ARGV[2])
local limit    = tonumber(ARGV[3])
local ns       = ARGV[4]
local gapKey   = ns .. KEYS[1]

-- Compute initial candidate slot
local gapVal   = redis.call('GET', gapKey)
local slot     = math.max(now, gapVal and tonumber(gapVal) or 0)
local origHour = math.floor(slot / 3600000)
local spilled  = 0

-- Find a window with capacity
for i = 0, 23 do
  local window  = math.floor(slot / 3600000)
  local cntKey  = ns .. KEYS[2] .. ':' .. window
  local cnt     = tonumber(redis.call('GET', cntKey) or '0')
  if cnt < limit then
    -- Reserve in this window
    redis.call('INCR', cntKey)
    -- TTL: 2 hours + 10 min margin
    redis.call('EXPIRE', cntKey, 7800)
    break
  end
  -- Spill to next window boundary
  slot     = (window + 1) * 3600000
  spilled  = 1
end

-- Update gap key: next free slot = slot + minGap
redis.call('SET', gapKey, slot + minGap, 'EX', 86400)

local window = math.floor(slot / 3600000)
return { slot, window, spilled }`;

function loadLuaScript(): string {
  const possiblePaths = [
    path.join(__dirname, 'scripts', 'reserveSlot.lua'),
    path.join(__dirname, '..', '..', 'src', 'redis', 'scripts', 'reserveSlot.lua'),
    path.join(process.cwd(), 'src', 'redis', 'scripts', 'reserveSlot.lua'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        return fs.readFileSync(p, 'utf-8');
      } catch {
        // Continue to next path
      }
    }
  }
  return FALLBACK_LUA_SCRIPT;
}

const luaScript = loadLuaScript();

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
