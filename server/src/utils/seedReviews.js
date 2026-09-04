import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';
import Farmer from '../models/Farmer.js';
import Review from '../models/Review.js';

export async function seedReviews() {
  await connectDB(env.mongoUri);

  // Ensure our 3 main demo farmers exist with complete profiles
  const demoFarmers = [
    {
      name: 'Gurpreet Singh',
      phone: '9876543211',
      village: 'Samana',
      district: 'Patiala',
      state: 'Punjab',
      crops: ['Wheat', 'Paddy'],
      landAreaAcres: 12,
      profileComplete: true,
    },
    {
      name: 'Ram Lal Sharma',
      phone: '9876543212',
      village: 'Milak',
      district: 'Rampur',
      state: 'Uttar Pradesh',
      crops: ['Paddy', 'Wheat', 'Mustard'],
      landAreaAcres: 8,
      profileComplete: true,
    },
    {
      name: 'Harjinder Kaur',
      phone: '9876543213',
      village: 'Rohti Chhanna',
      district: 'Patiala',
      state: 'Punjab',
      crops: ['Maize', 'Wheat'],
      landAreaAcres: 15,
      profileComplete: true,
    },
  ];

  const targetFarmers = [];
  for (const df of demoFarmers) {
    let f = await Farmer.findOne({ phone: df.phone });
    if (!f) {
      f = await Farmer.create(df);
    } else {
      f.name = df.name;
      f.village = df.village;
      f.district = df.district;
      f.state = df.state;
      f.crops = df.crops;
      f.landAreaAcres = df.landAreaAcres;
      f.profileComplete = true;
      await f.save();
    }
    targetFarmers.push(f);
  }

  // Clear existing reviews
  await Review.deleteMany({});

  const sampleReviews = [
    // Reviews for Farmer 0 (Gurpreet Singh)
    {
      farmerIndex: 0,
      buyerName: 'Vikramaditya Roy',
      buyerCompany: 'Food Corporation of India (FCI)',
      buyerRole: 'Chief Quality Procurement Officer',
      buyerCity: 'Patiala, Punjab',
      rating: 5,
      comment:
        'Exceptional Sharbati wheat consignment of 40 quintals. Moisture level measured at 10.4%, well below the 12% ceiling. Zero foreign matter or weevilled grain detected during lab testing. Prompt delivery right on time for our central buffer silos.',
      crop: 'Wheat',
      lotQuantityQtl: 40,
      tags: ['Grade A Grain', 'Low Moisture (<11%)', 'Accurate Weighbridge', 'Punctual Dispatch'],
      verifiedPurchase: true,
      helpfulCount: 19,
    },
    {
      farmerIndex: 0,
      buyerName: 'Rajesh Singhania',
      buyerCompany: 'Shivalik Modern Roller Flour Mills',
      buyerRole: 'VP Raw Material Procurement',
      buyerCity: 'Ludhiana, Punjab',
      rating: 5,
      comment:
        'We have purchased three lots from Sardar Gurpreet Singh this season. High hectolitre weight (>79 kg/hL) and very uniform grain kernel size. Ideal for whole-wheat chakki atta milling. Highly recommended producer.',
      crop: 'Wheat',
      lotQuantityQtl: 65,
      tags: ['High Test Weight', 'Uniform Kernel Size', 'Direct Farmer Deal', 'Tamper-evident Bags'],
      verifiedPurchase: true,
      helpfulCount: 12,
    },
    {
      farmerIndex: 0,
      buyerName: 'Sunita Nair',
      buyerCompany: 'ITC Agri Business Division',
      buyerRole: 'Grain Sourcing Executive',
      buyerCity: 'Chandigarh',
      rating: 4.8,
      comment:
        'Consignment arrived in sound HDPE bags with digital RFID tags intact. High gluten strength verified in pre-intake laboratory scan. Farmer transparent with digital weighment slips.',
      crop: 'Wheat',
      lotQuantityQtl: 50,
      tags: ['Lab Tested', 'Accurate Weighbridge', 'Grade A Grain'],
      verifiedPurchase: true,
      helpfulCount: 8,
    },

    // Reviews for Farmer 1 (Ram Lal Sharma)
    {
      farmerIndex: 1,
      buyerName: 'Anil Kumar Agarwal',
      buyerCompany: 'Kuber Agro Rice Export Ltd.',
      buyerRole: 'Procurement Director',
      buyerCity: 'Moradabad, Uttar Pradesh',
      rating: 4.9,
      comment:
        'Purchased 35 quintals of 1509 Basmati paddy from Ram Lal ji. Moisture checked at 13.1%, broken grain percentage below 2.5%. Lot was well sun-dried and free from straw chaff. Seamless mandi weighbridge settlement.',
      crop: 'Paddy',
      lotQuantityQtl: 35,
      tags: ['Export Quality', 'Low Broken Grain', 'Clean Lot', 'Honest Weighment'],
      verifiedPurchase: true,
      helpfulCount: 15,
    },
    {
      farmerIndex: 1,
      buyerName: 'Devendra Patel',
      buyerCompany: 'Adani Wilmar Agri Sourcing',
      buyerRole: 'Mandi In-charge Buyer',
      buyerCity: 'Rampur, Uttar Pradesh',
      rating: 4.7,
      comment:
        'Great transaction through the automated slot booking system. The farmer turned up exactly at his allotted time window, reducing queue congestion at the gate. Produce passed all quality parameters.',
      crop: 'Paddy',
      lotQuantityQtl: 45,
      tags: ['On-Time Arrival', 'Smooth Handover', 'Grade A Grain'],
      verifiedPurchase: true,
      helpfulCount: 7,
    },

    // Reviews for Farmer 2 (Harjinder Kaur)
    {
      farmerIndex: 2,
      buyerName: 'Dr. Amitesh Khurana',
      buyerCompany: 'Punjab Bio-Feeds & Grain Processors',
      buyerRole: 'Chief Nutritionist & Purchasing Head',
      buyerCity: 'Karnal, Haryana',
      rating: 5,
      comment:
        'Superb yellow maize lot. Starch content tested above 68%, aflatoxin levels zero, absolutely clean cob-free shelling. Harjinder Kaur ji manages her harvest exceptionally well. Will definitely procure again next crop cycle.',
      crop: 'Maize',
      lotQuantityQtl: 30,
      tags: ['Zero Aflatoxin', 'High Starch Content', 'Grade A Grain', 'Reliable Supplier'],
      verifiedPurchase: true,
      helpfulCount: 16,
    },
    {
      farmerIndex: 2,
      buyerName: 'Pooja Deshmukh',
      buyerCompany: 'Cargill India Food & Bio-Industrial',
      buyerRole: 'Regional Sourcing Head',
      buyerCity: 'Delhi NCR',
      rating: 4.9,
      comment:
        'Procured 25 quintals of high-grade maize for animal feed production. Certified moisture 12.2% with exceptional purity. Full traceability from farm gate to factory dock.',
      crop: 'Maize',
      lotQuantityQtl: 25,
      tags: ['Full Traceability', 'Low Moisture (<11%)', 'Clean Lot'],
      verifiedPurchase: true,
      helpfulCount: 9,
    },
  ];

  for (const item of sampleReviews) {
    const f = targetFarmers[item.farmerIndex];
    await Review.create({
      farmer: f._id,
      buyerName: item.buyerName,
      buyerCompany: item.buyerCompany,
      buyerRole: item.buyerRole,
      buyerCity: item.buyerCity,
      rating: item.rating,
      comment: item.comment,
      crop: item.crop,
      lotQuantityQtl: item.lotQuantityQtl,
      tags: item.tags,
      verifiedPurchase: item.verifiedPurchase,
      helpfulCount: item.helpfulCount,
    });
  }

  // Update farmer stats
  for (const f of targetFarmers) {
    const stats = await Review.aggregate([
      { $match: { farmer: f._id } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          count: { $sum: 1 },
        },
      },
    ]);

    if (stats.length > 0) {
      f.averageRating = Math.round(stats[0].avgRating * 10) / 10;
      f.totalReviews = stats[0].count;
      if (f.averageRating >= 4.5 && f.totalReviews >= 2) {
        f.badge = 'Star Producer (A-Grade Verified)';
      } else if (f.averageRating >= 4.0) {
        f.badge = 'Trusted Producer';
      }
      await f.save();
      console.log(`Updated farmer ${f.name}: Rating ${f.averageRating}★ (${f.totalReviews} reviews) - Badge: ${f.badge}`);
    }
  }

  console.log(`[seedReviews] Successfully seeded ${sampleReviews.length} buyer reviews!`);
  await disconnectDB();
}

seedReviews().catch((err) => {
  console.error('[seedReviews] failed:', err);
  process.exit(1);
});
