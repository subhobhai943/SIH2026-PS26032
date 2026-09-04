export type LanguageCode = 'en' | 'hi' | 'pa' | 'bn' | 'mr' | 'te' | 'ta';

export interface Language {
  code: LanguageCode;
  name: string; // Native name
  englishName: string;
  region: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'hi', name: 'हिन्दी', englishName: 'Hindi', region: 'उत्तर एवं मध्य भारत', flag: '🇮🇳' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ', englishName: 'Punjabi', region: 'ਪੰਜਾਬ / ਹਰਿਆਣਾ', flag: '🌾' },
  { code: 'bn', name: 'বাংলা', englishName: 'Bengali', region: 'পশ্চিমবঙ্গ / ত্রিপুরা', flag: '🌾' },
  { code: 'mr', name: 'मराठी', englishName: 'Marathi', region: 'महाराष्ट्र', flag: '🌾' },
  { code: 'te', name: 'తెలుగు', englishName: 'Telugu', region: 'ఆంధ్రప్రదేశ్ / తెలంగాణ', flag: '🌾' },
  { code: 'ta', name: 'தமிழ்', englishName: 'Tamil', region: 'தமிழ்நாடு', flag: '🌾' },
  { code: 'en', name: 'English', englishName: 'English', region: 'Pan India', flag: '🌐' },
];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';
