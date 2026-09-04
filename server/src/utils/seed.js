/* eslint-disable no-console */
import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';
import Center from '../models/Center.js';
import Staff from '../models/Staff.js';
import Slot from '../models/Slot.js';
import { todayISO, addDaysISO, minutesOfDay, toHHMM } from './datetime.js';

/** Seeds a couple of demo centres, an admin login, and a week of open slots. */
async function seed() {
  await connectDB(env.mongoUri);

  const centersData = [
    {
      name: 'Rampur Mandi Procurement Centre',
      code: 'RAMPUR01',
      district: 'Rampur',
      state: 'Uttar Pradesh',
      address: 'Mandi Road, Rampur',
      crops: ['wheat', 'paddy'],
      dailyCapacity: 150,
      avgServiceMinutes: 10,
      openTime: '08:00',
      closeTime: '17:00',
      contactPhone: '9990000001',
    },
    {
      name: 'Nabha PACS Procurement Centre',
      code: 'NABHA01',
      district: 'Patiala',
      state: 'Punjab',
      address: 'Grain Market, Nabha',
      crops: ['paddy', 'wheat', 'maize'],
      dailyCapacity: 200,
      avgServiceMinutes: 8,
      openTime: '07:00',
      closeTime: '18:00',
      contactPhone: '9990000002',
    },
  ];

  const centers = [];
  for (const data of centersData) {
    const center = await Center.findOneAndUpdate({ code: data.code }, data, { upsert: true, new: true });
    centers.push(center);
    console.log(`[seed] centre ready: ${center.name} (${center.code})`);
  }

  const subUser = await Staff.findOne({ $or: [{ username: 'SUB' }, { email: 'sub@sih26032.local' }] });
  if (!subUser) {
    await Staff.create({
      username: 'SUB',
      email: 'sub@sih26032.local',
      passwordHash: await Staff.hashPassword('SUB'),
      name: 'System Administrator (SUB)',
      role: 'admin',
    });
    console.log('[seed] admin user SUB created with password SUB');
  }

  const adminEmail = 'admin@sih26032.local';
  const existingAdmin = await Staff.findOne({ email: adminEmail });
  if (!existingAdmin) {
    await Staff.create({
      email: adminEmail,
      passwordHash: await Staff.hashPassword('ChangeMe123!'),
      name: 'District Admin',
      role: 'admin',
    });
    console.log(`[seed] admin login created: ${adminEmail} / ChangeMe123!`);
  }

  const operatorEmail = 'operator@sih26032.local';
  const existingOperator = await Staff.findOne({ email: operatorEmail });
  if (!existingOperator) {
    await Staff.create({
      email: operatorEmail,
      passwordHash: await Staff.hashPassword('ChangeMe123!'),
      name: 'Rampur Operator',
      role: 'operator',
      center: centers[0]._id,
    });
    console.log(`[seed] operator login created: ${operatorEmail} / ChangeMe123!`);
  }

  const today = todayISO();
  let slotsCreated = 0;
  for (const center of centers) {
    for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
      const date = addDaysISO(today, dayOffset);
      const start = minutesOfDay(center.openTime);
      const end = minutesOfDay(center.closeTime);
      const slotLength = 30;
      const perSlotCapacity = Math.max(1, Math.round(slotLength / center.avgServiceMinutes));

      for (let t = start; t + slotLength <= end; t += slotLength) {
        try {
          await Slot.create({
            center: center._id,
            date,
            startTime: toHHMM(t),
            endTime: toHHMM(t + slotLength),
            capacity: perSlotCapacity,
            crop: 'any',
          });
          slotsCreated += 1;
        } catch (err) {
          if (err.code !== 11000) throw err;
        }
      }
    }
  }
  console.log(`[seed] created ${slotsCreated} new slot windows across ${centers.length} centres`);

  await disconnectDB();
  console.log('[seed] done');
}

seed().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
