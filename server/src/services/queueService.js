import Center from '../models/Center.js';
import Queue from '../models/Queue.js';
import { formatWait, todayISO } from '../utils/datetime.js';

const WAITING = Queue.WAITING_STATUSES;

export function maskName(name) {
  if (!name) return 'Farmer';
  const [first, ...rest] = name.trim().split(/\s+/);
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first;
}

/**
 * Builds the live view of one centre's queue for one date: who is being served,
 * who is waiting, and how long each waiting farmer should expect to wait.
 *
 * Position is derived from token order among waiting entries rather than stored,
 * so cancellations and no-shows correct everyone's position automatically.
 */
export async function getQueueState(centerId, date = todayISO()) {
  const center = await Center.findById(centerId).lean();
  if (!center) return null;

  const entries = await Queue.find({ center: centerId, date })
    .sort({ token: 1 })
    .populate('farmer', 'name phone village')
    .populate('slot', 'startTime endTime')
    .lean();

  const serving = entries.find((e) => e.status === 'serving') || null;
  const waiting = entries.filter((e) => WAITING.includes(e.status));
  const completed = entries.filter((e) => e.status === 'completed');
  const serviceMinutes = center.avgServiceMinutes || 12;

  const waitingWithPosition = waiting.map((entry, index) => {
    // Anyone currently being served finishes before the first waiting farmer starts.
    const ahead = index + (serving ? 1 : 0);
    const waitMinutes = ahead * serviceMinutes;
    const slotStr = entry.slot
      ? typeof entry.slot === 'object'
        ? `${entry.slot.startTime}–${entry.slot.endTime}`
        : String(entry.slot)
      : '';
    const farmerName = maskName(entry.farmer?.name);
    const village = entry.farmer?.village || '';

    return {
      _id: String(entry._id),
      token: entry.token,
      status: entry.status,
      position: index + 1,
      ahead,
      estimatedWaitMinutes: waitMinutes,
      estimatedWaitLabel: formatWait(waitMinutes),
      farmerName,
      village,
      slot: slotStr,
      crop: entry.crop || '',
      farmer: entry.farmer
        ? {
            _id: String(entry.farmer._id || ''),
            name: farmerName,
            village,
          }
        : null,
    };
  });

  return {
    center: { id: String(center._id), name: center.name, code: center.code, avgServiceMinutes: serviceMinutes },
    date,
    nowServing: serving ? { token: serving.token, since: serving.servingStartedAt } : null,
    waiting: waitingWithPosition,
    counts: {
      total: entries.length,
      waiting: waiting.length,
      completed: completed.length,
      cancelled: entries.filter((e) => ['cancelled', 'no_show'].includes(e.status)).length,
    },
    updatedAt: new Date().toISOString(),
  };
}

/** The same view, reduced to what one farmer needs to see about their own token. */
export async function getFarmerQueueView(farmerId, centerId, date) {
  const state = await getQueueState(centerId, date);
  if (!state) return null;

  const mine = state.waiting.find((e) => String(e.farmer?._id) === String(farmerId));
  return {
    center: state.center,
    date: state.date,
    nowServing: state.nowServing,
    totalWaiting: state.counts.waiting,
    you: mine
      ? {
          token: mine.token,
          status: mine.status,
          position: mine.position,
          ahead: mine.ahead,
          estimatedWaitMinutes: mine.estimatedWaitMinutes,
          estimatedWaitLabel: mine.estimatedWaitLabel,
        }
      : null,
  };
}

/** Next token number for a centre/date. Tokens restart at 1 each day, per centre. */
export async function nextToken(centerId, date) {
  const last = await Queue.findOne({ center: centerId, date }).sort({ token: -1 }).select('token').lean();
  return (last?.token || 0) + 1;
}

/** Farmers who just crossed the "get moving" threshold and should be texted. */
export function farmersToAlert(state, threshold = 3) {
  return state.waiting.filter((entry) => entry.ahead > 0 && entry.ahead <= threshold);
}
