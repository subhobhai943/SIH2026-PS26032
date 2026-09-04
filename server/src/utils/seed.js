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
    // --- Uttar Pradesh ---
    {
      name: 'Rampur Mandi Procurement Centre',
      code: 'RAMPUR01',
      district: 'Rampur',
      state: 'Uttar Pradesh',
      address: 'Mandi Road, Rampur, UP - 244901',
      location: { type: 'Point', coordinates: [79.0270, 28.8154] },
      crops: ['wheat', 'paddy'],
      dailyCapacity: 150,
      avgServiceMinutes: 10,
      openTime: '08:00',
      closeTime: '17:00',
      contactPhone: '0595-2350121',
    },
    {
      name: 'Aligarh Krishi Upaj Mandi',
      code: 'ALIGARH01',
      district: 'Aligarh',
      state: 'Uttar Pradesh',
      address: 'Dhanipur Mandi Samiti, GT Road, Aligarh, UP - 202001',
      location: { type: 'Point', coordinates: [78.0782, 27.8974] },
      crops: ['wheat', 'paddy', 'mustard', 'maize'],
      dailyCapacity: 180,
      avgServiceMinutes: 10,
      openTime: '08:00',
      closeTime: '17:30',
      contactPhone: '0571-2401822',
    },
    {
      name: 'Varanasi Kisan Samriddhi Depot',
      code: 'VARANASI01',
      district: 'Varanasi',
      state: 'Uttar Pradesh',
      address: 'Panchkoshi Marg, Pahariya, Varanasi, UP - 221007',
      location: { type: 'Point', coordinates: [82.9739, 25.3176] },
      crops: ['paddy', 'wheat', 'maize'],
      dailyCapacity: 160,
      avgServiceMinutes: 11,
      openTime: '08:00',
      closeTime: '17:00',
      contactPhone: '0542-2586119',
    },

    // --- Punjab ---
    {
      name: 'Nabha PACS Procurement Centre',
      code: 'NABHA01',
      district: 'Patiala',
      state: 'Punjab',
      address: 'Grain Market Road, Nabha, Punjab - 147201',
      location: { type: 'Point', coordinates: [76.1528, 30.3753] },
      crops: ['paddy', 'wheat', 'maize'],
      dailyCapacity: 200,
      avgServiceMinutes: 8,
      openTime: '07:00',
      closeTime: '18:00',
      contactPhone: '01765-220415',
    },
    {
      name: 'Khanna Asia Grain Market Terminal',
      code: 'KHANNA01',
      district: 'Ludhiana',
      state: 'Punjab',
      address: 'Grand Trunk Road, Khanna, Punjab - 141401',
      location: { type: 'Point', coordinates: [76.2167, 30.7073] },
      crops: ['wheat', 'paddy', 'maize'],
      dailyCapacity: 350,
      avgServiceMinutes: 8,
      openTime: '07:00',
      closeTime: '19:00',
      contactPhone: '01628-226810',
    },

    // --- Haryana ---
    {
      name: 'Karnal Basmati & Food Depot',
      code: 'KARNAL01',
      district: 'Karnal',
      state: 'Haryana',
      address: 'New Anaj Mandi, GT Road, Karnal, Haryana - 132001',
      location: { type: 'Point', coordinates: [76.9897, 29.6857] },
      crops: ['paddy', 'wheat', 'mustard'],
      dailyCapacity: 240,
      avgServiceMinutes: 9,
      openTime: '08:00',
      closeTime: '18:00',
      contactPhone: '0184-2253410',
    },
    {
      name: 'Sirsa Cotton & Wheat Mandi',
      code: 'SIRSA01',
      district: 'Sirsa',
      state: 'Haryana',
      address: 'APMC Complex, Dabwali Road, Sirsa, Haryana - 125055',
      location: { type: 'Point', coordinates: [75.0255, 29.5349] },
      crops: ['wheat', 'mustard'],
      dailyCapacity: 180,
      avgServiceMinutes: 10,
      openTime: '08:00',
      closeTime: '17:30',
      contactPhone: '01666-231205',
    },

    // --- Madhya Pradesh ---
    {
      name: 'Sehore Krishi Upaj Mandi',
      code: 'SEHORE01',
      district: 'Sehore',
      state: 'Madhya Pradesh',
      address: 'Mandi Yard, Bhopal-Indore Road, Sehore, MP - 466001',
      location: { type: 'Point', coordinates: [77.0851, 23.2030] },
      crops: ['wheat', 'maize'],
      dailyCapacity: 220,
      avgServiceMinutes: 9,
      openTime: '08:00',
      closeTime: '17:00',
      contactPhone: '07562-224510',
    },
    {
      name: 'Hoshangabad Narmadapuram FCI Depot',
      code: 'HOSH01',
      district: 'Narmadapuram',
      state: 'Madhya Pradesh',
      address: 'Rasoolia By-pass, Narmadapuram, MP - 461001',
      location: { type: 'Point', coordinates: [77.7370, 22.7519] },
      crops: ['wheat', 'paddy'],
      dailyCapacity: 250,
      avgServiceMinutes: 8,
      openTime: '07:30',
      closeTime: '18:00',
      contactPhone: '07574-252390',
    },

    // --- Rajasthan ---
    {
      name: 'Kota Central e-Upajan Mandi',
      code: 'KOTA01',
      district: 'Kota',
      state: 'Rajasthan',
      address: 'Bhamashah Mandi Yard, Anantpura, Kota, Rajasthan - 324005',
      location: { type: 'Point', coordinates: [75.8333, 25.1800] },
      crops: ['wheat', 'mustard', 'maize'],
      dailyCapacity: 200,
      avgServiceMinutes: 10,
      openTime: '08:00',
      closeTime: '17:30',
      contactPhone: '0744-2490134',
    },

    // --- Maharashtra ---
    {
      name: 'Nashik Agri Logistics & Grain Hub',
      code: 'NASHIK01',
      district: 'Nashik',
      state: 'Maharashtra',
      address: 'APMC Market Yard, Dindori Road, Nashik, Maharashtra - 422003',
      location: { type: 'Point', coordinates: [73.7898, 19.9975] },
      crops: ['wheat', 'maize'],
      dailyCapacity: 190,
      avgServiceMinutes: 10,
      openTime: '08:30',
      closeTime: '17:30',
      contactPhone: '0253-2512401',
    },

    // --- Gujarat ---
    {
      name: 'Unjha APMC Modern Commodity Centre',
      code: 'UNJHA01',
      district: 'Mehsana',
      state: 'Gujarat',
      address: 'Station Road, Unjha, Mehsana, Gujarat - 384170',
      location: { type: 'Point', coordinates: [72.3924, 23.8042] },
      crops: ['mustard', 'wheat'],
      dailyCapacity: 210,
      avgServiceMinutes: 9,
      openTime: '08:00',
      closeTime: '17:00',
      contactPhone: '02767-252111',
    },

    // --- Bihar ---
    {
      name: 'Katihar Seemanchal Grain Hub',
      code: 'KATIHAR01',
      district: 'Katihar',
      state: 'Bihar',
      address: 'Bazar Samiti, Mirchaibari, Katihar, Bihar - 854105',
      location: { type: 'Point', coordinates: [87.5714, 25.5422] },
      crops: ['maize', 'paddy', 'wheat'],
      dailyCapacity: 170,
      avgServiceMinutes: 11,
      openTime: '08:00',
      closeTime: '17:00',
      contactPhone: '06452-242318',
    },

    // --- West Bengal ---
    {
      name: 'Burdwan Delta Rice Procurement Depot',
      code: 'BURDWAN01',
      district: 'Purba Bardhaman',
      state: 'West Bengal',
      address: 'Kalyaneswar More, Burdwan, West Bengal - 713101',
      location: { type: 'Point', coordinates: [87.8631, 23.2324] },
      crops: ['paddy', 'maize'],
      dailyCapacity: 220,
      avgServiceMinutes: 9,
      openTime: '07:30',
      closeTime: '17:30',
      contactPhone: '0342-2645802',
    },

    // --- Odisha ---
    {
      name: 'Bargarh Hirakud Basin Paddy Centre',
      code: 'BARGARH01',
      district: 'Bargarh',
      state: 'Odisha',
      address: 'Regulated Market Committee Yard, Bargarh, Odisha - 768028',
      location: { type: 'Point', coordinates: [83.6190, 21.3333] },
      crops: ['paddy'],
      dailyCapacity: 200,
      avgServiceMinutes: 10,
      openTime: '08:00',
      closeTime: '17:00',
      contactPhone: '06646-231540',
    },

    // --- Telangana ---
    {
      name: 'Khammam e-NAM Agricultural Depot',
      code: 'KHAMMAM01',
      district: 'Khammam',
      state: 'Telangana',
      address: 'Agricultural Market Yard, Wyra Road, Khammam, Telangana - 507001',
      location: { type: 'Point', coordinates: [80.1514, 17.2473] },
      crops: ['paddy', 'maize'],
      dailyCapacity: 200,
      avgServiceMinutes: 9,
      openTime: '08:00',
      closeTime: '17:30',
      contactPhone: '08742-224810',
    },

    // --- Karnataka ---
    {
      name: 'Shimoga Sahyadri APMC Depot',
      code: 'SHIMOGA01',
      district: 'Shivamogga',
      state: 'Karnataka',
      address: 'APMC Yard, Sagar Road, Shivamogga, Karnataka - 577204',
      location: { type: 'Point', coordinates: [75.5681, 13.9299] },
      crops: ['paddy', 'maize'],
      dailyCapacity: 180,
      avgServiceMinutes: 10,
      openTime: '08:00',
      closeTime: '17:00',
      contactPhone: '08182-222380',
    },

    // --- Tamil Nadu ---
    {
      name: 'Thanjavur Delta Direct Purchase Centre',
      code: 'THANJAVUR01',
      district: 'Thanjavur',
      state: 'Tamil Nadu',
      address: 'Tamil Nadu Civil Supplies Corp DPC, Medical College Road, Thanjavur - 613004',
      location: { type: 'Point', coordinates: [79.1378, 10.7870] },
      crops: ['paddy'],
      dailyCapacity: 210,
      avgServiceMinutes: 9,
      openTime: '08:00',
      closeTime: '17:00',
      contactPhone: '04362-273110',
    },
  ];

  const centers = [];
  for (const data of centersData) {
    const center = await Center.findOneAndUpdate({ code: data.code }, data, { upsert: true, new: true });
    centers.push(center);
    console.log(`[seed] centre ready: ${center.name} (${center.code}) - ${center.district}, ${center.state}`);
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
  const operations = [];
  for (const center of centers) {
    for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
      const date = addDaysISO(today, dayOffset);
      const start = minutesOfDay(center.openTime);
      const end = minutesOfDay(center.closeTime);
      const slotLength = 30;
      const perSlotCapacity = Math.max(1, Math.round(slotLength / center.avgServiceMinutes));

      for (let t = start; t + slotLength <= end; t += slotLength) {
        operations.push({
          updateOne: {
            filter: {
              center: center._id,
              date,
              startTime: toHHMM(t),
            },
            update: {
              $setOnInsert: {
                center: center._id,
                date,
                startTime: toHHMM(t),
                endTime: toHHMM(t + slotLength),
                capacity: perSlotCapacity,
                crop: 'any',
              },
            },
            upsert: true,
          },
        });
      }
    }
  }

  if (operations.length > 0) {
    const result = await Slot.bulkWrite(operations, { ordered: false });
    console.log(`[seed] processed ${operations.length} slot windows (${result.upsertedCount} new slots created) across ${centers.length} centres`);
  }

  await disconnectDB();
  console.log('[seed] done');
}

seed().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
