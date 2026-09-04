'use client';

import { useState } from 'react';
import { api, setToken } from '@/lib/api';
import { Alert, Button, Card, PageHeader, TextField } from '@/components/ui';
import { IconPhone, IconStatus } from '@/components/icons';
import { useTranslation } from '@/lib/i18n/LanguageContext';
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

type Step = 'phone' | 'otp' | 'profile' | 'done';
const STEP_ORDER: Step[] = ['phone', 'otp', 'profile', 'done'];

export default function RegisterPage() {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [profile, setProfile] = useState({ name: '', village: '', district: '', state: '' });

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
      if (confirmationResult) {
        const userCredential = await confirmationResult.confirm(code);
        const idToken = await userCredential.user.getIdToken();
        const data = await api.post<{ token: string; isNew: boolean }>('/farmers/firebase/verify', { idToken });
        setToken(data.token);
        setStep(data.isNew ? 'profile' : 'done');
      } else {
        const data = await api.post<{ token: string; isNew: boolean }>('/farmers/otp/verify', { phone, code });
        setToken(data.token);
        setStep(data.isNew ? 'profile' : 'done');
      }
    } catch (err: any) {
      setError(err.message || 'Incorrect or expired OTP');
    } finally {
      setLoading(false);
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

  const stepIndex = STEP_ORDER.indexOf(step);

  return (
    <div className="mx-auto max-w-md">
      <PageHeader
        eyebrow={t('reg_eyebrow')}
        title={t('reg_title')}
        subtitle={t('reg_subtitle')}
      />

      <div className="mb-6 flex items-center gap-2">
        {STEP_ORDER.slice(0, 3).map((s, i) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= stepIndex ? 'bg-brand-600' : 'bg-neutral-200'}`} />
        ))}
      </div>

      <Card className="p-6">
        {error && (
          <div className="mb-4">
            <Alert>{error}</Alert>
          </div>
        )}

        {step === 'phone' && (
          <form onSubmit={requestOtp} className="space-y-4">
            <div className="flex items-center gap-2 text-brand-600">
              <IconPhone className="h-5 w-5" />
              <span className="text-sm font-semibold text-neutral-700">{t('reg_mobileNumber')}</span>
            </div>
            <TextField
              required
              pattern="[6-9][0-9]{9}"
              maxLength={10}
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              placeholder="9876543210"
            />
            <div id="recaptcha-container" />
            <Button type="submit" loading={loading} className="w-full">
              {loading ? t('reg_sending') : t('reg_sendOtp')}
            </Button>
          </form>
        )}

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
              className="text-center text-lg tracking-[0.5em]"
            />
            <Button type="submit" loading={loading} className="w-full">
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

        {step === 'profile' && (
          <form onSubmit={saveProfile} className="space-y-4">
            <p className="text-sm text-neutral-600">{t('reg_profilePrompt')}</p>
            <TextField
              label={t('reg_fullName')}
              required
              value={profile.name}
              onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
            />
            <TextField
              label={t('reg_village')}
              required
              value={profile.village}
              onChange={(e) => setProfile((p) => ({ ...p, village: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label={t('reg_district')}
                required
                value={profile.district}
                onChange={(e) => setProfile((p) => ({ ...p, district: e.target.value }))}
              />
              <TextField
                label={t('reg_state')}
                required
                value={profile.state}
                onChange={(e) => setProfile((p) => ({ ...p, state: e.target.value }))}
              />
            </div>
            <Button type="submit" loading={loading} className="w-full">
              {loading ? t('reg_saving') : t('reg_saveProfile')}
            </Button>
          </form>
        )}

        {step === 'done' && (
          <div className="space-y-4 py-2 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <IconStatus className="h-7 w-7" />
            </span>
            <div>
              <p className="font-semibold text-neutral-900">{t('reg_allSet')}</p>
              <p className="text-sm text-neutral-500">{t('reg_accountReady')}</p>
            </div>
            <Button onClick={() => (window.location.href = '/booking')} className="w-full">
              {t('reg_bookFirstSlot')}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
