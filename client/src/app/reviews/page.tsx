'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { api } from '@/lib/api';
import { prefersReducedMotion, animateModalEnter, animateModalExit } from '@/lib/animations';
import {
  IconStar,
  IconThumbUp,
  IconBuilding,
  IconWheat,
  IconShieldCheck,
  IconCheck,
  IconClose,
  IconSpinner,
  IconMapPin,
  IconUser,
} from '@/components/icons';

type Farmer = {
  _id: string;
  name: string;
  village?: string;
  district?: string;
  state?: string;
  crops?: string[];
  photoUrl?: string;
  averageRating: number;
  totalReviews: number;
  badge: string;
};

type ReviewItem = {
  _id: string;
  farmer: Farmer | string;
  buyerName: string;
  buyerCompany: string;
  buyerRole: string;
  buyerCity?: string;
  rating: number;
  comment: string;
  crop: string;
  lotQuantityQtl?: number;
  cropImageUrl?: string;
  tags?: string[];
  verifiedPurchase: boolean;
  helpfulCount: number;
  createdAt: string;
};

const DEFAULT_CROP_IMAGES: Record<string, string> = {
  wheat: '/api/media/crops/crop_wheat.jpg',
  paddy: '/api/media/crops/crop_paddy.jpg',
  maize: '/api/media/crops/crop_maize.jpg',
  mustard: '/api/media/crops/crop_mustard.jpg',
};

