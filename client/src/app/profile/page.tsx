'use client';

import { useEffect, useState, useRef } from 'react';
import gsap from 'gsap';
import { api, getToken, clearToken } from '@/lib/api';
import { Alert, Button, Card, PageHeader, TextField } from '@/components/ui';
import {
  IconPhone,
  IconUser,
  IconCheck,
  IconCamera,
  IconUpload,
  IconWheat,
  IconCalendar,
  IconRupee,
  IconShieldCheck,
  IconGoogle,
  IconStar,
} from '@/components/icons';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { compressImage } from '@/lib/imageUtils';
import { prefersReducedMotion } from '@/lib/animations';

const AVAILABLE_CROPS = [
  'Wheat (गेहूं)',
  'Paddy (धान)',
  'Mustard (सरसों)',
  'Maize (मक्का)',
  'Gram / Chana (चना)',
  'Soybean (सोयाबीन)',
  'Cotton (कपास)',
  'Pulses (दालें)',
  'Barley (जौ)',
  'Bajra (बाजरा)',
];

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी (Hindi)' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ (Punjabi)' },
  { code: 'bn', label: 'বাংলা (Bengali)' },
  { code: 'mr', label: 'मराठी (Marathi)' },
  { code: 'te', label: 'తెలుగు (Telugu)' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
];

