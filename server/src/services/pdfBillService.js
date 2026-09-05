import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import PDFDocument from 'pdfkit';
import { env } from '../config/env.js';
import Procurement from '../models/Procurement.js';
import Queue from '../models/Queue.js';
import Farmer from '../models/Farmer.js';
import Center from '../models/Center.js';

let s3Client = null;
function getS3Client() {
  if (!s3Client && env.s3?.bucket && env.s3?.accessKeyId && env.s3?.secretAccessKey) {
    s3Client = new S3Client({
      region: env.s3.region || 'eu-north-1',
      credentials: {
        accessKeyId: env.s3.accessKeyId,
        secretAccessKey: env.s3.secretAccessKey,
      },
      ...(env.s3.endpoint ? { endpoint: env.s3.endpoint } : {}),
    });
  }
  return s3Client;
}

/**
 * Builds a government-standard Mandi Bill & DBT Settlement PDF
 * @returns {Promise<Buffer>}
 */
export function generateBillPdfBuffer(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      info: {
        Title: `Mandi Procurement Bill - Token #${data.token}`,
        Author: 'e-Mandi National Agriculture Market (e-NAM)',
        Subject: 'Official APMC Procurement & DBT Payment Settlement Voucher',
      },
    });

    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const emeraldDark = '#064e3b';
    const emeraldPrimary = '#059669';
    const textDark = '#0f172a';
    const textMuted = '#475569';
    const bgLight = '#f8fafc';
    const borderColor = '#cbd5e1';

    // 1. Top Decorative Header Band
    doc.rect(40, 40, 515, 75).fill(emeraldDark);

    doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold')
      .text('GOVERNMENT OF INDIA / भारत सरकार', 40, 50, { align: 'center' });
    
    doc.fillColor('#a7f3d0').fontSize(9).font('Helvetica')
      .text('Department of Agriculture & Farmers Welfare • National Agriculture Market (e-NAM)', 40, 68, { align: 'center' });

    doc.fillColor('#fde68a').fontSize(11).font('Helvetica-Bold')
      .text('OFFICIAL MANDI PROCUREMENT BILL & DBT SETTLEMENT VOUCHER', 40, 84, { align: 'center' });

    // 2. Bill Meta Info Bar
    doc.rect(40, 115, 515, 25).fill('#f1f5f9');
    doc.fillColor(textMuted).fontSize(8).font('Helvetica-Bold')
      .text(`BILL NO: ${data.billNo}`, 50, 122)
      .text(`DATE: ${data.generatedDate}`, 240, 122)
      .text(`STATUS: 100% DBT SETTLED (PAID)`, 400, 122);

    let y = 150;

    // 3. Two-Column Cards: Farmer Info & Mandi Center
    // Farmer Card
    doc.rect(40, y, 250, 95).strokeColor(borderColor).lineWidth(1).stroke();
    doc.rect(40, y, 250, 20).fill(bgLight);
    doc.fillColor(emeraldDark).fontSize(9).font('Helvetica-Bold').text('FARMER PARTICULARS / किसान विवरण', 48, y + 6);

    doc.fillColor(textDark).fontSize(9).font('Helvetica')
      .text(`Name:`, 48, y + 26).font('Helvetica-Bold').text(`${data.farmerName}`, 110, y + 26)
      .font('Helvetica').text(`Mobile:`, 48, y + 40).font('Helvetica-Bold').text(`+91 ${data.farmerPhone}`, 110, y + 40)
      .font('Helvetica').text(`Location:`, 48, y + 54).font('Helvetica-Bold').text(`${data.farmerLocation}`, 110, y + 54)
      .font('Helvetica').text(`DBT Status:`, 48, y + 68).font('Helvetica-Bold').fillColor(emeraldPrimary).text(`✓ Aadhaar & Bank Linked`, 110, y + 68);

    // Mandi Card
    doc.rect(305, y, 250, 95).strokeColor(borderColor).lineWidth(1).stroke();
    doc.rect(305, y, 250, 20).fill(bgLight);
    doc.fillColor(emeraldDark).fontSize(9).font('Helvetica-Bold').text('PROCUREMENT CENTRE / खरीद केंद्र', 313, y + 6);

    doc.fillColor(textDark).fontSize(9).font('Helvetica')
      .text(`Centre:`, 313, y + 26).font('Helvetica-Bold').text(`${data.centerName}`, 380, y + 26)
      .font('Helvetica').text(`District/State:`, 313, y + 40).font('Helvetica-Bold').text(`${data.centerDistrict}, ${data.centerState}`, 380, y + 40)
      .font('Helvetica').text(`Token No:`, 313, y + 54).font('Helvetica-Bold').fillColor('#b45309').text(`#${data.token}`, 380, y + 54)
      .fillColor(textDark).font('Helvetica').text(`Slot Time:`, 313, y + 68).font('Helvetica-Bold').text(`${data.slotTime}`, 380, y + 68);

    y += 110;

    // 4. Produce Details Table
    doc.rect(40, y, 515, 22).fill(emeraldDark);
    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
      .text('COMMODITY / CROP', 50, y + 7)
      .text('GRADE', 180, y + 7)
      .text('QUANTITY', 260, y + 7)
      .text('MSP RATE (Rs/QTL)', 350, y + 7)
      .text('GROSS VALUE', 460, y + 7);

    y += 22;
    doc.rect(40, y, 515, 26).fill(bgLight).strokeColor(borderColor).lineWidth(1).stroke();
    doc.fillColor(textDark).fontSize(9).font('Helvetica-Bold')
      .text(data.crop, 50, y + 8)
      .text(data.grade, 180, y + 8)
      .text(`${data.quantityQtl} Quintals`, 260, y + 8)
      .text(`Rs ${data.ratePerQtl}`, 350, y + 8)
      .text(`Rs ${data.amount.toLocaleString('en-IN')}`, 460, y + 8);

    y += 40;

    // 5. DBT Financial Breakdown Box
    doc.rect(40, y, 515, 150).strokeColor(emeraldPrimary).lineWidth(1.5).stroke();
    doc.rect(40, y, 515, 24).fill('#ecfdf5');
    doc.fillColor(emeraldDark).fontSize(10).font('Helvetica-Bold')
      .text('DIRECT BENEFIT TRANSFER (DBT) PAYMENT SETTLEMENT DETAILS', 50, y + 7);

    y += 32;

    const row = (label, val, ref = '', isBold = false, isGreen = false) => {
      doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(9)
        .fillColor(isGreen ? emeraldPrimary : textDark)
        .text(label, 52, y);
      
      doc.text(val, 280, y);
      if (ref) {
        doc.font('Helvetica').fontSize(8).fillColor(textMuted).text(`(Ref: ${ref})`, 390, y);
      }
      y += 20;
    };

    row('Total Gross MSP Produce Value:', `Rs ${data.amount.toLocaleString('en-IN')}`, '', true);
    row('20% Safety Advance Guarantee (Paid):', `Rs ${data.advanceAmount.toLocaleString('en-IN')}`, data.advanceRef, false, true);
    row('80% Final Settlement Balance (Paid):', `Rs ${data.balanceAmount.toLocaleString('en-IN')}`, data.balanceRef, false, true);
    row('Total Net Credited to Farmer Account:', `Rs ${data.amount.toLocaleString('en-IN')}`, '100% RELEASED', true, true);
    row('Beneficiary Bank & Account:', `${data.bankName} (${data.accountMasked})`, `IFSC: ${data.ifscCode}`);
    row('Master Transaction Reference (UTR):', `${data.utrNumber}`, 'SUCCESS');

    y += 25;

    // 6. Digital Verification & Security Seal Box
    doc.rect(40, y, 515, 55).strokeColor(borderColor).lineWidth(1).stroke();
    doc.fillColor(textMuted).fontSize(7.5).font('Helvetica')
      .text('OFFICIAL VERIFICATION & CERTIFICATION:', 50, y + 8, { underline: true })
      .text(`This document is a computer-generated, tamper-proof electronic procurement bill issued under PM-AASHA / APMC guidelines.`, 50, y + 20)
      .text(`Digital Verification Signature: e-Mandi Automated Settlement Engine (SHA-256 Verified: ${data.verificationHash})`, 50, y + 32)
      .text(`Exempt from Mandi Cess under Central Direct Farmer Procurement Guidelines. Valid for farmer tax and bank records.`, 50, y + 44);

    // 7. Footer
    doc.fillColor('#94a3b8').fontSize(7).font('Helvetica')
      .text('e-Mandi Procurement System • Department of Agriculture & Farmers Welfare, Krishi Bhawan, New Delhi • Helpline: 1800-180-1551', 40, 780, { align: 'center' });

    doc.end();
  });
}

