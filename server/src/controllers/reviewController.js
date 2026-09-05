import { z } from 'zod';
import Review from '../models/Review.js';
import Farmer from '../models/Farmer.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { parse } from '../utils/validate.js';
import { escapeRegex } from '../utils/sanitize.js';

const createReviewSchema = z.object({
  farmerId: z.string().min(1, 'Farmer ID is required'),
  buyerName: z.string().min(2, 'Buyer name must be at least 2 characters'),
  buyerCompany: z.string().min(2, 'Buyer company must be at least 2 characters'),
  buyerRole: z.string().optional(),
  buyerCity: z.string().optional(),
  rating: z.number().min(1).max(5, 'Rating must be between 1 and 5 stars'),
  comment: z.string().min(5, 'Review comment must be at least 5 characters').max(1000),
  crop: z.string().optional(),
  lotQuantityQtl: z.number().min(0).optional(),
  cropImageUrl: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

/** POST /api/reviews — Buyer leaves a review & comment for a farmer */
export const createReview = asyncHandler(async (req, res) => {
  const body = parse(createReviewSchema, req.body);

  const farmer = await Farmer.findById(body.farmerId);
  if (!farmer) throw ApiError.notFound('Farmer not found');

  const review = await Review.create({
    farmer: farmer._id,
    buyerName: body.buyerName,
    buyerCompany: body.buyerCompany,
    buyerRole: body.buyerRole || 'Verified Bulk Buyer',
    buyerCity: body.buyerCity || '',
    rating: body.rating,
    comment: body.comment,
    crop: body.crop || farmer.crops?.[0] || 'Wheat',
    lotQuantityQtl: body.lotQuantityQtl || 0,
    cropImageUrl: body.cropImageUrl || '',
    tags: body.tags || [],
    verifiedPurchase: true,
  });

  // Recalculate farmer's aggregate ratings
  const stats = await Review.aggregate([
    { $match: { farmer: farmer._id } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);

  if (stats.length > 0) {
    farmer.averageRating = Math.round(stats[0].avgRating * 10) / 10;
    farmer.totalReviews = stats[0].count;
    if (farmer.averageRating >= 4.5 && farmer.totalReviews >= 3) {
      farmer.badge = 'Star Producer (A-Grade Verified)';
    } else if (farmer.averageRating >= 4.0) {
      farmer.badge = 'Trusted Producer';
    }
    await farmer.save();
  }

  res.status(201).json({
    ok: true,
    data: {
      review,
      farmerStats: {
        averageRating: farmer.averageRating,
        totalReviews: farmer.totalReviews,
        badge: farmer.badge,
      },
    },
  });
});

/** GET /api/reviews/farmer/:farmerId — Get all reviews and breakdown for a farmer */
export const getFarmerReviews = asyncHandler(async (req, res) => {
  const farmer = await Farmer.findById(req.params.farmerId).select('name village district state photoUrl crops averageRating totalReviews badge');
  if (!farmer) throw ApiError.notFound('Farmer not found');

  const reviews = await Review.find({ farmer: farmer._id }).sort({ createdAt: -1 });

  // Calculate rating distribution
  const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  const tagCounts = {};

  for (const r of reviews) {
    const star = Math.round(r.rating);
    if (ratingCounts[star] !== undefined) ratingCounts[star]++;
    for (const tag of r.tags || []) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  res.json({
    ok: true,
    data: {
      farmer,
      averageRating: farmer.averageRating || 5,
      totalReviews: reviews.length,
      ratingCounts,
      topTags: Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([tag, count]) => ({ tag, count })),
      reviews,
    },
  });
});

/** GET /api/reviews — List recent reviews across all farmers */
export const listAllReviews = asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.crop) query.crop = req.query.crop;
  if (req.query.minRating) query.rating = { $gte: Number(req.query.minRating) };

  const limit = Math.min(Number(req.query.limit || 30), 100);

  const reviews = await Review.find(query)
    .populate('farmer', 'name village district state photoUrl crops averageRating totalReviews badge')
    .sort({ createdAt: -1 })
    .limit(limit);

  res.json({ ok: true, data: reviews });
});

/** GET /api/reviews/farmers-list — List farmers that buyers can view and review */
export const listFarmersForReview = asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.crop && typeof req.query.crop === 'string') query.crops = req.query.crop.trim();
  if (req.query.search && typeof req.query.search === 'string') {
    const escaped = escapeRegex(req.query.search.trim());
    query.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { village: { $regex: escaped, $options: 'i' } },
      { district: { $regex: escaped, $options: 'i' } },
    ];
  }

  const farmers = await Farmer.find(query)
    .select('name village district state photoUrl crops averageRating totalReviews badge')
    .sort({ averageRating: -1, totalReviews: -1 })
    .limit(50);

  res.json({ ok: true, data: farmers });
});

/** POST /api/reviews/:reviewId/helpful — Mark a review as helpful */
export const markHelpful = asyncHandler(async (req, res) => {
  const review = await Review.findByIdAndUpdate(
    req.params.reviewId,
    { $inc: { helpfulCount: 1 } },
    { new: true }
  );
  if (!review) throw ApiError.notFound('Review not found');
  res.json({ ok: true, data: { helpfulCount: review.helpfulCount } });
});