const AVAILABLE_TAGS = [
  'Grade A Grain',
  'Low Moisture (<11%)',
  'Accurate Weighbridge',
  'Punctual Dispatch',
  'High Test Weight',
  'Uniform Kernel Size',
  'Tamper-evident Bags',
  'Clean Lot',
  'Zero Aflatoxin',
  'Export Quality',
  'Direct Farmer Deal',
  'Lab Tested',
];

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCrop, setSelectedCrop] = useState('all');
  const [minRating, setMinRating] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'reviews' | 'farmers'>('reviews');

  // Review Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields
  const [selectedFarmerId, setSelectedFarmerId] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerCompany, setBuyerCompany] = useState('');
  const [buyerRole, setBuyerRole] = useState('Commercial Grain Purchaser');
  const [buyerCity, setBuyerCity] = useState('');
  const [rating, setRating] = useState(5);
  const [crop, setCrop] = useState('Wheat');
  const [lotQuantityQtl, setLotQuantityQtl] = useState<number>(30);
  const [cropImageUrl, setCropImageUrl] = useState(DEFAULT_CROP_IMAGES.wheat);
  const [selectedTags, setSelectedTags] = useState<string[]>([
    'Grade A Grain',
    'Low Moisture (<11%)',
  ]);
  const [comment, setComment] = useState('');

  // Farmer Detail Modal
  const [viewingFarmer, setViewingFarmer] = useState<Farmer | null>(null);
  const [farmerReviewsModal, setFarmerReviewsModal] = useState<ReviewItem[]>([]);
  const [farmerModalLoading, setFarmerModalLoading] = useState(false);

  // Helpful click tracking
  const [votedReviews, setVotedReviews] = useState<Record<string, boolean>>({});

  const reviewModalBackdropRef = useRef<HTMLDivElement>(null);
  const reviewModalCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isModalOpen && reviewModalBackdropRef.current && reviewModalCardRef.current) {
      try {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
        animateModalEnter(reviewModalBackdropRef.current, reviewModalCardRef.current, isMobile);
      } catch (err) {
        console.warn('Review modal enter animation failed:', err);
      }
    }
  }, [isModalOpen]);

  const handleCloseReviewModal = () => {
    if (prefersReducedMotion()) {
      setIsModalOpen(false);
      return;
    }
    try {
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
      animateModalExit(reviewModalBackdropRef.current, reviewModalCardRef.current, isMobile, () => {
        setIsModalOpen(false);
      });
    } catch {
      setIsModalOpen(false);
    }
  };

  useEffect(() => {
    if (!loading && !prefersReducedMotion()) {
      try {
        if (activeTab === 'reviews') {
          gsap.fromTo(
            '.review-card-item',
            { y: 12, opacity: 0.7 },
            {
              y: 0,
              opacity: 1,
              stagger: 0.03,
              duration: 0.3,
              ease: 'power2.out',
              clearProps: 'all',
            }
          );
        } else {
          gsap.fromTo(
            '.farmer-card-item',
            { scale: 0.96, opacity: 0.7 },
            {
              scale: 1,
              opacity: 1,
              stagger: 0.03,
              duration: 0.3,
              ease: 'back.out(1.2)',
              clearProps: 'all',
            }
          );
        }
      } catch (err) {
        console.warn('Review cards animation skipped:', err);
      }
    }
  }, [activeTab, loading]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [reviewsData, farmersData] = await Promise.all([
        api.get<ReviewItem[]>('/reviews'),
        api.get<Farmer[]>('/reviews/farmers-list'),
      ]);
      setReviews(reviewsData || []);
      setFarmers(farmersData || []);
      if (farmersData && farmersData.length > 0 && !selectedFarmerId) {
        setSelectedFarmerId(farmersData[0]._id);
      }
    } catch (err) {
      console.error('Failed to load reviews data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkHelpful(reviewId: string) {
    if (votedReviews[reviewId]) return;
    try {
      setVotedReviews((prev) => ({ ...prev, [reviewId]: true }));
      setReviews((prev) =>
        prev.map((r) =>
          r._id === reviewId ? { ...r, helpfulCount: (r.helpfulCount || 0) + 1 } : r
        )
      );
      await api.post(`/reviews/${reviewId}/helpful`);
    } catch (err) {
      console.error('Failed to mark helpful:', err);
    }
  }

  function toggleTag(tag: string) {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  }

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!selectedFarmerId) {
      setFormError('Please select a farmer to review');
      return;
    }
    if (!buyerName.trim()) {
      setFormError('Please enter your name');
      return;
    }
    if (!buyerCompany.trim()) {
      setFormError('Please enter your company or mill name');
      return;
    }
    if (comment.trim().length < 5) {
      setFormError('Comment must be at least 5 characters');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/reviews', {
        farmerId: selectedFarmerId,
        buyerName: buyerName.trim(),
        buyerCompany: buyerCompany.trim(),
        buyerRole: buyerRole.trim(),
        buyerCity: buyerCity.trim(),
        rating,
        comment: comment.trim(),
        crop,
        lotQuantityQtl: Number(lotQuantityQtl) || 0,
        cropImageUrl: cropImageUrl || undefined,
        tags: selectedTags,
      });

      setSubmitSuccess(true);
      setTimeout(() => {
        setIsModalOpen(false);
        setSubmitSuccess(false);
        setComment('');
        loadData();
      }, 1500);
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  }

  async function openFarmerDetails(farmer: Farmer) {
    setViewingFarmer(farmer);
    setFarmerModalLoading(true);
    try {
      const data = await api.get<{ reviews: ReviewItem[] }>(`/reviews/farmer/${farmer._id}`);
      setFarmerReviewsModal(data.reviews || []);
    } catch (err) {
      console.error('Failed to load farmer reviews:', err);
    } finally {
      setFarmerModalLoading(false);
    }
  }

  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      if (selectedCrop !== 'all' && r.crop?.toLowerCase() !== selectedCrop.toLowerCase()) {
        return false;
      }
      if (minRating > 0 && r.rating < minRating) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const farmerObj = typeof r.farmer === 'object' ? r.farmer : null;
        const farmerName = farmerObj?.name?.toLowerCase() || '';
        const company = r.buyerCompany?.toLowerCase() || '';
        const buyer = r.buyerName?.toLowerCase() || '';
        const comm = r.comment?.toLowerCase() || '';
        const tagMatch = r.tags?.some((t) => t.toLowerCase().includes(q));
        if (
          !farmerName.includes(q) &&
          !company.includes(q) &&
          !buyer.includes(q) &&
          !comm.includes(q) &&
          !tagMatch
        ) {
          return false;
        }
      }
      return true;
    });
  }, [reviews, selectedCrop, minRating, searchQuery]);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 pb-16 transition-colors">
      {/* Top Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-brand-950 via-brand-900 to-amber-950 text-white shadow-md">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage: `url('/api/media/backgrounds/bg_crops_landscape.jpg')`,
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur text-amber-200 border border-white/10">
                <IconShieldCheck className="h-3.5 w-3.5" />
                <span>Verified Procurement Feedback · खरीददार समीक्षा मंच</span>
              </div>
              <h1 className="text-2xl font-black sm:text-4xl tracking-tight leading-tight">
                Buyer Reviews & Farmer Produce Ratings
              </h1>
              <p className="text-sm sm:text-base text-brand-100 font-normal leading-relaxed">
                Direct crop quality analysis, hectolitre weight feedback, and weighment satisfaction
                ratings submitted by FCI officers, flour millers, and bulk grain aggregators.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-brand-950 px-5 py-3 text-sm font-bold shadow-lg shadow-amber-500/20 transition transform active:scale-95"
              >
                <IconStar className="h-4 w-4 fill-brand-950" filled />
                <span>Write Buyer Review (समीक्षा लिखें)</span>
              </button>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="mt-6 sm:mt-8 grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-white/10 p-3 sm:p-3.5 backdrop-blur border border-white/10">
              <p className="text-[11px] sm:text-xs text-brand-200 font-medium">Avg Produce Rating</p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-white">4.9</span>
                <span className="text-[10px] sm:text-xs text-amber-300">★★★★★</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-brand-200/80 mt-0.5 truncate">Across mandi lots</p>
            </div>

            <div className="rounded-2xl bg-white/10 p-3 sm:p-3.5 backdrop-blur border border-white/10">
              <p className="text-[11px] sm:text-xs text-brand-200 font-medium">Weighbridge Accuracy</p>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl sm:text-2xl font-black text-emerald-400">99.8%</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-brand-200/80 mt-0.5 truncate">Zero tare discrepancy</p>
            </div>

            <div className="rounded-2xl bg-white/10 p-3 sm:p-3.5 backdrop-blur border border-white/10">
              <p className="text-[11px] sm:text-xs text-brand-200 font-medium">Moisture Adherence</p>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl sm:text-2xl font-black text-amber-300">&lt; 12%</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-brand-200/80 mt-0.5 truncate">Optimal storage grade</p>
            </div>

            <div className="rounded-2xl bg-white/10 p-3 sm:p-3.5 backdrop-blur border border-white/10">
              <p className="text-[11px] sm:text-xs text-brand-200 font-medium">Institutional Buyers</p>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xs sm:text-xl font-black text-white truncate block">FCI · ITC · Cargill</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-brand-200/80 mt-0.5 truncate">Verified bulk buyers</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="mx-auto max-w-6xl px-1 sm:px-6 py-4 sm:py-8">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('reviews')}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                activeTab === 'reviews'
                  ? 'bg-brand-700 text-white shadow-sm'
                  : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800'
              }`}
            >
              Buyer Reviews & Feedback ({filteredReviews.length})
            </button>
            <button
              onClick={() => setActiveTab('farmers')}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                activeTab === 'farmers'
                  ? 'bg-brand-700 text-white shadow-sm'
                  : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800'
              }`}
            >
              Farmers Reputation Directory ({farmers.length})
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mb-6 rounded-2xl bg-white dark:bg-neutral-900 p-4 shadow-sm border border-neutral-200/80 dark:border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="w-full md:w-80">
            <input
              type="text"
              placeholder="Search by buyer, farmer, company, tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3.5 py-2 text-sm text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Crop Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Crop:</span>
              <select
                value={selectedCrop}
                onChange={(e) => setSelectedCrop(e.target.value)}
                className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="all">All Crops (सभी फसलें)</option>
                <option value="Wheat">Wheat (गेहूं)</option>
                <option value="Paddy">Paddy (धान)</option>
                <option value="Maize">Maize (मक्का)</option>
                <option value="Mustard">Mustard (सरसों)</option>
              </select>
            </div>

            {/* Rating Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Min Rating:</span>
              <select
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
                className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <option value={0}>All Stars (सभी)</option>
                <option value={5}>5 Stars Only (★★★★★)</option>
                <option value={4}>4+ Stars (★★★★☆)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <IconSpinner className="h-8 w-8 text-brand-600 dark:text-brand-400" />
            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400 font-medium">Loading buyer feedback...</p>
          </div>
        ) : activeTab === 'reviews' ? (
          <div className="space-y-4">
            {filteredReviews.length === 0 ? (
              <div className="rounded-2xl bg-white dark:bg-neutral-900 p-12 text-center border border-neutral-200 dark:border-neutral-800">
                <IconWheat className="mx-auto h-12 w-12 text-neutral-300 dark:text-neutral-600" />
                <h3 className="mt-3 text-base font-bold text-neutral-800 dark:text-neutral-200">No reviews found</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Try adjusting your filter or search query.
                </p>
              </div>
            ) : (
              filteredReviews.map((rev) => {
                const farmer = typeof rev.farmer === 'object' ? rev.farmer : null;
                const hasVoted = votedReviews[rev._id];

                return (
                  <div
                    key={rev._id}
                    className="review-card-item rounded-2xl bg-white dark:bg-neutral-900 p-5 shadow-sm border border-neutral-200/90 dark:border-neutral-800 transition hover:shadow-md"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      {/* Buyer Identity */}
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-950/60 border border-brand-100 dark:border-brand-800 text-brand-700 dark:text-brand-300 font-black text-sm">
                          {rev.buyerCompany?.slice(0, 2).toUpperCase() || 'BY'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{rev.buyerName}</h3>
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <IconCheck className="h-3 w-3" />
                              <span>Verified Buyer</span>
                            </span>
                          </div>
                          <p className="text-xs text-neutral-600 dark:text-neutral-300 font-medium flex items-center gap-1 mt-0.5">
                            <IconBuilding className="h-3.5 w-3.5 text-neutral-400" />
                            <span>{rev.buyerCompany}</span>
                            {rev.buyerRole && (
                              <>
                                <span className="text-neutral-300 dark:text-neutral-600">·</span>
                                <span className="text-neutral-500 dark:text-neutral-400">{rev.buyerRole}</span>
                              </>
                            )}
                          </p>
                          {rev.buyerCity && (
                            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 flex items-center gap-1 mt-0.5">
                              <IconMapPin className="h-3 w-3" />
                              <span>{rev.buyerCity}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Rating and Lot Specs */}
                      <div className="flex sm:flex-col items-end justify-between sm:justify-start gap-1">
                        <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                          <div className="flex text-amber-500">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <IconStar
                                key={star}
                                className="h-4 w-4"
                                filled={star <= Math.round(rev.rating)}
                              />
                            ))}
                          </div>
                          <span className="text-xs font-black text-amber-900 dark:text-amber-200 ml-1">
                            {rev.rating.toFixed(1)}
                          </span>
                        </div>

                        <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md mt-1">
                          {rev.lotQuantityQtl ? `${rev.lotQuantityQtl} Qtl · ` : ''}
                          {rev.crop} Lot
                        </span>
                      </div>
                    </div>

                    {/* Farmer Tagged Profile Banner */}
                    {farmer && (
                      <div className="mt-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-neutral-50/80 dark:bg-neutral-800/60 p-3 border border-neutral-100/90 dark:border-neutral-800 shadow-2xs">
                        <div className="flex items-center gap-3 min-w-0">
                          {farmer.photoUrl ? (
                            <img
                              src={farmer.photoUrl}
                              alt={farmer.name}
                              className="h-11 w-11 shrink-0 rounded-full object-cover border-2 border-brand-500 shadow-sm ring-2 ring-brand-100/50 dark:ring-brand-900/50"
                            />
                          ) : (
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900 text-brand-800 dark:text-brand-200 font-bold text-sm border-2 border-brand-200 dark:border-brand-700">
                              {farmer.name?.charAt(0) || 'F'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">{farmer.name}</span>
                              {farmer.badge && (
                                <span className="rounded-md bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  {farmer.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                              {farmer.village ? `${farmer.village}, ` : ''}{farmer.district || 'Mandi Yard'} · {farmer.state || 'India'}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => openFarmerDetails(farmer)}
                          className="self-end sm:self-auto shrink-0 text-[11px] font-bold text-brand-700 dark:text-brand-300 hover:text-brand-900 dark:hover:text-brand-100 bg-white dark:bg-neutral-800 hover:bg-brand-50 dark:hover:bg-neutral-700 px-3 py-1.5 rounded-xl border border-neutral-200/90 dark:border-neutral-700 shadow-xs transition flex items-center gap-1"
                        >
                          <span>Farmer Profile & Lots</span>
                          <span>→</span>
                        </button>
                      </div>
                    )}

                    {/* Review Body */}
                    <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed font-normal">
                      &ldquo;{rev.comment}&rdquo;
                    </p>

                    {/* Crop Produce Lot Inspection Media */}
                    {rev.cropImageUrl && (
                      <div className="mt-3.5 flex flex-col sm:flex-row gap-3.5 rounded-2xl bg-amber-50/30 dark:bg-amber-950/20 p-3 border border-amber-200/60 dark:border-amber-900/40 shadow-2xs">
                        <div className="relative shrink-0 overflow-hidden rounded-xl border border-amber-200/80 dark:border-amber-800/80 shadow-xs">
                          <img
                            src={rev.cropImageUrl}
                            alt={`${rev.crop} Crop Lot Sample`}
                            className="h-40 sm:h-28 w-full sm:w-36 object-cover transition duration-300 hover:scale-105"
                          />
                          <div className="absolute top-1.5 left-1.5 rounded bg-black/60 backdrop-blur-xs px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
                            Harvest Sample
                          </div>
                        </div>
                        <div className="flex flex-col justify-between py-0.5 min-w-0">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                                🌾 {rev.crop} Procurement Inspection Lot
                              </span>
                              <span className="rounded bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                S3 Cloud Media Verified
                              </span>
                            </div>
                            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 leading-relaxed">
                              Physical grain lot sampled at weighbridge gate. Grain moisture, test weight, and foreign matter verified within FAQ limits.
                            </p>
                          </div>
                          <div className="mt-2 flex items-center gap-3 text-[11px] text-neutral-600 dark:text-neutral-300 flex-wrap">
                            <span className="font-bold text-brand-800 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/60 px-2 py-0.5 rounded border border-brand-100 dark:border-brand-800">
                              ⚖️ {rev.lotQuantityQtl || 30} Qtl Lot
                            </span>
                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                              <IconCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                              <span>100% Traceable</span>
                            </span>
                            <span className="text-neutral-400 dark:text-neutral-500">
                              Direct from {farmer?.name || 'Farmer Producer'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Quality Tags Chips */}
                    {rev.tags && rev.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {rev.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center rounded-lg bg-neutral-100 dark:bg-neutral-800 px-2 py-1 text-[11px] font-semibold text-neutral-700 dark:text-neutral-300"
                          >
                            ✓ {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Footer / Helpful Button */}
                    <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-400 dark:text-neutral-500">
                      <span>
                        Procured & reviewed on{' '}
                        {new Date(rev.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleMarkHelpful(rev._id)}
                        disabled={hasVoted}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                          hasVoted
                            ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 cursor-default'
                            : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                        }`}
                      >
                        <IconThumbUp className="h-3.5 w-3.5" />
                        <span>Helpful ({rev.helpfulCount || 0})</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* Farmers Directory Tab */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {farmers.map((farmer) => (
              <div
                key={farmer._id}
                className="farmer-card-item rounded-2xl bg-white dark:bg-neutral-900 p-5 shadow-sm border border-neutral-200/90 dark:border-neutral-800 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {farmer.photoUrl ? (
                        <img
                          src={farmer.photoUrl}
                          alt={farmer.name}
                          className="h-12 w-12 shrink-0 rounded-full object-cover border-2 border-brand-500 shadow-sm"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900 text-brand-800 dark:text-brand-200 font-bold text-base border-2 border-brand-200 dark:border-brand-700">
                          {farmer.name?.charAt(0) || 'F'}
                        </div>
                      )}
                      <div>
                        <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">{farmer.name}</h3>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {farmer.village ? `${farmer.village}, ` : ''}
                          {farmer.district || 'Patiala'}, {farmer.state || 'Punjab'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">
                        <IconStar className="h-3.5 w-3.5 text-amber-500 fill-amber-500" filled />
                        <span className="text-xs font-black text-amber-900 dark:text-amber-200">
                          {farmer.averageRating?.toFixed(1) || '5.0'}
                        </span>
                      </div>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block mt-0.5">
                        {farmer.totalReviews || 0} reviews
                      </span>
                    </div>
                  </div>

                  <div className="mt-3">
                    <span className="inline-block rounded-md bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {farmer.badge || 'Verified Producer'}
                    </span>
                  </div>

                  {farmer.crops && farmer.crops.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {farmer.crops.map((c) => (
                        <span
                          key={c}
                          className="rounded bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-semibold text-neutral-600 dark:text-neutral-300"
                        >
                          🌾 {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openFarmerDetails(farmer)}
                    className="flex-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 px-3 py-2 text-xs font-bold transition text-center"
                  >
                    View All Reviews
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFarmerId(farmer._id);
                      setCrop(farmer.crops?.[0] || 'Wheat');
                      setFormError(null);
                      setIsModalOpen(true);
                    }}
                    className="flex-1 rounded-xl bg-brand-700 hover:bg-brand-800 text-white px-3 py-2 text-xs font-bold transition text-center"
                  >
                    + Review Produce
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Write Review Modal */}
      {isModalOpen && (
        <div
          ref={reviewModalBackdropRef}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
        >
          <div
            ref={reviewModalCardRef}
            className="relative w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl bg-white dark:bg-neutral-900 p-4 sm:p-6 shadow-2xl border border-neutral-100 dark:border-neutral-800 max-h-[90vh] overflow-y-auto text-neutral-900 dark:text-neutral-100"
          >
            <button
              onClick={handleCloseReviewModal}
              className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-600 dark:hover:text-neutral-300 absolute right-4 top-4"
            >
              <IconClose className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 text-brand-700 dark:text-brand-400 text-xs font-bold uppercase tracking-wider">
              <IconShieldCheck className="h-4 w-4" />
              <span>Official Buyer Assessment Form</span>
            </div>
            <h2 className="text-xl font-black text-neutral-900 dark:text-neutral-100 mt-1">
              Submit Farmer Produce Review
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Your feedback is verified and directly reflects on the farmer&apos;s mandi trust score.
            </p>

            {submitSuccess ? (
              <div className="my-8 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 p-6 text-center border border-emerald-200 dark:border-emerald-800">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300">
                  <IconCheck className="h-6 w-6" />
                </div>
                <h3 className="mt-3 text-base font-bold text-emerald-900 dark:text-emerald-200">Review Published!</h3>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                  Thank you! The farmer&apos;s reputation badge has been updated.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReview} className="mt-5 space-y-4">
                {formError && (
                  <div className="rounded-xl bg-red-50 dark:bg-red-950/50 p-3 text-xs font-medium text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                    {formError}
                  </div>
                )}

                {/* Farmer Select */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Select Farmer (किसान का चयन करें) *
                  </label>
                  <select
                    value={selectedFarmerId}
                    onChange={(e) => setSelectedFarmerId(e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-2.5 text-xs font-semibold text-neutral-800 dark:text-neutral-100 focus:border-brand-500 focus:outline-none"
                    required
                  >
                    {farmers.map((f) => (
                      <option key={f._id} value={f._id}>
                        {f.name} — {f.village || ''} ({f.district || ''})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Rating Star Picker */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Produce & Lot Rating (गुणवत्ता रेटिंग) *
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          className="p-1 text-amber-400 hover:scale-110 transition"
                        >
                          <IconStar className="h-7 w-7" filled={star <= rating} />
                        </button>
                      ))}
                    </div>
                    <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 ml-2">
                      {rating === 5 && '⭐⭐⭐⭐⭐ 5.0 - Outstanding Grade A'}
                      {rating === 4 && '⭐⭐⭐⭐ 4.0 - Very Good'}
                      {rating === 3 && '⭐⭐⭐ 3.0 - Standard Mandi FAQ'}
                      {rating === 2 && '⭐⭐ 2.0 - High Moisture / Chaff'}
                      {rating === 1 && '⭐ 1.0 - Substandard'}
                    </span>
                  </div>
                </div>

                {/* Crop & Quantity */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">Crop *</label>
                    <select
                      value={crop}
                      onChange={(e) => {
                        const newCrop = e.target.value;
                        setCrop(newCrop);
                        const matched = DEFAULT_CROP_IMAGES[newCrop.toLowerCase()];
                        if (matched) setCropImageUrl(matched);
                      }}
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 p-2 text-xs font-semibold"
                    >
                      <option value="Wheat">Wheat (गेहूं)</option>
                      <option value="Paddy">Paddy (धान)</option>
                      <option value="Maize">Maize (मक्का)</option>
                      <option value="Mustard">Mustard (सरसों)</option>
                      <option value="Barley">Barley (जौ)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      Lot Size (Quintals)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={lotQuantityQtl}
                      onChange={(e) => setLotQuantityQtl(Number(e.target.value))}
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 p-2 text-xs font-semibold"
                    />
                  </div>
                </div>

                {/* Crop Produce Image Preview */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Verified Crop Produce Image (AWS S3 Cloud Storage)
                  </label>
                  <div className="flex items-center gap-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/70 p-2.5 border border-neutral-200 dark:border-neutral-700">
                    <img
                      src={cropImageUrl || DEFAULT_CROP_IMAGES.wheat}
                      alt={crop}
                      className="h-14 w-20 rounded-xl object-cover border border-neutral-200 dark:border-neutral-700 shadow-xs shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1">
                        <span>🌾 {crop} Harvest Sample</span>
                        <span className="text-emerald-700 dark:text-emerald-400 font-medium text-[10px]">• S3 Synced</span>
                      </p>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5 truncate">
                        {cropImageUrl}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {Object.keys(DEFAULT_CROP_IMAGES).map((cKey) => (
                          <button
                            key={cKey}
                            type="button"
                            onClick={() => setCropImageUrl(DEFAULT_CROP_IMAGES[cKey])}
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold capitalize transition ${
                              cropImageUrl === DEFAULT_CROP_IMAGES[cKey]
                                ? 'bg-brand-700 text-white shadow-xs'
                                : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600'
                            }`}
                          >
                            {cKey}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Buyer Details */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      Your Name (खरीदार का नाम) *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Vikramaditya Roy"
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 p-2 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      Company / Mill Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Food Corporation of India / Flour Mill"
                      value={buyerCompany}
                      onChange={(e) => setBuyerCompany(e.target.value)}
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 p-2 text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      Designation / Role
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Chief Quality Officer"
                      value={buyerRole}
                      onChange={(e) => setBuyerRole(e.target.value)}
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 p-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      Mandi / City Location
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Patiala Mandi, Punjab"
                      value={buyerCity}
                      onChange={(e) => setBuyerCity(e.target.value)}
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 p-2 text-xs"
                    />
                  </div>
                </div>

                {/* Quality Tags (Toggle chips) */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Quality Highlights & Tags
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {AVAILABLE_TAGS.map((tag) => {
                      const isSelected = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                            isSelected
                              ? 'bg-brand-700 text-white shadow-sm'
                              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '}
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Review Comment */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Buyer Remarks & Quality Assessment *
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe grain purity, moisture level, hectolitre weight test results, weighment punctuality, packaging condition..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 p-2.5 text-xs leading-relaxed focus:border-brand-500 focus:outline-none"
                    required
                  />
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block text-right">
                    {comment.length}/1000 characters
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={handleCloseReviewModal}
                    className="w-1/3 rounded-xl border border-neutral-300 dark:border-neutral-700 py-2.5 text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-2/3 rounded-xl bg-brand-700 py-2.5 text-xs font-bold text-white hover:bg-brand-800 shadow-md transition disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <IconSpinner className="h-4 w-4" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <span>Publish Verified Review</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Farmer Reviews Detail Modal */}
      {viewingFarmer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl bg-white dark:bg-neutral-900 p-4 sm:p-6 shadow-2xl border border-neutral-100 dark:border-neutral-800 max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setViewingFarmer(null)}
              className="absolute right-4 top-4 rounded-full p-2 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              <IconClose className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3">
              {viewingFarmer.photoUrl ? (
                <img
                  src={viewingFarmer.photoUrl}
                  alt={viewingFarmer.name}
                  className="h-16 w-16 shrink-0 rounded-full object-cover border-2 border-brand-500 shadow-md ring-2 ring-brand-100 dark:ring-brand-900"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900 text-brand-800 dark:text-brand-200 font-bold text-xl border-2 border-brand-200 dark:border-brand-700">
                  {viewingFarmer.name?.charAt(0) || 'F'}
                </div>
              )}
              <div>
                <h2 className="text-xl font-black text-neutral-900 dark:text-neutral-100">{viewingFarmer.name}</h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {viewingFarmer.village ? `${viewingFarmer.village}, ` : ''}
                  {viewingFarmer.district}, {viewingFarmer.state}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="rounded bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    {viewingFarmer.badge}
                  </span>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    ★ {viewingFarmer.averageRating?.toFixed(1)} / 5.0
                  </span>
                  <span className="text-xs text-neutral-400 dark:text-neutral-500">
                    ({viewingFarmer.totalReviews} buyer ratings)
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-neutral-200 dark:border-neutral-800 pt-4">
              <h3 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-3">
                Verified Buyer Feedback & Comments
              </h3>

              {farmerModalLoading ? (
                <div className="py-8 text-center">
                  <IconSpinner className="mx-auto h-6 w-6 text-brand-600 dark:text-brand-400" />
                </div>
              ) : farmerReviewsModal.length === 0 ? (
                <p className="text-xs text-neutral-400 dark:text-neutral-500 italic py-4">No reviews recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {farmerReviewsModal.map((r) => (
                    <div
                      key={r._id}
                      className="rounded-xl bg-neutral-50 dark:bg-neutral-800/60 p-4 border border-neutral-200/70 dark:border-neutral-700/60"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">{r.buyerName}</span>
                          <span className="text-[11px] text-neutral-500 dark:text-neutral-400">({r.buyerCompany})</span>
                        </div>
                        <span className="text-xs font-black text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                          ★ {r.rating.toFixed(1)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed font-normal">
                        &ldquo;{r.comment}&rdquo;
                      </p>
                      {r.cropImageUrl && (
                        <div className="mt-2.5 flex items-center gap-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 p-2 border border-amber-200/60 dark:border-amber-900/40">
                          <img
                            src={r.cropImageUrl}
                            alt={`${r.crop} sample`}
                            className="h-12 w-16 shrink-0 rounded-lg object-cover border border-neutral-200 dark:border-neutral-700"
                          />
                          <div className="text-[11px] text-neutral-600 dark:text-neutral-300 min-w-0">
                            <div className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1">
                              <span>🌾 {r.crop} Lot Sample</span>
                              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">• S3 Media</span>
                            </div>
                            <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
                              {r.lotQuantityQtl ? `${r.lotQuantityQtl} Qtl · ` : ''}Weighbridge Inspected
                            </div>
                          </div>
                        </div>
                      )}
                      {r.tags && r.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {r.tags.map((tg) => (
                            <span
                              key={tg}
                              className="rounded bg-white dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-semibold text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700"
                            >
                              ✓ {tg}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
