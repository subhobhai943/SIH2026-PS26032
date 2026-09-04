import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';
import Farmer from '../models/Farmer.js';
import Center from '../models/Center.js';
import Slot from '../models/Slot.js';
import Queue from '../models/Queue.js';
import Procurement from '../models/Procurement.js';
import Shipment from '../models/Shipment.js';
import { todayISO } from './datetime.js';

export async function seedDemoShipments() {
  await connectDB(env.mongoUri);

  const centers = await Center.find();
  if (centers.length === 0) {
    console.log('No centers found');
    await disconnectDB();
    return;
  }

  let farmers = await Farmer.find();
  if (farmers.length < 3) {
    const f1 = await Farmer.create({ name: 'Gurpreet Singh', phone: '9876543211', village: 'Samana', district: 'Patiala', state: 'Punjab' });
    const f2 = await Farmer.create({ name: 'Ram Lal Sharma', phone: '9876543212', village: 'Milak', district: 'Rampur', state: 'Uttar Pradesh' });
    const f3 = await Farmer.create({ name: 'Harjinder Kaur', phone: '9876543213', village: 'Rohti Chhanna', district: 'Patiala', state: 'Punjab' });
    farmers = [f1, f2, f3];
  }

  const today = todayISO();
  const slots = await Slot.find({ date: today }).limit(3);

  // Clear existing demo queue/shipment
  await Queue.deleteMany({});
  await Procurement.deleteMany({});
  await Shipment.deleteMany({});

  // 1. In Transit Consignment
  const q1 = await Queue.create({
    center: centers[1]._id,
    slot: slots[0]?._id || slots[0],
    farmer: farmers[0]._id,
    date: today,
    token: 101,
    status: 'completed',
    crop: 'Wheat',
    estimatedQuantityQtl: 20,
    checkedInAt: new Date(Date.now() - 4 * 3600000),
    completedAt: new Date(Date.now() - 3 * 3600000),
  });

  const p1 = await Procurement.create({
    queueEntry: q1._id,
    farmer: farmers[0]._id,
    center: centers[1]._id,
    date: today,
    crop: 'Wheat',
    quantityQtl: 20,
    qualityGrade: 'A',
    ratePerQtl: 2275,
    amount: 45500,
    advanceAmount: 9100,
    balanceAmount: 36400,
    advanceStatus: 'paid',
    advancePaymentRef: 'ADV-884120',
    advancePaidAt: new Date(Date.now() - 3 * 3600000),
    stage: 'advance_paid',
    timeline: [
      { stage: 'arrived', at: new Date(Date.now() - 4 * 3600000) },
      { stage: 'weighed', at: new Date(Date.now() - 3.5 * 3600000) },
      { stage: 'approved', at: new Date(Date.now() - 3.2 * 3600000) },
      { stage: 'advance_paid', at: new Date(Date.now() - 3 * 3600000) },
    ],
  });

  await Shipment.create({
    orderId: 'ORD-2026-0101-WHT',
    trackingNumber: 'DELH-89412574',
    queueEntry: q1._id,
    procurement: p1._id,
    farmer: farmers[0]._id,
    center: centers[1]._id,
    crop: 'Wheat',
    quantityQtl: 20,
    cropGrade: 'A',
    originCenter: {
      name: centers[1].name,
      district: centers[1].district,
      state: centers[1].state,
    },
    destinationGodown: {
      name: 'Central Warehousing Corporation (CWC) Mega Depot',
      address: 'Plot 45-A, GT Road Logistics Park',
      district: 'Karnal',
      state: 'Haryana',
      pincode: '132001',
    },
    logisticsPartner: {
      name: 'Delhivery Agri Logistics',
      serviceType: 'Dedicated Agri FTL (Full Truckload)',
      awbNumber: 'DELH88492011',
      supportPhone: '1800-102-4455',
      vehicleNumber: 'HR 05 BA 4421',
      vehicleType: '16-Ton Multi-Axle Covered Carrier',
      driverName: 'Rajesh Kumar',
      driverPhone: '+91 98765 43210',
      securitySealNumber: 'SEAL-IND-88421',
    },
    status: 'in_transit',
    currentLocation: 'NH-44 Freight Corridor, Karnal Toll Plaza Checkpoint',
    estimatedDelivery: new Date(Date.now() + 14 * 3600000),
    advanceSecured: true,
    advanceAmount: 9100,
    totalAmount: 45500,
    checkpoints: [
      {
        status: 'order_confirmed',
        title: 'Order Confirmed & 20% Advance Guarantee Reserved',
        description: 'Quality approved by APMC grader. 20% advance of Rs 9,100 initiated to farmer bank account.',
        location: centers[1].name,
        timestamp: new Date(Date.now() - 4 * 3600000),
      },
      {
        status: 'produce_dispatched',
        title: 'Produce Weighed & Standardized Bagging Completed',
        description: '20 Quintals A-Grade Wheat bagged in moisture-proof tamper evident bags.',
        location: 'Mandi Packing Yard',
        timestamp: new Date(Date.now() - 3.5 * 3600000),
      },
      {
        status: 'picked_up',
        title: 'Loaded onto Delhivery Agri Freight Carrier',
        description: 'Vehicle loaded. Digital GPS security seal SEAL-IND-88421 locked on container bay.',
        location: `${centers[1].name} Logistics Gate #3`,
        timestamp: new Date(Date.now() - 2.5 * 3600000),
      },
      {
        status: 'in_transit',
        title: 'Departed Mandi Hub — In Transit on NH-44',
        description: 'Consignment en route to Karnal Mega Depot. GPS telemetry and temperature sensors active.',
        location: 'NH-44 Freight Corridor, Karnal Toll Plaza',
        timestamp: new Date(Date.now() - 1 * 3600000),
      },
    ],
  });

  // 2. Picked Up Consignment
  const q2 = await Queue.create({
    center: centers[0]._id,
    slot: slots[1]?._id || slots[0],
    farmer: farmers[1]._id,
    date: today,
    token: 102,
    status: 'serving',
    crop: 'Paddy',
    estimatedQuantityQtl: 30,
    checkedInAt: new Date(Date.now() - 2 * 3600000),
  });

  const p2 = await Procurement.create({
    queueEntry: q2._id,
    farmer: farmers[1]._id,
    center: centers[0]._id,
    date: today,
    crop: 'Paddy',
    quantityQtl: 30,
    qualityGrade: 'FAQ',
    ratePerQtl: 2203,
    amount: 66090,
    advanceAmount: 13218,
    balanceAmount: 52872,
    advanceStatus: 'paid',
    advancePaymentRef: 'ADV-771923',
    advancePaidAt: new Date(Date.now() - 1 * 3600000),
    stage: 'advance_paid',
    timeline: [
      { stage: 'arrived', at: new Date(Date.now() - 2 * 3600000) },
      { stage: 'weighed', at: new Date(Date.now() - 1.5 * 3600000) },
      { stage: 'approved', at: new Date(Date.now() - 1.2 * 3600000) },
      { stage: 'advance_paid', at: new Date(Date.now() - 1 * 3600000) },
    ],
  });

  await Shipment.create({
    orderId: 'ORD-2026-0102-PDY',
    trackingNumber: 'BBLK-77192344',
    queueEntry: q2._id,
    procurement: p2._id,
    farmer: farmers[1]._id,
    center: centers[0]._id,
    crop: 'Paddy',
    quantityQtl: 30,
    cropGrade: 'FAQ',
    originCenter: {
      name: centers[0].name,
      district: centers[0].district,
      state: centers[0].state,
    },
    destinationGodown: {
      name: 'Food Corporation of India (FCI) Buffer Silos',
      address: 'Industrial Development Area, Phase 2',
      district: 'Moradabad',
      state: 'Uttar Pradesh',
      pincode: '244001',
    },
    logisticsPartner: {
      name: 'BlackBuck Ag-Freight',
      serviceType: 'Dedicated Agri FTL (Full Truckload)',
      awbNumber: 'BBLK99214055',
      supportPhone: '1800-209-6688',
      vehicleNumber: 'UP 22 AT 8912',
      vehicleType: '24-Ton Heavy Agri Carrier',
      driverName: 'Satish Verma',
      driverPhone: '+91 98112 34567',
      securitySealNumber: 'SEAL-IND-77192',
    },
    status: 'picked_up',
    currentLocation: `${centers[0].name} Loading Bay #2`,
    estimatedDelivery: new Date(Date.now() + 20 * 3600000),
    advanceSecured: true,
    advanceAmount: 13218,
    totalAmount: 66090,
    checkpoints: [
      {
        status: 'order_confirmed',
        title: 'Order Confirmed & 20% Advance Guarantee Reserved',
        description: '30 Quintals Paddy inspected. Advance Rs 13,218 credited to farmer.',
        location: centers[0].name,
        timestamp: new Date(Date.now() - 2 * 3600000),
      },
      {
        status: 'produce_dispatched',
        title: 'Produce Weighed & Inspected for Dispatch',
        description: 'FAQ Grade Paddy ready for loading.',
        location: 'Mandi Bay #2',
        timestamp: new Date(Date.now() - 1.5 * 3600000),
      },
      {
        status: 'picked_up',
        title: 'Truck Loaded & Verified by BlackBuck Ag-Freight',
        description: 'Consignment loaded onto 24-Ton vehicle UP 22 AT 8912. Driver verified weight slips.',
        location: `${centers[0].name} Loading Dock`,
        timestamp: new Date(Date.now() - 0.5 * 3600000),
      },
    ],
  });

  // 3. Delivered Consignment
  const q3 = await Queue.create({
    center: centers[1]._id,
    slot: slots[2]?._id || slots[0],
    farmer: farmers[2]._id,
    date: today,
    token: 103,
    status: 'completed',
    crop: 'Maize',
    estimatedQuantityQtl: 15,
    checkedInAt: new Date(Date.now() - 28 * 3600000),
    completedAt: new Date(Date.now() - 27 * 3600000),
  });

  const p3 = await Procurement.create({
    queueEntry: q3._id,
    farmer: farmers[2]._id,
    center: centers[1]._id,
    date: today,
    crop: 'Maize',
    quantityQtl: 15,
    qualityGrade: 'A',
    ratePerQtl: 2090,
    amount: 31350,
    advanceAmount: 6270,
    balanceAmount: 25080,
    advanceStatus: 'paid',
    advancePaymentRef: 'ADV-552109',
    advancePaidAt: new Date(Date.now() - 26 * 3600000),
    balanceStatus: 'paid',
    paymentRef: 'BAL-552199',
    paidAt: new Date(Date.now() - 2 * 3600000),
    stage: 'paid',
    timeline: [
      { stage: 'arrived', at: new Date(Date.now() - 28 * 3600000) },
      { stage: 'weighed', at: new Date(Date.now() - 27.5 * 3600000) },
      { stage: 'approved', at: new Date(Date.now() - 27 * 3600000) },
      { stage: 'advance_paid', at: new Date(Date.now() - 26 * 3600000) },
      { stage: 'paid', at: new Date(Date.now() - 2 * 3600000) },
    ],
  });

  await Shipment.create({
    orderId: 'ORD-2026-0103-MAZ',
    trackingNumber: 'RIVG-55210988',
    queueEntry: q3._id,
    procurement: p3._id,
    farmer: farmers[2]._id,
    center: centers[1]._id,
    crop: 'Maize',
    quantityQtl: 15,
    cropGrade: 'A',
    originCenter: {
      name: centers[1].name,
      district: centers[1].district,
      state: centers[1].state,
    },
    destinationGodown: {
      name: 'Central Warehousing Corporation (CWC) Mega Depot',
      address: 'Plot 45-A, GT Road Logistics Park',
      district: 'Karnal',
      state: 'Haryana',
      pincode: '132001',
    },
    logisticsPartner: {
      name: 'Rivigo Agri Relay',
      serviceType: 'Express Relay Freight Service',
      awbNumber: 'RIVG33901244',
      supportPhone: '1800-120-7484',
      vehicleNumber: 'PB 11 CD 3390',
      vehicleType: '16-Ton Insulated Truck',
      driverName: 'Manjit Singh',
      driverPhone: '+91 97722 11445',
      securitySealNumber: 'SEAL-IND-55210',
    },
    status: 'delivered',
    currentLocation: 'CWC Central Silo Complex, Karnal (Stocked in Silo #8)',
    estimatedDelivery: new Date(Date.now() - 3 * 3600000),
    deliveredAt: new Date(Date.now() - 2 * 3600000),
    advanceSecured: true,
    advanceAmount: 6270,
    totalAmount: 31350,
    checkpoints: [
      {
        status: 'order_confirmed',
        title: 'Order Confirmed & 20% Advance Guarantee Reserved',
        description: '15 Quintals Maize confirmed. Advance Rs 6,270 released.',
        location: centers[1].name,
        timestamp: new Date(Date.now() - 28 * 3600000),
      },
      {
        status: 'produce_dispatched',
        title: 'Produce Weighed & Handed Over for Shipping',
        description: 'Quality Grade A Maize bagged and verified.',
        location: 'Packing Bay',
        timestamp: new Date(Date.now() - 27 * 3600000),
      },
      {
        status: 'picked_up',
        title: 'Loaded onto Rivigo Agri Relay Carrier',
        description: 'Digital seal SEAL-IND-55210 attached.',
        location: `${centers[1].name} Gate`,
        timestamp: new Date(Date.now() - 25 * 3600000),
      },
      {
        status: 'in_transit',
        title: 'In Transit along GT Road Logistics Highway',
        description: 'Speed and temperature monitored throughout transit.',
        location: 'GT Road Shambhu Toll Plaza',
        timestamp: new Date(Date.now() - 15 * 3600000),
      },
      {
        status: 'out_for_delivery',
        title: 'Arrived at Central Silo Complex Dock #6',
        description: 'Security seal inspected and intact.',
        location: 'CWC Mega Depot, Karnal',
        timestamp: new Date(Date.now() - 4 * 3600000),
      },
      {
        status: 'delivered',
        title: 'Produce Received, Weighed & Stocked at Central Silo',
        description: 'Stock ledger updated. Final 80% balance payment of Rs 25,080 settled to farmer account.',
        location: 'CWC Central Silo Complex, Karnal',
        timestamp: new Date(Date.now() - 2 * 3600000),
      },
    ],
  });

  console.log('Successfully seeded 3 demo shipments with 3rd-party logistics partners!');
  await disconnectDB();
}

seedDemoShipments();