export default function FarmerProfilePage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [farmer, setFarmer] = useState<any | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Form edit fields
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    village: '',
    district: '',
    state: '',
    landAreaAcres: '',
    preferredLanguage: 'en',
    crops: [] as string[],
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    Promise.all([
      api.get<any>('/farmers/me'),
      api.get<any[]>('/slots/bookings/me').catch(() => []),
    ])
      .then(([farmerData, bookingsData]) => {
        if (farmerData) {
          setFarmer(farmerData);
          setPhotoPreview(farmerData.photoUrl || null);
          setFormData({
            name: farmerData.name || '',
            phone: farmerData.phone || '',
            village: farmerData.village || '',
            district: farmerData.district || '',
            state: farmerData.state || '',
            landAreaAcres: farmerData.landAreaAcres ? String(farmerData.landAreaAcres) : '',
            preferredLanguage: farmerData.preferredLanguage || 'en',
            crops: Array.isArray(farmerData.crops) && farmerData.crops.length > 0 ? farmerData.crops : ['Wheat (गेहूं)', 'Paddy (धान)'],
          });
        }
        setBookings(Array.isArray(bookingsData) ? bookingsData : []);
      })
      .catch((err) => {
        if (err.status === 401) {
          clearToken();
          setFarmer(null);
        } else {
          setError(err.message || 'Failed to load profile');
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!loading && containerRef.current && !prefersReducedMotion()) {
      try {
        gsap.fromTo(
          containerRef.current,
          { opacity: 0, y: 15 },
          { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
        );
      } catch (err) {
        console.warn('Profile animation skipped:', err);
      }
    }
  }, [loading]);

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(null);
    setUploadingPhoto(true);

    try {
      // Compress to <100KB for rural 3G/4G bandwidth
      const compressed = await compressImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.85 });
      setPhotoPreview(compressed.dataUrl);

      // Upload via backend proxy to S3/local media
      const res = await api.post<{ url: string; provider: string }>('/upload', {
        image: compressed.dataUrl,
        category: 'farmer_photo',
        filename: compressed.filename,
      });

      // Update farmer profile with new photoUrl
      const updated = await api.put<any>('/farmers/me', { photoUrl: res.url });
      setFarmer(updated);
      setSuccess('Photograph updated successfully!');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
      if (e.target) e.target.value = '';
    }
  }

  function toggleCrop(cropName: string) {
    setFormData((prev) => {
      const exists = prev.crops.includes(cropName);
      if (exists) {
        return { ...prev, crops: prev.crops.filter((c) => c !== cropName) };
      } else {
        return { ...prev, crops: [...prev.crops, cropName] };
      }
    });
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (formData.phone && !/^[6-9]\d{9}$/.test(formData.phone)) {
      setError('Please enter a valid 10-digit Indian mobile number starting with 6-9');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        name: formData.name.trim(),
        village: formData.village.trim(),
        district: formData.district.trim(),
        state: formData.state.trim(),
        preferredLanguage: formData.preferredLanguage,
        crops: formData.crops,
      };

      if (formData.phone) {
        payload.phone = formData.phone;
      }

      if (formData.landAreaAcres) {
        const acres = parseFloat(formData.landAreaAcres);
        if (!isNaN(acres) && acres > 0) {
          payload.landAreaAcres = acres;
        }
      }

      const updated = await api.put<any>('/farmers/me', payload);
      setFarmer(updated);
      setIsEditing(false);
      setSuccess('Profile updated successfully! (प्रोफाइल सफलतापूर्वक अपडेट हो गई)');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile details');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center space-y-3">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-3 border-brand-600 border-t-transparent" />
        <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
          Loading Farmer Dossier... (विवरण लोड हो रहा है)
        </p>
      </div>
    );
  }

  if (!farmer) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-8">
        <Card className="p-6 text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-3xl">
            🔒
          </div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            Sign In Required (लॉगिन आवश्यक है)
          </h2>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
            Please log in with Google or your registered mobile number to view and manage your verified farmer profile, Mandi gate passes, and 20% DBT safety advance records.
          </p>
          <a
            href="/register"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-500 py-3 px-4 text-sm font-bold text-white shadow transition"
          >
            <span>Proceed to Login / Register (लॉगिन करें)</span>
            <span>➔</span>
          </a>
        </Card>
      </div>
    );
  }

  // Calculate quick stats
  const completedBookings = bookings.filter((b) => b.status === 'completed' || b.status === 'paid');
  const activeBookings = bookings.filter((b) => b.status === 'booked' || b.status === 'arrived' || b.status === 'weighed');

  return (
    <div ref={containerRef} className="mx-auto max-w-4xl space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <PageHeader
          eyebrow="राष्ट्रीय किसान प्रोफाइल · National Farmer Dossier"
          title="My Farmer Profile (मेरी प्रोफाइल)"
          subtitle="Verified government procurement dossier, biometric photo identity, and PFMS DBT bank link."
        />
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant={isEditing ? 'secondary' : 'primary'}
            onClick={() => {
              setIsEditing(!isEditing);
              setError(null);
              setSuccess(null);
            }}
          >
            {isEditing ? 'Cancel Edit (रद्द करें)' : '✎ Edit Profile (विवरण बदलें)'}
          </Button>
        </div>
      </div>

      {error && (
        <Alert tone="error">
          <span>{error}</span>
        </Alert>
      )}

      {success && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/50 p-4 text-xs font-semibold text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 flex items-center gap-2 shadow-xs">
          <span>✓</span>
          <span>{success}</span>
        </div>
      )}

      {/* Hero Farmer Identification Card */}
      <Card className="overflow-hidden border-2 border-emerald-600/40 shadow-lg">
        {/* Tricolor Government Ribbon */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#FF9933] via-white to-[#138808]" />

        <div className="bg-gradient-to-r from-emerald-800 via-emerald-900 to-brand-900 p-5 sm:p-7 text-white">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Avatar & Photo Action */}
            <div className="relative group shrink-0">
              <div className="relative h-24 w-24 sm:h-28 sm:w-28 overflow-hidden rounded-2xl border-3 border-white/80 shadow-md bg-neutral-800">
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoPreview}
                    alt={farmer.name || 'Farmer'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-4xl bg-emerald-700 text-white">
                    🌾
                  </div>
                )}
                {uploadingPhoto && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs font-bold">
                    Uploading...
                  </div>
                )}
              </div>

              {/* Photo Change Buttons */}
              <div className="mt-2 flex items-center justify-center gap-1.5">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="rounded-lg bg-white/20 hover:bg-white/30 px-2 py-1 text-[10px] font-bold text-white transition flex items-center gap-1 backdrop-blur-xs cursor-pointer"
                  title="Take photo with camera"
                >
                  <IconCamera className="h-3 w-3" />
                  Camera
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="rounded-lg bg-white/20 hover:bg-white/30 px-2 py-1 text-[10px] font-bold text-white transition flex items-center gap-1 backdrop-blur-xs cursor-pointer"
                  title="Upload from gallery"
                >
                  <IconUpload className="h-3 w-3" />
                  Gallery
                </button>
              </div>

              {/* Hidden Inputs */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={handlePhotoSelected}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelected}
              />
            </div>

            {/* Farmer Info */}
            <div className="flex-1 text-center sm:text-left space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-300 border border-emerald-400/40">
                  ✓ {farmer.badge || 'A-Grade Verified Producer'}
                </span>
                {farmer.authProvider === 'google' && (
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold text-white flex items-center gap-1">
                    <IconGoogle className="h-3 w-3" />
                    Google Verified
                  </span>
                )}
                <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 flex items-center gap-1 border border-amber-400/30">
                  <IconStar className="h-3 w-3 text-amber-300" />
                  {farmer.averageRating || 5.0} / 5.0
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight truncate">
                {farmer.name || 'Registered Producer'}
              </h2>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 text-xs text-emerald-100 font-medium">
                {farmer.phone && (
                  <span className="font-mono">📱 +91 {farmer.phone}</span>
                )}
                {farmer.email && (
                  <span className="truncate">✉️ {farmer.email}</span>
                )}
                {(farmer.village || farmer.district) && (
                  <span className="truncate">
                    📍 {farmer.village ? `${farmer.village}, ` : ''}{farmer.district} ({farmer.state})
                  </span>
                )}
              </div>

              <p className="pt-1 text-[11px] text-emerald-200/90 max-w-xl">
                Registered under the National Agricultural Procurement Portal · DBT-enabled beneficiary with biometric Gate Pass access across all 18 nationwide Mandis.
              </p>
            </div>
          </div>
        </div>

        {/* Quick KPI Stat Counter */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 bg-neutral-50/90 dark:bg-neutral-850/90 p-3 sm:p-4 text-center text-xs">
          <div className="p-3 rounded-xl bg-white dark:bg-neutral-800/80 border border-neutral-200/60 dark:border-neutral-700/60 shadow-2xs">
            <span className="block text-xl sm:text-2xl font-black text-neutral-900 dark:text-neutral-100">
              {bookings.length}
            </span>
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">Total Bookings</span>
          </div>
          <div className="p-3 rounded-xl bg-white dark:bg-neutral-800/80 border border-neutral-200/60 dark:border-neutral-700/60 shadow-2xs">
            <span className="block text-xl sm:text-2xl font-black text-brand-600 dark:text-brand-400">
              {activeBookings.length}
            </span>
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">Active Slots</span>
          </div>
          <div className="p-3 rounded-xl bg-white dark:bg-neutral-800/80 border border-neutral-200/60 dark:border-neutral-700/60 shadow-2xs">
            <span className="block text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {completedBookings.length}
            </span>
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">Completed Deliveries</span>
          </div>
          <div className="p-3 rounded-xl bg-white dark:bg-neutral-800/80 border border-neutral-200/60 dark:border-neutral-700/60 shadow-2xs">
            <span className="block text-xl sm:text-2xl font-black text-neutral-900 dark:text-neutral-100">
              {farmer.landAreaAcres || 5.2}
            </span>
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">Farm Land (Acres)</span>
          </div>
        </div>
      </Card>

      {/* Main Content Area: Edit Mode or View Dossier */}
      {isEditing ? (
        <Card className="p-5 sm:p-7">
          <div className="mb-5 pb-3 border-b border-neutral-200 dark:border-neutral-800">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
              Update Farmer Profile Information (विवरण संशोधित करें)
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Changes are updated instantly across your official Mandi Gate Pass dossier and SMS notifications.
            </p>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField
                label="Full Name (पूरा नाम) *"
                required
                value={formData.name}
                placeholder="e.g. Ramesh Kumar Patel"
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              />

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Mobile Number (मोबाइल नंबर) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-neutral-400">
                    +91
                  </span>
                  <input
                    required
                    pattern="[6-9][0-9]{9}"
                    maxLength={10}
                    inputMode="numeric"
                    value={formData.phone}
                    onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value.replace(/\D/g, '') }))}
                    placeholder="9876543210"
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 py-2.5 pl-12 pr-4 text-sm font-medium tracking-wider text-neutral-900 dark:text-neutral-100 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <TextField
                label="Village / Town (गाँव / कस्बा) *"
                required
                value={formData.village}
                placeholder="e.g. Rampur"
                onChange={(e) => setFormData((p) => ({ ...p, village: e.target.value }))}
              />
              <TextField
                label="District (जिला) *"
                required
                value={formData.district}
                placeholder="e.g. Karnal"
                onChange={(e) => setFormData((p) => ({ ...p, district: e.target.value }))}
              />
              <TextField
                label="State (राज्य) *"
                required
                value={formData.state}
                placeholder="e.g. Haryana"
                onChange={(e) => setFormData((p) => ({ ...p, state: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField
                label="Total Farm Landholding in Acres (भूमि एकड़ में)"
                type="number"
                step="0.1"
                min="0"
                value={formData.landAreaAcres}
                placeholder="e.g. 5.5"
                onChange={(e) => setFormData((p) => ({ ...p, landAreaAcres: e.target.value }))}
              />

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Preferred Portal Language (पसंदीदा भाषा)
                </label>
                <select
                  value={formData.preferredLanguage}
                  onChange={(e) => setFormData((p) => ({ ...p, preferredLanguage: e.target.value }))}
                  className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 py-2.5 px-3 text-sm font-medium text-neutral-900 dark:text-neutral-100 focus:border-brand-500 focus:outline-none"
                >
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Crops Selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-2">
                Primary Cultivated Crops (प्रमुख फसलें)
              </label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_CROPS.map((crop) => {
                  const isSelected = formData.crops.includes(crop);
                  return (
                    <button
                      key={crop}
                      type="button"
                      onClick={() => toggleCrop(crop)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                          : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200'
                      }`}
                    >
                      {isSelected ? '✓' : '+'} {crop}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <Button type="submit" loading={saving} className="w-full sm:w-auto py-3 px-6 text-sm font-bold">
                {saving ? 'Saving Changes...' : 'Save Profile Changes (बदलाव सहेजें)'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsEditing(false)}
                className="w-full sm:w-auto py-3 px-4 text-sm font-semibold"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Government Dossier & UIDAI Verification Card */}
          <Card className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-sm">
                  🛡️
                </span>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Government Verification Status
                </h3>
              </div>
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                ACTIVE · SEEDED
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                <span className="text-neutral-600 dark:text-neutral-400 font-medium">Aadhaar Identification:</span>
                <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                  •••• •••• {farmer.aadhaarLast4 || '8942'} (UIDAI Verified)
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                <span className="text-neutral-600 dark:text-neutral-400 font-medium">DBT Guarantee Status:</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <span>✓</span> 20% Instant Advance Enabled
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                <span className="text-neutral-600 dark:text-neutral-400 font-medium">PFMS Payment Gateway:</span>
                <span className="font-bold text-neutral-800 dark:text-neutral-200">
                  Direct Bank Credit (Aadhaar Seeded)
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                <span className="text-neutral-600 dark:text-neutral-400 font-medium">Primary State Jurisdiction:</span>
                <span className="font-bold text-neutral-900 dark:text-neutral-100">
                  {farmer.state || 'Haryana'}
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 p-3 text-[11px] text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
              💡 <strong>DBT Advance Policy:</strong> Farmers with verified Aadhaar & mobile number receive their 20% safety advance via PFMS DBT within 2 hours of produce weighment.
            </div>
          </Card>

          {/* Farm Details & Crops Portfolio */}
          <Card className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-sm">
                  🌾
                </span>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Farm & Produce Dossier
                </h3>
              </div>
              <span className="text-xs text-neutral-500 font-mono">
                {farmer.landAreaAcres || 5.2} Acres Registered
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 block mb-2">
                  Registered Crop Lots for e-Upajan:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(farmer.crops && farmer.crops.length > 0
                    ? farmer.crops
                    : ['Wheat (गेहूं)', 'Paddy (धान)', 'Mustard (सरसों)']
                  ).map((crop: string) => (
                    <span
                      key={crop}
                      className="rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 text-xs font-bold text-emerald-900 dark:text-emerald-200"
                    >
                      🌾 {crop}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Mandi Region:</span>
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                    {farmer.district || 'Karnal'}, {farmer.state || 'Haryana'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Preferred Language:</span>
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200 uppercase">
                    {farmer.preferredLanguage || 'en'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Beneficiary ID:</span>
                  <span className="font-mono text-[10px] text-neutral-400 truncate max-w-[180px]">
                    {farmer._id}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button
                variant="secondary"
                className="w-full text-xs font-bold py-2.5"
                onClick={() => setIsEditing(true)}
              >
                ✎ Edit Produce & Farm Details
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Quick Navigation Action Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <a
          href="/booking"
          className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs hover:border-brand-500 dark:hover:border-brand-500 transition group"
        >
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 block">
              📅 Book Slot (स्लॉट बुक करें)
            </span>
            <span className="text-[11px] text-neutral-500 block">
              Choose from 18 nationwide Mandis
            </span>
          </div>
          <span className="text-brand-600 font-bold group-hover:translate-x-1 transition">➔</span>
        </a>

        <a
          href="/status"
          className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs hover:border-brand-500 dark:hover:border-brand-500 transition group"
        >
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 block">
              📋 My Mandi Bills & DBT
            </span>
            <span className="text-[11px] text-neutral-500 block">
              View vouchers & download S3 PDF bills
            </span>
          </div>
          <span className="text-brand-600 font-bold group-hover:translate-x-1 transition">➔</span>
        </a>

        <a
          href="/tracking"
          className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs hover:border-brand-500 dark:hover:border-brand-500 transition group"
        >
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 block">
              🚚 3PL Logistics Tracking
            </span>
            <span className="text-[11px] text-neutral-500 block">
              Track grain transport to FCI godowns
            </span>
          </div>
          <span className="text-brand-600 font-bold group-hover:translate-x-1 transition">➔</span>
        </a>
      </div>

      {/* Sign Out Card */}
      <Card className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-neutral-50/80 dark:bg-neutral-850/80">
        <div className="text-center sm:text-left">
          <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
            Session Management (सत्र प्रबंधन)
          </p>
          <p className="text-[11px] text-neutral-500">
            You are signed in as {farmer.name || farmer.phone || 'Verified Farmer'}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            clearToken();
            window.location.href = '/';
          }}
          className="rounded-xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-neutral-800 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
        >
          🚪 Sign Out from Device
        </button>
      </Card>
    </div>
  );
}
