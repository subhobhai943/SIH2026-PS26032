'use client';

import { useState, useRef } from 'react';
import { api, setToken } from '@/lib/api';
import { Alert, Button, Card, PageHeader, TextField } from '@/components/ui';
import { IconPhone, IconStatus, IconCamera, IconUpload, IconUser, IconCheck } from '@/components/icons';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { compressImage } from '@/lib/imageUtils';
import {
  isFirebaseConfigured,
  getFirebaseAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from '@/lib/firebase';

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

type Step = 'phone' | 'otp' | 'photo' | 'profile' | 'done';
const STEP_ORDER: Step[] = ['phone', 'otp', 'photo', 'profile', 'done'];

export default function RegisterPage() {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Farmer profile data
  const [profile, setProfile] = useState({
    name: '',
    village: '',
    district: '',
    state: '',
    photoUrl: '',
  });

  // Photo upload states
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isFirebaseConfigured) {
        const auth = getFirebaseAuth();
        if (!auth) throw new Error('Firebase Auth initialization failed');

        if (typeof window !== 'undefined') {
          if (!window.recaptchaVerifier) {
            window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
              size: 'invisible',
            });
          }
          const confirmation = await signInWithPhoneNumber(
            auth,
            `+91${phone}`,
            window.recaptchaVerifier
          );
          setConfirmationResult(confirmation);
          setStep('otp');
        }
      } else {
        await api.post('/farmers/otp/request', { phone });
        setStep('otp');
      }
    } catch (err: any) {
      if (typeof window !== 'undefined' && window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch {
          // ignore
        }
        window.recaptchaVerifier = undefined;
      }
      setError(err.message || 'Failed to send OTP. Please check your number.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      let data: { token: string; isNew: boolean; isProfileComplete?: boolean; hasPhoto?: boolean; farmer?: any };
      if (confirmationResult) {
        const userCredential = await confirmationResult.confirm(code);
        const idToken = await userCredential.user.getIdToken();
        data = await api.post<{ token: string; isNew: boolean; isProfileComplete?: boolean; hasPhoto?: boolean; farmer?: any }>('/farmers/firebase/verify', { idToken });
      } else {
        data = await api.post<{ token: string; isNew: boolean; isProfileComplete?: boolean; hasPhoto?: boolean; farmer?: any }>('/farmers/otp/verify', { phone, code });
      }
      setToken(data.token);

      const f = data.farmer;
      if (f) {
        setProfile({
          name: f.name || '',
          village: f.village || '',
          district: f.district || '',
          state: f.state || '',
          photoUrl: f.photoUrl || '',
        });
        if (f.photoUrl) {
          setPhotoPreview(f.photoUrl);
        }
      }

      // Mandatory Photo & Profile Verification:
      // If the farmer does NOT have a photograph yet, ALWAYS navigate to Step 3: Photo
      if (!f?.photoUrl) {
        setStep('photo');
      } else if (!f?.name?.trim() || !f?.village?.trim() || !f?.district?.trim()) {
        // If photograph exists but profile details are incomplete, navigate to Step 4: Profile
        setStep('profile');
      } else {
        // Both photograph and profile details are complete
        setStep('done');
      }
    } catch (err: any) {
      setError(err.message || 'Incorrect or expired OTP');
    } finally {
      setLoading(false);
    }
  }

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploadingPhoto(true);
    try {
      // 1. Compress on client (saves 95% bandwidth on rural 3G/4G)
      const compressed = await compressImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.85 });
      setPhotoPreview(compressed.dataUrl);

      // 2. Upload via backend (S3 if configured, or local fallback)
      const res = await api.post<{ url: string; provider: string }>('/upload', {
        image: compressed.dataUrl,
        category: 'farmer_photo',
        filename: compressed.filename,
      });

      setProfile((p) => ({ ...p, photoUrl: res.url }));
    } catch (err: any) {
      setError(err.message || 'Failed to process and upload photograph');
    } finally {
      setUploadingPhoto(false);
      if (e.target) e.target.value = '';
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.put('/farmers/me', profile);
      setStep('done');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const stepLabels: Record<Step, string> = {
    phone: t('reg_stepPhone'),
    otp: t('reg_stepOtp'),
    photo: t('reg_stepPhoto'),
    profile: t('reg_stepProfile'),
    done: t('reg_allSet'),
  };

  const currentStepNum = STEP_ORDER.indexOf(step) + 1;

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        eyebrow={t('reg_eyebrow')}
        title={t('reg_title')}
        subtitle={t('reg_subtitle')}
      />

      {/* Accessible Stepper Bar */}
      <div className="mb-6 rounded-2xl bg-white p-3.5 border border-neutral-200 shadow-sm">
        <div className="flex items-center justify-between gap-1">
          {STEP_ORDER.slice(0, 4).map((s, idx) => {
            const stepNum = idx + 1;
            const isPassed = stepNum < currentStepNum;
            const isCurrent = stepNum === currentStepNum;

            return (
              <div key={s} className="flex flex-1 items-center gap-1.5 min-w-0">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                    isPassed
                      ? 'bg-emerald-600 text-white'
                      : isCurrent
                      ? 'bg-brand-600 text-white ring-4 ring-brand-100'
                      : 'bg-neutral-100 text-neutral-500'
                  }`}
                >
                  {isPassed ? <IconCheck className="h-4 w-4" /> : stepNum}
                </div>
                <span
                  className={`truncate text-xs font-semibold ${
                    isCurrent ? 'text-brand-700' : isPassed ? 'text-neutral-700' : 'text-neutral-400'
                  }`}
                >
                  {stepLabels[s]}
                </span>
                {idx < 3 && <div className={`h-0.5 flex-1 rounded ${isPassed ? 'bg-emerald-500' : 'bg-neutral-200'}`} />}
              </div>
            );
          })}
        </div>
      </div>

      <Card className="p-6">
        {error && (
          <div className="mb-4">
            <Alert>{error}</Alert>
          </div>
        )}

        {/* STEP 1: Phone */}
        {step === 'phone' && (
          <form onSubmit={requestOtp} className="space-y-4">
            <div className="rounded-xl bg-blue-50/80 p-3 text-xs text-blue-900 border border-blue-200 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-[11px]">1</span>
              <span>Enter your 10-digit mobile number to receive a secure login OTP.</span>
            </div>

            <div className="flex items-center gap-2 text-brand-600">
              <IconPhone className="h-5 w-5" />
              <span className="text-sm font-semibold text-neutral-700">{t('reg_mobileNumber')}</span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-neutral-400">
                +91
              </span>
              <input
                required
                pattern="[6-9][0-9]{9}"
                maxLength={10}
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="9876543210"
                className="w-full rounded-xl border border-neutral-300 py-3 pl-12 pr-4 text-base font-medium tracking-wider text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div id="recaptcha-container" />
            <Button type="submit" loading={loading} className="w-full py-3 text-base">
              {loading ? t('reg_sending') : t('reg_sendOtp')}
            </Button>
          </form>
        )}

        {/* STEP 2: OTP */}
        {step === 'otp' && (
          <form onSubmit={verifyOtp} className="space-y-4">
            <p className="text-sm text-neutral-600">
              {t('reg_otpDesc')} <span className="font-semibold text-neutral-900">+91 {phone}</span>.
            </p>
            <TextField
              required
              pattern="\d{6}"
              maxLength={6}
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="text-center text-xl font-bold tracking-[0.5em] py-3"
            />
            <Button type="submit" loading={loading} className="w-full py-3 text-base">
              {loading ? t('reg_verifying') : t('reg_verifyContinue')}
            </Button>
            <button
              type="button"
              onClick={() => setStep('phone')}
              className="w-full text-center text-xs font-medium text-neutral-400 hover:text-neutral-600"
            >
              {t('reg_wrongNumber')}
            </button>
          </form>
        )}

        {/* STEP 3: Farmer Photo Upload */}
        {step === 'photo' && (
          <div className="space-y-5">
            <div>
              <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <IconCamera className="h-5 w-5 text-brand-600" />
                {t('reg_uploadPhotoTitle')}
              </h3>
              <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
                {t('reg_uploadPhotoSubtitle')} (Mandatory for biometric identity on Mandi Gate Pass)
              </p>
            </div>

            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-neutral-300 rounded-2xl bg-neutral-50 hover:bg-neutral-50/80 transition">
              {photoPreview ? (
                <div className="space-y-3 text-center">
                  <div className="relative mx-auto h-32 w-32 overflow-hidden rounded-full border-4 border-white shadow-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoPreview}
                      alt="Farmer Identification"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute bottom-1 right-1 rounded-full bg-emerald-600 p-1 text-white shadow">
                      <IconCheck className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-emerald-700 flex items-center justify-center gap-1">
                    <span>✓</span> {t('reg_photoUploaded')}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => cameraInputRef.current?.click()}
                      loading={uploadingPhoto}
                    >
                      <IconCamera className="h-4 w-4" />
                      Retake via Camera
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      loading={uploadingPhoto}
                    >
                      <IconUpload className="h-4 w-4" />
                      {t('reg_changePhoto')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-center">
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-neutral-200 text-neutral-400">
                    <IconUser className="h-12 w-12" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center justify-center gap-2.5">
                      <Button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        loading={uploadingPhoto}
                        className="py-2.5 px-4 text-sm"
                      >
                        <IconCamera className="h-4.5 w-4.5" />
                        {t('reg_takePhoto')}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => fileInputRef.current?.click()}
                        loading={uploadingPhoto}
                        className="py-2.5 px-4 text-sm"
                      >
                        <IconUpload className="h-4.5 w-4.5" />
                        Choose from Gallery
                      </Button>
                    </div>
                    <p className="mt-3 text-[11px] text-neutral-400">
                      Capture live photo with camera or choose an existing portrait photo
                    </p>
                  </div>
                </div>
              )}

              {/* Hidden file input with direct camera trigger */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={handlePhotoSelected}
              />
              {/* Hidden file input for file picker/gallery */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelected}
              />
            </div>

            <div className="pt-2">
              <Button
                type="button"
                className="w-full py-3 text-base"
                disabled={!profile.photoUrl || uploadingPhoto}
                onClick={() => {
                  if (!profile.photoUrl) {
                    setError('Please take or upload your identification photograph before continuing.');
                    return;
                  }
                  setStep('profile');
                }}
              >
                {uploadingPhoto
                  ? 'Uploading photograph...'
                  : profile.photoUrl
                  ? 'Continue to Profile Details →'
                  : 'Take or Upload Photo to Continue'}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: Profile Details */}
        {step === 'profile' && (
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="flex items-center gap-3 pb-2 border-b border-neutral-100">
              {profile.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.photoUrl}
                  alt="Farmer"
                  className="h-12 w-12 rounded-full object-cover border border-neutral-200"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
                  <IconUser className="h-6 w-6" />
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-neutral-900">{t('reg_profilePrompt')}</p>
                <p className="text-xs text-neutral-500">Government Procurement Pass Dossier</p>
              </div>
            </div>

            <TextField
              label={t('reg_fullName')}
              required
              value={profile.name}
              placeholder="e.g. Ramesh Kumar Patel"
              onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
            />
            <TextField
              label={t('reg_village')}
              required
              value={profile.village}
              placeholder="e.g. Rampur"
              onChange={(e) => setProfile((p) => ({ ...p, village: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label={t('reg_district')}
                required
                value={profile.district}
                placeholder="e.g. Karnal"
                onChange={(e) => setProfile((p) => ({ ...p, district: e.target.value }))}
              />
              <TextField
                label={t('reg_state')}
                required
                value={profile.state}
                placeholder="e.g. Haryana"
                onChange={(e) => setProfile((p) => ({ ...p, state: e.target.value }))}
              />
            </div>
            <Button type="submit" loading={loading} className="w-full py-3 text-base">
              {loading ? t('reg_saving') : t('reg_saveProfile')}
            </Button>
          </form>
        )}

        {/* STEP 5: Done */}
        {step === 'done' && (
          <div className="space-y-5 py-2 text-center">
            {profile.photoUrl ? (
              <div className="relative mx-auto h-20 w-20 overflow-hidden rounded-full border-2 border-emerald-500 shadow">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={profile.photoUrl} alt="Farmer" className="h-full w-full object-cover" />
              </div>
            ) : (
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <IconStatus className="h-7 w-7" />
              </span>
            )}
            <div>
              <p className="text-lg font-bold text-neutral-900">{t('reg_allSet')}</p>
              <p className="mt-1 text-sm text-neutral-500">{t('reg_accountReady')}</p>
            </div>
            <div className="rounded-xl bg-neutral-50 p-4 text-xs text-neutral-600 border border-neutral-200 text-left space-y-1.5">
              <div className="font-semibold text-neutral-900">Registered Beneficiary:</div>
              <div>Name: <span className="font-medium text-neutral-800">{profile.name || 'Farmer'}</span></div>
              <div>Phone: <span className="font-medium text-neutral-800">+91 {phone || 'Verified'}</span></div>
              <div>Mandi Verification: <span className="text-emerald-700 font-semibold">Active · 20% DBT Guarantee Enabled</span></div>
            </div>
            <div className="space-y-2">
              <Button onClick={() => (window.location.href = '/booking')} className="w-full py-3 text-base">
                {t('reg_bookFirstSlot')} →
              </Button>
              <button
                type="button"
                onClick={() => setStep('photo')}
                className="w-full text-center text-xs font-semibold text-brand-700 hover:text-brand-800 transition py-1"
              >
                Update Profile or Photo (विवरण या फोटो बदलें)
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
