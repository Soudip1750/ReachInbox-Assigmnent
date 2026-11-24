-- Reserve a slot for a sender respecting min-gap and hourly limit
-- KEYS[1]: gap:{sender}         (next free send epoch ms)
-- KEYS[2]: cnt_prefix:{sender}  (prefix; we'll append :{window} inside)
-- ARGV[1]: nowMs
-- ARGV[2]: minGapMs
-- ARGV[3]: hourlyLimit
-- ARGV[4]: ri: (namespace prefix)
-- Returns: { slot (ms), window, spilled (0|1) }

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
return { slot, window, spilled }
