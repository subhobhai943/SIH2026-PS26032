'use client';

import { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { api, setToken, getToken, clearToken } from '@/lib/api';
import { Alert, Button, Card, PageHeader, TextField } from '@/components/ui';
import { IconPhone, IconStatus, IconCamera, IconUpload, IconUser, IconCheck, IconGoogle, IconShieldCheck } from '@/components/icons';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { compressImage } from '@/lib/imageUtils';
import { prefersReducedMotion } from '@/lib/animations';
import {
  isFirebaseConfigured,
  getFirebaseAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  GoogleAuthProvider,
  signInWithPopup,
  type ConfirmationResult,
} from '@/lib/firebase';

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

type Step = 'phone' | 'otp' | 'phone_link' | 'photo' | 'aadhaar' | 'profile' | 'done';

const STEP_NUM_MAP: Record<Step, number> = {
  phone: 1,
  otp: 2,
  phone_link: 2,
  photo: 3,
  aadhaar: 4,
  profile: 5,
  done: 6,
};

export default function RegisterPage() {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleUser, setGoogleUser] = useState<{ name?: string; email?: string; photoUrl?: string } | null>(null);
  const [linkPhoneInput, setLinkPhoneInput] = useState('');
  const [existingUser, setExistingUser] = useState<any | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const stepCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = getToken();
    if (token) {
      api
        .get<any>('/farmers/me')
        .then((data) => {
          if (data && data._id) {
            setExistingUser(data);
          }
        })
        .catch(() => {
          clearToken();
          setExistingUser(null);
        })
        .finally(() => {
          setCheckingAuth(false);
        });
    } else {
      setCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    if (stepCardRef.current && !prefersReducedMotion()) {
      try {
        gsap.fromTo(
          stepCardRef.current,
          { opacity: 0, x: 20 },
          { opacity: 1, x: 0, duration: 0.35, ease: 'power2.out', clearProps: 'transform,opacity' }
        );
      } catch (err) {
        console.warn('Register step animation skipped:', err);
      }
    }
  }, [step]);


  // Farmer profile data
  const [profile, setProfile] = useState({
    name: '',
    village: '',
    district: '',
    state: '',
    photoUrl: '',
    aadhaarNumber: '',
    aadhaarCardUrl: '',
  });

  // Photo upload states
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Aadhaar document upload states
  const [aadhaarPhotoPreview, setAadhaarPhotoPreview] = useState<string | null>(null);
  const [uploadingAadhaarPhoto, setUploadingAadhaarPhoto] = useState(false);
  const aadhaarFileInputRef = useRef<HTMLInputElement>(null);

  function formatAadhaarInput(val: string) {
    const digits = val.replace(/\D/g, '').slice(0, 12);
    const parts = [];
    for (let i = 0; i < digits.length; i += 4) {
      parts.push(digits.slice(i, i + 4));
    }
    return parts.join(' ');
  }

  async function handleAadhaarPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploadingAadhaarPhoto(true);
    try {
      const compressed = await compressImage(file, { maxWidth: 900, maxHeight: 900, quality: 0.85 });
      setAadhaarPhotoPreview(compressed.dataUrl);

      const res = await api.post<{ url: string }>('/upload', {
        image: compressed.dataUrl,
        category: 'aadhaar_doc',
        filename: compressed.filename,
      });

      setProfile((p) => ({ ...p, aadhaarCardUrl: res.url }));
    } catch (err: any) {
      setError(err.message || 'Failed to process and upload Aadhaar card photograph');
    } finally {
      setUploadingAadhaarPhoto(false);
      if (e.target) e.target.value = '';
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleLoading(true);
    try {
      if (!isFirebaseConfigured) {
        throw new Error('Firebase authentication is not configured in client environment.');
      }
      const auth = getFirebaseAuth();
      if (!auth) throw new Error('Firebase Auth initialization failed');

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

      const data = await api.post<{
        token: string;
        isNew: boolean;
        isProfileComplete?: boolean;
        hasPhoto?: boolean;
        needsPhone?: boolean;
        farmer?: any;
      }>('/farmers/google/verify', { idToken });

      setToken(data.token);

      const f = data.farmer;
      const gName = f?.name || result.user.displayName || '';
      const gEmail = f?.email || result.user.email || '';
      const gPhoto = f?.photoUrl || result.user.photoURL || '';

      if (f) {
        setProfile({
          name: gName,
          village: f.village || '',
          district: f.district || '',
          state: f.state || '',
          photoUrl: gPhoto,
          aadhaarNumber: f.aadhaarNumber || (f.aadhaarLast4 ? `•••• •••• ${f.aadhaarLast4}` : ''),
          aadhaarCardUrl: f.aadhaarCardUrl || '',
        });
        if (gPhoto) {
          setPhotoPreview(gPhoto);
        }
        if (f.aadhaarCardUrl) {
          setAadhaarPhotoPreview(f.aadhaarCardUrl);
        }
        if (f.phone) {
          setPhone(f.phone);
        }
      }

      setGoogleUser({
        name: gName,
        email: gEmail,
        photoUrl: gPhoto,
      });

      if (data.needsPhone) {
        setStep('phone_link');
      } else if (!gPhoto) {
        setStep('photo');
      } else if (!f?.village?.trim() || !f?.district?.trim() || !(f?.aadhaarNumber || f?.aadhaarLast4)) {
        setStep('profile');
      } else {
        setStep('done');
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        return;
      }
      if (err.code === 'auth/popup-blocked') {
        setError('Popup was blocked by your browser. Please allow popups for Google Sign-In.');
        return;
      }
      setError(err.message || 'Google Sign-In failed. Please try again or use Mobile OTP.');
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleLinkPhone(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(linkPhoneInput)) {
      setError('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const updatedFarmer = await api.put<any>('/farmers/me', { phone: linkPhoneInput });
      setPhone(linkPhoneInput);
      if (updatedFarmer) {
        setProfile((prev) => ({
          ...prev,
          name: prev.name || updatedFarmer.name || '',
          village: prev.village || updatedFarmer.village || '',
          district: prev.district || updatedFarmer.district || '',
          state: prev.state || updatedFarmer.state || '',
          photoUrl: prev.photoUrl || updatedFarmer.photoUrl || '',
          aadhaarNumber: prev.aadhaarNumber || updatedFarmer.aadhaarNumber || (updatedFarmer.aadhaarLast4 ? `•••• •••• ${updatedFarmer.aadhaarLast4}` : ''),
          aadhaarCardUrl: prev.aadhaarCardUrl || updatedFarmer.aadhaarCardUrl || '',
        }));
        if (updatedFarmer.photoUrl && !photoPreview) {
          setPhotoPreview(updatedFarmer.photoUrl);
        }
        if (updatedFarmer.aadhaarCardUrl && !aadhaarPhotoPreview) {
          setAadhaarPhotoPreview(updatedFarmer.aadhaarCardUrl);
        }
      }

      if (!profile.photoUrl && !updatedFarmer?.photoUrl) {
        setStep('photo');
      } else if (!profile.village?.trim() || !profile.district?.trim() || !updatedFarmer?.village?.trim() || !(updatedFarmer?.aadhaarNumber || updatedFarmer?.aadhaarLast4 || profile.aadhaarNumber)) {
        setStep('profile');
      } else {
        setStep('done');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to link mobile number. Please check the number and try again.');
    } finally {
      setLoading(false);
    }
  }

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
          aadhaarNumber: f.aadhaarNumber || (f.aadhaarLast4 ? `•••• •••• ${f.aadhaarLast4}` : ''),
          aadhaarCardUrl: f.aadhaarCardUrl || '',
        });
        if (f.photoUrl) {
          setPhotoPreview(f.photoUrl);
        }
        if (f.aadhaarCardUrl) {
          setAadhaarPhotoPreview(f.aadhaarCardUrl);
        }
      }

      // Mandatory 5-Step Verification Routing
      if (!f?.photoUrl) {
        setStep('photo');
      } else if (!f?.aadhaarNumber && !f?.aadhaarLast4) {
        setStep('aadhaar');
      } else if (!f?.name?.trim() || !f?.village?.trim() || !f?.district?.trim()) {
        setStep('profile');
      } else {
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

    const rawAadhaar = profile.aadhaarNumber.replace(/\D/g, '');
    const isMaskedExisting = profile.aadhaarNumber.includes('••••');
    if (!rawAadhaar && !isMaskedExisting) {
      setError('Please enter your 12-digit Aadhaar Number in Step 4 (कृपया 12 अंकों की आधार संख्या दर्ज करें).');
      setStep('aadhaar');
      return;
    }
    if (rawAadhaar && rawAadhaar.length !== 12 && !isMaskedExisting) {
      setError('Aadhaar number must be exactly 12 digits (आधार संख्या ठीक 12 अंकों की होनी चाहिए).');
      setStep('aadhaar');
      return;
    }

    if (!profile.name.trim()) {
      setError('Please enter your full name (कृपया अपना पूरा नाम दर्ज करें).');
      return;
    }
    if (!profile.village.trim() || !profile.district.trim()) {
      setError('Please provide your village and district (गाँव और जिला दर्ज करें).');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        name: profile.name,
        village: profile.village,
        district: profile.district,
        state: profile.state,
        photoUrl: profile.photoUrl,
      };
      if (rawAadhaar.length === 12) {
        payload.aadhaarNumber = rawAadhaar;
      }
      if (profile.aadhaarCardUrl) {
        payload.aadhaarCardUrl = profile.aadhaarCardUrl;
      }

      await api.put('/farmers/me', payload);
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
    phone_link: t('reg_mobileNumber'),
    photo: t('reg_stepPhoto'),
    aadhaar: 'Aadhaar KYC (आधार सत्यापन)',
    profile: t('reg_stepProfile'),
    done: t('reg_allSet'),
  };

  if (existingUser) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <PageHeader
          eyebrow="खाता पहले से लॉगिन है · Active Farmer Session"
          title="Already Signed In (लॉगिन स्थिति)"
          subtitle="You are already authenticated with your verified farmer profile."
        />

        <Card className="overflow-hidden border-2 border-emerald-600/50 shadow-xl bg-white dark:bg-neutral-900">
          <div className="bg-gradient-to-r from-emerald-800 to-brand-900 px-5 py-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">
                  Verified Farmer Account
                </span>
              </div>
              <span className="rounded bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">
                {existingUser.badge || 'A-Grade Producer'}
              </span>
            </div>
          </div>

          <div className="p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-4">
              {existingUser.photoUrl ? (
                <img
                  src={existingUser.photoUrl}
                  alt={existingUser.name || 'Farmer'}
                  className="h-16 w-16 rounded-2xl object-cover ring-2 ring-emerald-500/30 shrink-0"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 text-2xl font-bold shrink-0">
                  🌾
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-extrabold text-neutral-900 dark:text-neutral-100 truncate">
                  {existingUser.name || 'Registered Farmer'}
                </h3>
                {existingUser.email && (
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 truncate">
                    ✉️ {existingUser.email}
                  </p>
                )}
                {existingUser.phone && (
                  <p className="text-xs font-mono font-semibold text-neutral-600 dark:text-neutral-400">
                    📱 +91 {existingUser.phone}
                  </p>
                )}
                {(existingUser.aadhaarNumber || existingUser.aadhaarLast4) && (
                  <p className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                    🆔 Aadhaar: •••• •••• {existingUser.aadhaarLast4 || existingUser.aadhaarNumber?.slice(-4)} (UIDAI Verified)
                  </p>
                )}
                {(existingUser.village || existingUser.district) && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                    📍 {existingUser.village ? `${existingUser.village}, ` : ''}{existingUser.district} ({existingUser.state})
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-3.5 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200">
              <p className="font-semibold">✓ You are currently signed in.</p>
              <p className="mt-0.5 opacity-80">
                You do not need to register or verify OTP again. You can directly proceed to book delivery slots, check your live queue token, or view your 20% DBT safety advance receipt.
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              <a
                href="/booking"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-500 py-3.5 px-4 text-sm font-extrabold text-white shadow-md transition"
              >
                <span>📅 Proceed to Book Slot (स्लॉट बुक करें)</span>
                <span>➔</span>
              </a>

              <a
                href="/status"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 py-3 px-4 text-sm font-bold text-neutral-800 dark:text-neutral-200 transition border border-neutral-200 dark:border-neutral-700"
              >
                <span>📋 View My Queue & DBT Payment Status (मेरी स्थिति देखें)</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  clearToken();
                  setExistingUser(null);
                  setStep('phone');
                }}
                className="w-full text-center text-xs font-bold text-red-600 dark:text-red-400 hover:underline py-2 transition"
              >
                🚪 Sign Out & Switch Account (दूसरे नंबर से लॉगिन करें)
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const currentStepNum = STEP_NUM_MAP[step] || 1;

  const DISPLAY_STEPS = [
    { id: 'phone', label: t('reg_stepPhone'), num: 1 },
    { id: 'otp', label: t('reg_stepOtp'), num: 2 },
    { id: 'photo', label: t('reg_stepPhoto'), num: 3 },
    { id: 'aadhaar', label: 'Aadhaar (आधार)', num: 4 },
    { id: 'profile', label: t('reg_stepProfile'), num: 5 },
  ];

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        eyebrow={t('reg_eyebrow')}
        title={t('reg_title')}
        subtitle={t('reg_subtitle')}
      />

      {/* Accessible 5-Step Progress Stepper Bar */}
      <div className="mb-4 sm:mb-6 rounded-2xl bg-white dark:bg-neutral-900 p-3 sm:p-3.5 border border-neutral-200 dark:border-neutral-800 shadow-sm">
        {/* Mobile Stepper Header: Step X of 5 */}
        <div className="flex sm:hidden items-center justify-between mb-2">
          <span className="text-xs font-bold text-brand-700 dark:text-brand-400">
            Step {Math.min(currentStepNum, 5)} of 5: {stepLabels[step] || 'Done'}
          </span>
          <span className="text-[11px] font-medium text-neutral-400">
            {Math.round((Math.min(currentStepNum, 5) / 5) * 100)}%
          </span>
        </div>
        {/* Progress bar on mobile */}
        <div className="h-1.5 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden sm:hidden">
          <div
            className="h-full bg-brand-600 transition-all duration-300 rounded-full"
            style={{ width: `${Math.min(100, (Math.min(currentStepNum, 5) / 5) * 100)}%` }}
          />
        </div>

        {/* Desktop Stepper */}
        <div className="hidden sm:flex items-center justify-between gap-1">
          {DISPLAY_STEPS.map((s, idx) => {
            const isPassed = s.num < currentStepNum;
            const isCurrent = s.num === currentStepNum;

            return (
              <div key={s.id} className="flex flex-1 items-center gap-1.5 min-w-0">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                    isPassed
                      ? 'bg-emerald-600 text-white'
                      : isCurrent
                      ? 'bg-brand-600 text-white ring-4 ring-brand-100 dark:ring-brand-900/50'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                  }`}
                >
                  {isPassed ? <IconCheck className="h-4 w-4" /> : s.num}
                </div>
                <span
                  className={`truncate text-xs font-semibold ${
                    isCurrent ? 'text-brand-700 dark:text-brand-400' : isPassed ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-400'
                  }`}
                >
                  {s.label}
                </span>
                {idx < DISPLAY_STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 rounded ${isPassed ? 'bg-emerald-500' : 'bg-neutral-200 dark:bg-neutral-700'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div ref={stepCardRef}>
        <Card className="p-4 sm:p-6">
        {error && (
          <div className="mb-4">
            <Alert>{error}</Alert>
          </div>
        )}

        {/* STEP 1: Phone or Google Sign-In */}
        {step === 'phone' && (
          <div className="space-y-5">
            {/* Option A: Continue with Google */}
            <div className="space-y-2">
              <button
                type="button"
                disabled={googleLoading || loading}
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-3 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-750 py-3.5 px-4 text-sm font-bold text-neutral-800 dark:text-neutral-100 shadow-sm transition hover:border-neutral-300 hover:shadow active:scale-[0.99] disabled:opacity-60 cursor-pointer"
              >
                <IconGoogle className="h-5 w-5 shrink-0" />
                <span>{googleLoading ? t('reg_connectingGoogle') : t('reg_continueGoogle')}</span>
              </button>
              <p className="text-[11px] text-center text-neutral-500 dark:text-neutral-400">
                ⚡ 1-click fast login with your verified Google account
              </p>
            </div>

            {/* Divider */}
            <div className="relative flex items-center justify-center my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-200 dark:border-neutral-700" />
              </div>
              <div className="relative bg-white dark:bg-neutral-900 px-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                {t('reg_orMobileOtp')}
              </div>
            </div>

            {/* Option B: Mobile Number OTP */}
            <form onSubmit={requestOtp} className="space-y-4">
              <div className="rounded-xl bg-blue-50/80 dark:bg-blue-950/40 p-3 text-xs text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-800 flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-[11px]">1</span>
                <span>Enter your 10-digit mobile number to receive a secure login OTP.</span>
              </div>

              <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400">
                <IconPhone className="h-5 w-5" />
                <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{t('reg_mobileNumber')}</span>
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
                  className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 py-3 pl-12 pr-4 text-base font-medium tracking-wider text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <div id="recaptcha-container" />
              <Button type="submit" loading={loading} className="w-full py-3 text-base">
                {loading ? t('reg_sending') : t('reg_sendOtp')}
              </Button>
            </form>
          </div>
        )}

        {/* STEP 2: OTP */}
        {step === 'otp' && (
          <form onSubmit={verifyOtp} className="space-y-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              {t('reg_otpDesc')} <span className="font-semibold text-neutral-900 dark:text-neutral-100">+91 {phone}</span>.
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
              className="w-full text-center text-xs font-medium text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition"
            >
              {t('reg_wrongNumber')}
            </button>
          </form>
        )}

        {/* STEP 2-ALT: Link Mobile Number for Google accounts */}
        {step === 'phone_link' && (
          <div className="space-y-4">
            {googleUser && (
              <div className="flex items-center gap-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 p-3.5 border border-neutral-200 dark:border-neutral-700">
                {googleUser.photoUrl ? (
                  <img
                    src={googleUser.photoUrl}
                    alt={googleUser.name || 'Google User'}
                    className="h-11 w-11 rounded-full object-cover ring-2 ring-emerald-500/30 shrink-0"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold shrink-0">
                    G
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">✓ Google Account Connected</span>
                  <p className="text-sm font-extrabold text-neutral-900 dark:text-neutral-100 truncate">
                    {googleUser.name || 'Verified Google User'}
                  </p>
                  {googleUser.email && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                      {googleUser.email}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3.5 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                <span>📢</span> Mandi Gate Pass Requirement
              </p>
              <p className="opacity-90">
                {t('reg_linkPhoneNotice')}
              </p>
            </div>

            <form onSubmit={handleLinkPhone} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5 block">
                  {t('reg_mobileNumber')}
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
                    value={linkPhoneInput}
                    onChange={(e) => setLinkPhoneInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="9876543210"
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 py-3 pl-12 pr-4 text-base font-medium tracking-wider text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
              </div>

              <Button type="submit" loading={loading} className="w-full py-3 text-base">
                {loading ? t('reg_saving') : `${t('reg_linkAndContinue')} →`}
              </Button>

              <button
                type="button"
                onClick={() => {
                  clearToken();
                  setExistingUser(null);
                  setGoogleUser(null);
                  setStep('phone');
                }}
                className="w-full text-center text-xs font-medium text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition pt-1"
              >
                ← Use a different login method
              </button>
            </form>
          </div>
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
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 w-full">
                      <Button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        loading={uploadingPhoto}
                        className="w-full sm:w-auto py-2.5 px-4 text-sm"
                      >
                        <IconCamera className="h-4.5 w-4.5" />
                        {t('reg_takePhoto')}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => fileInputRef.current?.click()}
                        loading={uploadingPhoto}
                        className="w-full sm:w-auto py-2.5 px-4 text-sm"
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
                  setError(null);
                  setStep('aadhaar');
                }}
              >
                {uploadingPhoto
                  ? 'Uploading photograph...'
                  : profile.photoUrl
                  ? 'Continue to Step 4: Aadhaar Verification (आधार सत्यापन) →'
                  : 'Take or Upload Photo to Continue'}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: Mandatory Aadhaar Verification */}
        {step === 'aadhaar' && (
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <IconShieldCheck className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                  <span>Step 4: Aadhaar Verification (आधार सत्यापन)</span>
                </h3>
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                  Govt. DBT Mandate
                </span>
              </div>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Enter your 12-digit Aadhaar Card number for bank account verification under Ministry of Agriculture DBT guidelines (PFMS 2-hour 20% advance guarantee).
              </p>
            </div>

            {/* UIDAI Encrypted Callout */}
            <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/80 p-3 text-xs border border-neutral-200 dark:border-neutral-700 flex items-start gap-2.5">
              <span className="text-lg shrink-0">🛡️</span>
              <div className="text-[11px] text-neutral-600 dark:text-neutral-300 leading-normal">
                <p className="font-bold text-neutral-800 dark:text-neutral-200">UIDAI Secured Beneficiary Link</p>
                <p className="mt-0.5 opacity-90">
                  Your Aadhaar number is securely validated to verify produce ownership and enable 20% advance settlement directly into your Aadhaar-seeded bank account.
                </p>
              </div>
            </div>

            {/* 12-Digit Aadhaar Input */}
            <div className="space-y-2 rounded-2xl border-2 border-brand-500/80 dark:border-brand-600 bg-brand-50/50 dark:bg-brand-950/30 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-600 text-white text-[10px] font-black">
                    🆔
                  </span>
                  <span>Aadhaar Number (12 अंक आधार संख्या) *</span>
                </label>
                {profile.aadhaarNumber.replace(/\D/g, '').length === 12 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800 animate-pulse">
                    <IconCheck className="h-3 w-3 stroke-[3]" />
                    <span>12-Digit Format Valid</span>
                  </span>
                )}
              </div>

              <input
                type="text"
                required
                autoFocus
                inputMode="numeric"
                maxLength={14}
                value={profile.aadhaarNumber}
                onChange={(e) => {
                  const formatted = formatAadhaarInput(e.target.value);
                  setProfile((p) => ({ ...p, aadhaarNumber: formatted }));
                }}
                placeholder="xxxx xxxx xxxx (e.g. 5432 9876 1234)"
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-3 text-base font-mono font-black tracking-widest text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 placeholder:tracking-normal focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 text-center"
              />

              <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 pt-1">
                <span>Required for DBT PFMS Bank Transfer</span>
                <span className="font-mono text-[11px] font-bold">
                  {profile.aadhaarNumber.replace(/\D/g, '').length} / 12 digits
                </span>
              </div>

              {/* Aadhaar Document / Scan Upload */}
              <div className="pt-3 border-t border-brand-200/80 dark:border-brand-900/60 mt-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-neutral-600 dark:text-neutral-400">
                    <span className="font-bold text-neutral-800 dark:text-neutral-200">Aadhaar Card Copy (आधार कार्ड फोटो/दस्तावेज़):</span>
                    <p className="text-[10px] text-neutral-400">Upload photo for faster physical verification at Mandi gate</p>
                  </div>

                  {profile.aadhaarCardUrl || aadhaarPhotoPreview ? (
                    <div className="flex items-center gap-2">
                      <div className="relative h-10 w-16 overflow-hidden rounded-lg border border-neutral-300 shadow-2xs">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={aadhaarPhotoPreview || profile.aadhaarCardUrl}
                          alt="Aadhaar Document"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAadhaarPhotoPreview(null);
                          setProfile((p) => ({ ...p, aadhaarCardUrl: '' }));
                        }}
                        className="text-[11px] text-red-600 hover:underline font-bold"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => aadhaarFileInputRef.current?.click()}
                      disabled={uploadingAadhaarPhoto}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-700 dark:text-brand-300 bg-white dark:bg-neutral-800 border border-brand-300 dark:border-brand-700 px-3 py-2 rounded-xl shadow-2xs hover:bg-brand-50 transition cursor-pointer shrink-0"
                    >
                      <IconUpload className="h-3.5 w-3.5" />
                      <span>{uploadingAadhaarPhoto ? 'Uploading...' : 'Upload Card'}</span>
                    </button>
                  )}
                </div>

                <input
                  ref={aadhaarFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAadhaarPhotoSelected}
                />
              </div>
            </div>

            {/* DBT Guarantee Consent */}
            <div className="rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 p-3 text-xs text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2">
              <span className="text-sm">✓</span>
              <p className="text-[11px] leading-relaxed">
                <strong>Direct Benefit Transfer (DBT) Consent:</strong> I confirm that this Aadhaar number is linked with my active bank account to receive 20% advance procurement funds within 2 hours of produce weighment.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('photo')}
                className="w-full sm:w-auto text-center text-xs font-bold text-neutral-500 hover:text-neutral-700 py-2.5 px-4 transition"
              >
                ← Back to Photo
              </button>

              <Button
                type="button"
                className="w-full sm:flex-1 py-3 text-base"
                disabled={profile.aadhaarNumber.replace(/\D/g, '').length !== 12 && !profile.aadhaarNumber.includes('••••')}
                onClick={() => {
                  const raw = profile.aadhaarNumber.replace(/\D/g, '');
                  const isMasked = profile.aadhaarNumber.includes('••••');
                  if (raw.length !== 12 && !isMasked) {
                    setError('Please enter a valid 12-digit Aadhaar Card number (कृपया ठीक 12 अंकों की आधार संख्या दर्ज करें).');
                    return;
                  }
                  setError(null);
                  setStep('profile');
                }}
              >
                <span>Continue to Step 5: Farm Profile (विवरण) →</span>
              </Button>
            </div>
          </div>
        )}

        {/* STEP 5: Mandi & Farm Dossier Details */}
        {step === 'profile' && (
          <form onSubmit={saveProfile} className="space-y-4">
            {/* Summary card showing Photo & Aadhaar from Steps 3 and 4 */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-2.5">
                {profile.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.photoUrl}
                    alt="Farmer"
                    className="h-10 w-10 rounded-full object-cover border border-emerald-400 shrink-0"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                    🌾
                  </div>
                )}
                <div className="text-xs min-w-0">
                  <p className="font-bold text-emerald-950 dark:text-emerald-100 flex items-center gap-1">
                    <IconCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                    <span>Identity & Aadhaar Verified</span>
                  </p>
                  <p className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400 truncate">
                    Aadhaar: •••• •••• {profile.aadhaarNumber.replace(/\D/g, '').slice(-4) || 'Verified'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep('aadhaar')}
                className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 underline shrink-0 cursor-pointer"
              >
                Edit Aadhaar
              </button>
            </div>

            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <IconUser className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                <span>Step 5: Farmer & Mandi Dossier (किसान एवं कृषि विवरण)</span>
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Enter your agricultural address and landholding for official Mandi Gate Pass issuance.
              </p>
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

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('aadhaar')}
                className="text-xs font-bold text-neutral-500 hover:text-neutral-700 py-2.5 px-3 transition"
              >
                ← Back to Aadhaar
              </button>
              <Button type="submit" loading={loading} className="flex-1 py-3 text-base">
                {loading ? t('reg_saving') : '✓ Complete Registration & Issue Gate Pass →'}
              </Button>
            </div>
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
            <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800 p-4 text-xs text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 text-left space-y-1.5">
              <div className="font-semibold text-neutral-900 dark:text-neutral-100">Registered Beneficiary:</div>
              <div>Name: <span className="font-medium text-neutral-800 dark:text-neutral-200">{profile.name || 'Farmer'}</span></div>
              {googleUser?.email && (
                <div>Email: <span className="font-medium text-neutral-800 dark:text-neutral-200">{googleUser.email}</span></div>
              )}
              <div>Phone: <span className="font-medium text-neutral-800 dark:text-neutral-200">+91 {phone || 'Verified'}</span></div>
              <div>Aadhaar: <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">•••• •••• {profile.aadhaarNumber.replace(/\D/g, '').slice(-4) || 'Verified'} (UIDAI Verified)</span></div>
              <div>Mandi Verification: <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Active · 20% DBT Guarantee Enabled</span></div>
            </div>
            <div className="space-y-2">
              <Button onClick={() => (window.location.href = '/booking')} className="w-full py-3 text-base">
                {t('reg_bookFirstSlot')} →
              </Button>
              <div className="flex items-center justify-center gap-3 text-xs font-semibold text-brand-700 dark:text-brand-400 py-1">
                <button
                  type="button"
                  onClick={() => setStep('photo')}
                  className="hover:underline cursor-pointer"
                >
                  📷 Change Photo
                </button>
                <span className="text-neutral-300">·</span>
                <button
                  type="button"
                  onClick={() => setStep('aadhaar')}
                  className="hover:underline cursor-pointer"
                >
                  🆔 Update Aadhaar
                </button>
                <span className="text-neutral-300">·</span>
                <button
                  type="button"
                  onClick={() => setStep('profile')}
                  className="hover:underline cursor-pointer"
                >
                  ✏️ Edit Details
                </button>
              </div>
            </div>
          </div>
        )}
        </Card>
      </div>
    </div>
  );
}