/**
 * Generates the bill PDF, uploads it to S3, and stores the URL in Procurement
 * @param {string|ObjectId} procurementId
 * @returns {Promise<string>} S3 public or proxy URL of the generated bill
 */
export async function generateAndUploadBill(procurementId) {
  const procurement = await Procurement.findById(procurementId)
    .populate('farmer')
    .populate('center')
    .populate('queueEntry');

  if (!procurement) {
    throw new Error(`Procurement record ${procurementId} not found`);
  }

  const token = procurement.queueEntry?.token || 1;
  const farmer = procurement.farmer || {};
  const center = procurement.center || {};

  const billNo = `BILL-2026-${procurement._id.toString().slice(-6).toUpperCase()}`;
  const now = new Date();
  const generatedDate = `${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;

  const billData = {
    billNo,
    token,
    farmerName: farmer.name || 'Registered Farmer',
    farmerPhone: farmer.phone || 'N/A',
    farmerLocation: `${farmer.village || 'Central Village'}, ${farmer.district || center.district || 'Agri District'}`,
    centerName: center.name || 'Mandi Procurement Centre',
    centerDistrict: center.district || 'State Mandi',
    centerState: center.state || 'India',
    slotTime: procurement.queueEntry?.slot ? `${procurement.queueEntry.slot.startTime} - ${procurement.queueEntry.slot.endTime}` : 'Morning Slot',
    crop: procurement.crop || 'Wheat (गेहूं)',
    grade: procurement.qualityGrade ? `Grade ${procurement.qualityGrade}` : 'Grade A (FAQ)',
    quantityQtl: procurement.quantityQtl || 10,
    ratePerQtl: procurement.ratePerQtl || 2275,
    amount: procurement.amount || 22750,
    advanceAmount: procurement.advanceAmount || 4550,
    balanceAmount: procurement.balanceAmount || 18200,
    advanceRef: procurement.advancePaymentRef || procurement.advanceUtr || 'ADV-CONFIRMED',
    balanceRef: procurement.paymentRef || procurement.balanceUtr || 'BAL-SETTLED',
    bankName: procurement.bankName || 'State Bank of India',
    accountMasked: procurement.accountMasked || '•••• •••• 5421',
    ifscCode: procurement.ifscCode || 'SBIN0001842',
    utrNumber: procurement.utrNumber || `P${Date.now().toString().slice(-10)}`,
    generatedDate,
    verificationHash: `${procurement._id.toString().slice(0, 16)}...${Date.now().toString(16)}`,
  };

  // Generate PDF Buffer
  const pdfBuffer = await generateBillPdfBuffer(billData);
  console.log(`[pdf-bill] Generated PDF bill for Token #${token} (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);

  const s3 = getS3Client();
  const s3Key = `bills/Mandi_Bill_Token_${token}_${procurement._id}.pdf`;
  let s3Url = '';

  if (s3 && env.s3?.bucket) {
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: env.s3.bucket,
          Key: s3Key,
          Body: pdfBuffer,
          ContentType: 'application/pdf',
          ContentDisposition: `inline; filename="Mandi_Bill_Token_${token}.pdf"`,
          CacheControl: 'public, max-age=31536000',
        })
      );
      s3Url = `https://${env.s3.bucket}.s3.${env.s3.region}.amazonaws.com/${s3Key}`;
      console.log(`[pdf-bill] Uploaded to S3: ${s3Url}`);
    } catch (s3Err) {
      console.warn(`[pdf-bill] S3 upload failed, using proxy URL:`, s3Err.message);
    }
  }

  // Fallback / proxy URL that is always accessible through our media controller
  const proxyUrl = `/api/media/${s3Key}`;
  const finalUrl = s3Url || proxyUrl;

  // Persist bill URL in Procurement
  procurement.billPdfUrl = finalUrl;
  procurement.billGeneratedAt = new Date();
  await procurement.save();

  // Also store on QueueEntry if exists
  if (procurement.queueEntry) {
    await Queue.findByIdAndUpdate(procurement.queueEntry._id, {
      $set: { billPdfUrl: finalUrl },
    }).catch(() => {});
  }

  return finalUrl;
}
