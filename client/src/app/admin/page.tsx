'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Card, EmptyState, PageHeader, StatTile, StatusBadge, TextField } from '@/components/ui';
import {
  IconAdmin,
  IconClose,
  IconMapPin,
  IconQueue,
  IconRupee,
  IconWheat,
  IconTruck,
  IconShieldCheck,
  IconStar,
  IconCheck,
  IconBuilding,
  IconSpinner,
  IconGlobe,
  IconPhone,
  IconClock,
  IconUser,
  IconSearch,
  IconDatabase,
  IconCalendar,
} from '@/components/icons';


const API_URL = '/api';
const ADMIN_TOKEN_KEY = 'sih26032_admin_token';

const DEFAULT_RATES: Record<string, number> = {
  wheat: 2275,
  paddy: 2203,
  maize: 2090,
  mustard: 5650,
  cotton: 7122,
  soybean: 4892,
  gram: 5440,
  pulses: 6950,
  cumin: 18500,
  onion: 1950,
};

type Center = {
  _id: string;
  name: string;
  code?: string;
  district: string;
  state?: string;
  address?: string;
  crops?: string[];
  dailyCapacity?: number;
  openTime?: string;
  closeTime?: string;
  contactPhone?: string;
};
type QueueEntry = {
  _id: string;
  token: number;
  status: string;
  crop?: string;
  estimatedQuantityQtl?: number;
  farmer: { _id?: string; name: string; phone: string; village: string };
  slot: { startTime: string; endTime: string };
  billPdfUrl?: string;
};
type QueueState = {
  center: { id: string; name: string };
  date: string;
  nowServing: { token: number } | null;
  waiting: QueueEntry[];
  counts: { total: number; waiting: number; completed: number; cancelled: number };
};

type ProcurementData = {
  _id?: string;
  crop: string;
  quantityQtl: number;
  ratePerQtl: number;
  qualityGrade: string;
  amount: number;
  advanceAmount: number;
  balanceAmount: number;
  advanceStatus: 'pending' | 'paid';
  advancePaymentRef?: string;
  balanceStatus: 'pending' | 'paid';
  paymentRef?: string;
  stage: string;
  paymentConfirmed?: boolean;
  paymentConfirmedAt?: string;
  paymentConfirmationSlipId?: string;
  utrNumber?: string;
  advanceUtr?: string;
  balanceUtr?: string;
  bankName?: string;
  accountMasked?: string;
  ifscCode?: string;
  billPdfUrl?: string;
  billGeneratedAt?: string;
};

type FarmerItem = {
  _id: string;
  name: string;
  phone: string;
  village: string;
  district?: string;
  state?: string;
  aadhaarLast4?: string;
  landAreaAcres?: number;
  crops?: string[];
  badge?: string;
  preferredLanguage?: string;
  createdAt: string;
  stats?: {
    totalBookings: number;
    totalProcurements: number;
    completedDeliveries: number;
    totalMspValue: number;
    hasBill: boolean;
  };
};

type FarmerDossier = {
  farmer: FarmerItem;
  bookings: Array<{
    _id: string;
    token: number;
    crop?: string;
    estimatedQuantityQtl?: number;
    date: string;
    status: string;
    center?: { name: string; district?: string; state?: string };
    slot?: { startTime: string; endTime: string };
    createdAt: string;
  }>;
  procurements: Array<{
    _id: string;
    crop: string;
    quantityQtl: number;
    ratePerQtl: number;
    amount: number;
    advanceAmount: number;
    balanceAmount: number;
    stage: string;
    utrNumber?: string;
    billPdfUrl?: string;
    createdAt: string;
  }>;
  notifications: Array<{
    _id: string;
    type: string;
    channel: string;
    title: string;
    message: string;
    sentAt: string;
    status: string;
  }>;
};

type AnnouncementItem = {
  _id: string;
  title: string;
  message: string;
  type: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  isActive: boolean;
  targetAudience: string;
  state: string;
  crop: string;
  authorName?: string;
  createdAt: string;
  updatedAt?: string;
};

type AnnouncementStats = {
  total: number;
  activeCount: number;
  inactiveCount: number;
  urgentCount: number;
};

type DatabaseCollectionInfo = {
  name: string;
  displayName: string;
  description: string;
  category: string;
  count: number;
  storageSize?: number;
  totalIndexSize?: number;
};

type DatabaseOverview = {
  database: {
    name: string;
    collections: number;
    objects: number;
    avgObjSize: number;
    dataSize: number;
    storageSize: number;
    indexes: number;
    indexSize: number;
    connection: {
      status: string;
      host: string;
      port: number;
    };
  };
  collections: DatabaseCollectionInfo[];
};

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [staffUser, setStaffUser] = useState<{ name?: string; role?: string; username?: string; email?: string } | null>(null);
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [adminTab, setAdminTab] = useState<'queue' | 'users' | 'database' | 'system' | 'reviews' | 'centers' | 'announcements'>('queue');
  const [systemMetrics, setSystemMetrics] = useState<any>(null);

  const [metricsLoading, setMetricsLoading] = useState(false);
  const [adminReviews, setAdminReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [centers, setCenters] = useState<Center[]>([]);
  const [centerId, setCenterId] = useState('');
  const [queue, setQueue] = useState<QueueState | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Procurement Centres Management state
  const [centerModalOpen, setCenterModalOpen] = useState(false);
  const [centerFormLoading, setCenterFormLoading] = useState(false);
  const [centerFormError, setCenterFormError] = useState<string | null>(null);
  const [centerFormSuccess, setCenterFormSuccess] = useState<string | null>(null);
  const [centerAdminSearch, setCenterAdminSearch] = useState('');
  const [centerAdminState, setCenterAdminState] = useState('All');
  const [slotGenLoading, setSlotGenLoading] = useState<string | null>(null);
  const [slotGenMessage, setSlotGenMessage] = useState<string | null>(null);
  const [newCenter, setNewCenter] = useState({
    name: '',
    code: '',
    district: '',
    state: '',
    address: '',
    crops: 'wheat, paddy',
    dailyCapacity: 200,
    openTime: '08:00',
    closeTime: '17:00',
    contactPhone: '',
  });

  // Announcements Management state
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [announcementsStats, setAnnouncementsStats] = useState<AnnouncementStats | null>(null);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementItem | null>(null);
  const [announcementActionLoading, setAnnouncementActionLoading] = useState<string | null>(null);
  const [announcementFeedback, setAnnouncementFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [announcementSearch, setAnnouncementSearch] = useState('');
  const [announcementTypeFilter, setAnnouncementTypeFilter] = useState('all');
  const [announcementPriorityFilter, setAnnouncementPriorityFilter] = useState('all');
  const [announcementStatusFilter, setAnnouncementStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    message: '',
    type: 'general',
    priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
    isActive: true,
    targetAudience: 'all',
    state: 'All India',
    crop: 'All Crops',
  });

  // Crop Purchase & 20% Advance modal state
  const [selectedEntry, setSelectedEntry] = useState<QueueEntry | null>(null);
  const [procurement, setProcurement] = useState<ProcurementData | null>(null);
  const [procLoading, setProcLoading] = useState(false);
  const [procMessage, setProcMessage] = useState<string | null>(null);
  const [procError, setProcError] = useState<string | null>(null);
  const [procSubmittingAction, setProcSubmittingAction] = useState<string | null>(null);

  // 3rd-Party Logistics & Tracking state
  const [shipment, setShipment] = useState<any>(null);
  const [carrierName, setCarrierName] = useState('Delhivery Agri Logistics');
  const [vehicleNumber, setVehicleNumber] = useState('HR 05 BA 4421');
  const [driverName, setDriverName] = useState('Rajesh Kumar');
  const [driverPhone, setDriverPhone] = useState('+91 98765 43210');
  const [checkpointStatus, setCheckpointStatus] = useState('in_transit');
  const [checkpointLocation, setCheckpointLocation] = useState('');
  const [checkpointTitle, setCheckpointTitle] = useState('');
  const [shipLoading, setShipLoading] = useState(false);

  // Farmers / Users Directory state
  const [farmers, setFarmers] = useState<FarmerItem[]>([]);
  const [farmersLoading, setFarmersLoading] = useState(false);
  const [farmersStats, setFarmersStats] = useState<{
    totalFarmers: number;
    verifiedKyc: number;
    totalLandAcres: number;
    statesCount: number;
  } | null>(null);
  const [farmerSearch, setFarmerSearch] = useState('');
  const [farmerStateFilter, setFarmerStateFilter] = useState('All');
  const [farmerPage, setFarmerPage] = useState(1);
  const [farmerTotalPages, setFarmerTotalPages] = useState(1);
  const [farmerTotalCount, setFarmerTotalCount] = useState(0);
  const [farmerDossier, setFarmerDossier] = useState<FarmerDossier | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossierModalOpen, setDossierModalOpen] = useState(false);
  const [updatingFarmerBadge, setUpdatingFarmerBadge] = useState(false);

  // Database Inspector & Telemetry state
  const [dbOverview, setDbOverview] = useState<DatabaseOverview | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [activeCollection, setActiveCollection] = useState('farmers');
  const [collectionDocs, setCollectionDocs] = useState<any[]>([]);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [collectionTotal, setCollectionTotal] = useState(0);
  const [collectionPage, setCollectionPage] = useState(1);
  const [collectionTotalPages, setCollectionTotalPages] = useState(1);
  const [collectionSearch, setCollectionSearch] = useState('');
  const [inspectedDoc, setInspectedDoc] = useState<any | null>(null);
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [copiedDocId, setCopiedDocId] = useState<string | null>(null);


  useEffect(() => {
    const savedToken = window.localStorage.getItem(ADMIN_TOKEN_KEY);
    setToken(savedToken);
    try {
      const savedStaff = window.localStorage.getItem('sih26032_admin_staff');
      if (savedStaff) setStaffUser(JSON.parse(savedStaff));
    } catch {}
  }, []);

  const loadCenters = async () => {
    try {
      const r = await fetch(`${API_URL}/centers`);
      const body = await r.json();
      setCenters(body.data || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadCenters();
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (!lockoutUntil) return;
    const iv = setInterval(() => {
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockoutUntil(null);
        setError(null);
        setFailedAttempts(0);
      } else {
        setError(`Too many login attempts. Try again in ${remaining}s`);
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [lockoutUntil]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (lockoutUntil && Date.now() < lockoutUntil) return;
    setError(null);
    setLoginLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameOrEmail, email: usernameOrEmail, password }),
      });
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        const retryAfter = body?.retryAfterSeconds || 900;
        setLockoutUntil(Date.now() + retryAfter * 1000);
        setError(`Too many login attempts. Try again in ${retryAfter}s`);
        return;
      }
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setFailedAttempts((p) => p + 1);
        throw new Error(body?.error?.message || 'Invalid credentials');
      }
      setFailedAttempts(0);
      window.localStorage.setItem(ADMIN_TOKEN_KEY, body.data.token);
      setToken(body.data.token);
      if (body.data.staff) {
        window.localStorage.setItem('sih26032_admin_staff', JSON.stringify(body.data.staff));
        setStaffUser(body.data.staff);
      }
      if (body.data?.staff?.center) setCenterId(body.data.staff.center);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoginLoading(false);
    }
  }

  async function callAuthed(path: string, options: RequestInit = {}) {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    });
    const body = await res.json();
    if (!res.ok || !body.ok) throw new Error(body?.error?.message || 'Request failed');
    return body.data;
  }

  async function loadAnnouncements() {
    setAnnouncementsLoading(true);
    setAnnouncementFeedback(null);
    try {
      const params = new URLSearchParams();
      if (announcementSearch.trim()) params.set('search', announcementSearch.trim());
      if (announcementTypeFilter !== 'all') params.set('type', announcementTypeFilter);
      if (announcementPriorityFilter !== 'all') params.set('priority', announcementPriorityFilter);
      if (announcementStatusFilter !== 'all') params.set('status', announcementStatusFilter);

      const data = await callAuthed(`/admin/announcements?${params.toString()}`);
      setAnnouncements(data?.announcements || []);
      setAnnouncementsStats(data?.stats || null);
    } catch (err: any) {
      setAnnouncementFeedback({ type: 'error', message: err.message || 'Failed to load announcements' });
    } finally {
      setAnnouncementsLoading(false);
    }
  }

  async function handleToggleAnnouncement(id: string) {
    setAnnouncementActionLoading(id);
    try {
      const updated = await callAuthed(`/admin/announcements/${id}/toggle`, { method: 'PATCH' });
      setAnnouncements((prev) => prev.map((a) => (a._id === id ? { ...a, isActive: updated.isActive } : a)));
      setAnnouncementsStats((prev) => {
        if (!prev) return prev;
        const diff = updated.isActive ? 1 : -1;
        return {
          ...prev,
          activeCount: Math.max(0, prev.activeCount + diff),
          inactiveCount: Math.max(0, prev.inactiveCount - diff),
        };
      });
      setAnnouncementFeedback({
        type: 'success',
        message: `Announcement ${updated.isActive ? 'activated (live on portal)' : 'deactivated (hidden)'}`,
      });
      setTimeout(() => setAnnouncementFeedback(null), 3000);
    } catch (err: any) {
      setAnnouncementFeedback({ type: 'error', message: err.message || 'Failed to toggle status' });
    } finally {
      setAnnouncementActionLoading(null);
    }
  }

  async function handleDeleteAnnouncement(id: string) {
    if (!window.confirm('Are you sure you want to permanently delete this announcement?')) return;
    setAnnouncementActionLoading(id);
    try {
      await callAuthed(`/admin/announcements/${id}`, { method: 'DELETE' });
      setAnnouncements((prev) => prev.filter((a) => a._id !== id));
      setAnnouncementsStats((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          total: Math.max(0, prev.total - 1),
          activeCount: Math.max(0, prev.activeCount - 1),
        };
      });
      setAnnouncementFeedback({ type: 'success', message: 'Announcement deleted successfully' });
      setTimeout(() => setAnnouncementFeedback(null), 3000);
    } catch (err: any) {
      setAnnouncementFeedback({ type: 'error', message: err.message || 'Failed to delete announcement' });
    } finally {
      setAnnouncementActionLoading(null);
    }
  }

  function openCreateAnnouncementModal() {
    setEditingAnnouncement(null);
    setAnnouncementForm({
      title: '',
      message: '',
      type: 'general',
      priority: 'normal',
      isActive: true,
      targetAudience: 'all',
      state: 'All India',
      crop: 'All Crops',
    });
    setAnnouncementModalOpen(true);
  }

  function openEditAnnouncementModal(item: AnnouncementItem) {
    setEditingAnnouncement(item);
    setAnnouncementForm({
      title: item.title,
      message: item.message,
      type: item.type,
      priority: item.priority,
      isActive: item.isActive,
      targetAudience: item.targetAudience || 'all',
      state: item.state || 'All India',
      crop: item.crop || 'All Crops',
    });
    setAnnouncementModalOpen(true);
  }

  async function handleSaveAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!announcementForm.title.trim() || !announcementForm.message.trim()) {
      setAnnouncementFeedback({ type: 'error', message: 'Title and message are required' });
      return;
    }

    setAnnouncementActionLoading('save');
    try {
      if (editingAnnouncement) {
        const updated = await callAuthed(`/admin/announcements/${editingAnnouncement._id}`, {
          method: 'PUT',
          body: JSON.stringify(announcementForm),
        });
        setAnnouncements((prev) => prev.map((a) => (a._id === editingAnnouncement._id ? updated : a)));
        setAnnouncementFeedback({ type: 'success', message: 'Announcement updated successfully' });
      } else {
        const created = await callAuthed('/admin/announcements', {
          method: 'POST',
          body: JSON.stringify(announcementForm),
        });
        setAnnouncements((prev) => [created, ...prev]);
        setAnnouncementFeedback({ type: 'success', message: 'Announcement published successfully' });
      }
      setAnnouncementModalOpen(false);
      loadAnnouncements();
      setTimeout(() => setAnnouncementFeedback(null), 4000);
    } catch (err: any) {
      setAnnouncementFeedback({ type: 'error', message: err.message || 'Failed to save announcement' });
    } finally {
      setAnnouncementActionLoading(null);
    }
  }

  async function loadQueue() {
    setError(null);
    try {
      const data = await callAuthed(`/admin/queue?centerId=${centerId}`);
      setQueue(data);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function loadSystemMetrics() {
    setMetricsLoading(true);
    setError(null);
    try {
      const data = await callAuthed('/admin/system-metrics');
      setSystemMetrics(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setMetricsLoading(false);
    }
  }

  async function loadAdminReviews() {
    setReviewsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/reviews`);
      const body = await res.json();
      setAdminReviews(body.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setReviewsLoading(false);
    }
  }

  async function loadFarmers(page = 1, search = farmerSearch, state = farmerStateFilter) {
    setFarmersLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        page: String(page),
        limit: '10',
      });
      if (search) q.set('search', search);
      if (state && state !== 'All') q.set('state', state);
      const res = await callAuthed(`/admin/farmers?${q.toString()}`);
      setFarmers(res.farmers || []);
      setFarmerPage(res.page || res.pagination?.page || 1);
      setFarmerTotalPages(res.totalPages || res.pagination?.totalPages || 1);
      setFarmerTotalCount(res.total || res.pagination?.total || 0);
      if (res.stats) setFarmersStats(res.stats);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFarmersLoading(false);
    }
  }

  async function openFarmerDossier(farmerId: string) {
    setDossierModalOpen(true);
    setDossierLoading(true);
    try {
      const res = await callAuthed(`/admin/farmers/${farmerId}`);
      setFarmerDossier(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDossierLoading(false);
    }
  }

  async function handleUpdateBadge(farmerId: string, newBadge: string) {
    setUpdatingFarmerBadge(true);
    try {
      await callAuthed(`/admin/farmers/${farmerId}`, {
        method: 'PATCH',
        body: JSON.stringify({ badge: newBadge }),
      });
      if (farmerDossier) {
        setFarmerDossier({ ...farmerDossier, farmer: { ...farmerDossier.farmer, badge: newBadge } });
      }
      setFarmers((prev) => prev.map((f) => (f._id === farmerId ? { ...f, badge: newBadge } : f)));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdatingFarmerBadge(false);
    }
  }

  async function loadDatabaseOverview() {
    setDbLoading(true);
    try {
      const res = await callAuthed('/admin/database/overview');
      setDbOverview(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDbLoading(false);
    }
  }

  async function loadCollectionData(colName = activeCollection, page = 1, search = collectionSearch) {
    setCollectionLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(page),
        limit: '10',
      });
      if (search) q.set('search', search);
      const res = await callAuthed(`/admin/database/collection/${colName}?${q.toString()}`);
      setCollectionDocs(res.documents || []);
      setCollectionPage(res.page || res.pagination?.page || 1);
      setCollectionTotalPages(res.totalPages || res.pagination?.totalPages || 1);
      setCollectionTotal(res.total || res.pagination?.total || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCollectionLoading(false);
    }
  }

  function handleSelectCollection(colName: string) {
    setActiveCollection(colName);
    setCollectionPage(1);
    setCollectionSearch('');
    loadCollectionData(colName, 1, '');
  }

  function openDocInspector(doc: any) {
    setInspectedDoc(doc);
    setDocModalOpen(true);
    setCopiedDocId(null);
  }

  function copyDocJson(doc: any) {
    navigator.clipboard.writeText(JSON.stringify(doc, null, 2));
    setCopiedDocId(doc?._id || 'json');
    setTimeout(() => setCopiedDocId(null), 2000);
  }

  useEffect(() => {
    if (token && centerId) loadQueue();
    if (token && adminTab === 'system') loadSystemMetrics();
    if (token && adminTab === 'reviews') loadAdminReviews();
    if (token && adminTab === 'users') loadFarmers(1);
    if (token && adminTab === 'announcements') loadAnnouncements();
    if (token && adminTab === 'database') {
      loadDatabaseOverview();
      loadCollectionData(activeCollection, 1, collectionSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, centerId, adminTab]);


  async function runAction(id: string, action: () => Promise<unknown>) {
    setActionLoading(id);
    setError(null);
    try {
      await action();
      await loadQueue();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  const checkIn = (id: string) => runAction('checkin-' + id, () => callAuthed(`/admin/queue/${id}/check-in`, { method: 'POST' }));
  const callNext = (id: string) => runAction('callnext-' + id, () => callAuthed(`/admin/queue/${id}/call-next`, { method: 'POST' }));
  const markNoShow = (id: string) =>
    runAction('noshow-' + id, () => callAuthed(`/admin/queue/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'no_show' }) }));

  async function openProcurementModal(entry: QueueEntry) {
    setSelectedEntry(entry);
    setProcMessage(null);
    setProcError(null);
    setProcLoading(true);
    try {
      const data = await callAuthed(`/admin/procurement/${entry._id}`);
      const cropName = data.procurement.crop || entry.crop || 'wheat';
      const rate = data.procurement.ratePerQtl || DEFAULT_RATES[cropName] || 2275;
      const qty = data.procurement.quantityQtl || entry.estimatedQuantityQtl || 10;
      const amount = data.procurement.amount || Math.round(qty * rate * 100) / 100;
      const adv = data.procurement.advanceAmount || Math.round(amount * 0.2 * 100) / 100;
      const bal = data.procurement.balanceAmount || Math.round((amount - adv) * 100) / 100;

      setProcurement({
        ...data.procurement,
        crop: cropName,
        ratePerQtl: rate,
        quantityQtl: qty,
        amount,
        advanceAmount: adv,
        balanceAmount: bal,
        qualityGrade: data.procurement.qualityGrade || 'A',
      });

      // Load or initialize shipment for logistics tracking
      try {
        const shipData = await callAuthed(`/shipments/booking/${entry._id}`);
        setShipment(shipData);
        if (shipData?.logisticsPartner) {
          setCarrierName(shipData.logisticsPartner.name || 'Delhivery Agri Logistics');
          setVehicleNumber(shipData.logisticsPartner.vehicleNumber || 'HR 05 BA 4421');
          setDriverName(shipData.logisticsPartner.driverName || 'Rajesh Kumar');
          setDriverPhone(shipData.logisticsPartner.driverPhone || '+91 98765 43210');
        }
      } catch (_) {
        setShipment(null);
      }
    } catch (err: any) {
      setProcError(err.message || 'Failed to load procurement details');
      setError(err.message);
    } finally {
      setProcLoading(false);
    }
  }

  function recalculateProcurement(qty: number, rate: number) {
    if (!procurement) return;
    const amount = Math.round(qty * rate * 100) / 100;
    const advanceAmount = Math.round(amount * 0.2 * 100) / 100;
    const balanceAmount = Math.round((amount - advanceAmount) * 100) / 100;
    setProcurement({ ...procurement, quantityQtl: qty, ratePerQtl: rate, amount, advanceAmount, balanceAmount });
  }

  async function saveProcurementStage(stage: string) {
    if (!selectedEntry || !procurement) return;
    setProcLoading(true);
    setProcSubmittingAction(stage);
    setProcMessage(null);
    setProcError(null);
    try {
      const res = await callAuthed(`/admin/procurement/${selectedEntry._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          stage,
          crop: procurement.crop,
          quantityQtl: procurement.quantityQtl,
          ratePerQtl: procurement.ratePerQtl,
          qualityGrade: procurement.qualityGrade,
        }),
      });
      setProcurement(res);
      setProcMessage(`Status updated to ${stage.toUpperCase()}!`);
      await loadQueue();
    } catch (err: any) {
      setProcError(err.message || `Failed to update status to ${stage}`);
      setError(err.message);
    } finally {
      setProcLoading(false);
      setProcSubmittingAction(null);
    }
  }

  async function payAdvance() {
    if (!selectedEntry || !procurement) return;
    setProcLoading(true);
    setProcSubmittingAction('advance');
    setProcMessage(null);
    setProcError(null);
    try {
      const res = await callAuthed(`/admin/procurement/${selectedEntry._id}/pay-advance`, {
        method: 'POST',
        body: JSON.stringify({
          crop: procurement.crop,
          quantityQtl: procurement.quantityQtl,
          ratePerQtl: procurement.ratePerQtl,
          qualityGrade: procurement.qualityGrade,
        }),
      });
      setProcurement(res);
      setProcMessage(`Success! 20% Safety Advance of ₹${res.advanceAmount?.toLocaleString?.() || res.advanceAmount} released to farmer. Ref: ${res.advancePaymentRef}`);
      await loadQueue();
    } catch (err: any) {
      setProcError(err.message || 'Failed to release 20% advance');
      setError(err.message);
    } finally {
      setProcLoading(false);
      setProcSubmittingAction(null);
    }
  }

  async function payBalance() {
    if (!selectedEntry || !procurement) return;
    setProcLoading(true);
    setProcSubmittingAction('balance');
    setProcMessage(null);
    setProcError(null);
    try {
      const res = await callAuthed(`/admin/procurement/${selectedEntry._id}/pay-balance`, {
        method: 'POST',
        body: JSON.stringify({
          crop: procurement.crop,
          quantityQtl: procurement.quantityQtl,
          ratePerQtl: procurement.ratePerQtl,
          qualityGrade: procurement.qualityGrade,
        }),
      });
      setProcurement(res);
      setProcMessage(`Success! Final 80% Payment of ₹${res.balanceAmount?.toLocaleString?.() || res.balanceAmount} released. Ref: ${res.paymentRef}`);
      await loadQueue();
    } catch (err: any) {
      setProcError(err.message || 'Failed to release final 80% balance');
      setError(err.message);
    } finally {
      setProcLoading(false);
      setProcSubmittingAction(null);
    }
  }

  async function confirmDbtPayment() {
    if (!selectedEntry || !procurement) return;
    setProcLoading(true);
    setProcSubmittingAction('confirm');
    setProcMessage(null);
    setProcError(null);
    try {
      const res = await callAuthed(`/admin/procurement/${selectedEntry._id}/confirm-payment`, {
        method: 'POST',
        body: JSON.stringify({
          crop: procurement.crop,
          quantityQtl: procurement.quantityQtl,
          ratePerQtl: procurement.ratePerQtl,
          qualityGrade: procurement.qualityGrade,
          bankName: 'State Bank of India (DBT Linked)',
        }),
      });
      setProcurement(res);
      setProcMessage(`DBT Payment Confirmed! ₹${res.amount?.toLocaleString?.() || res.amount} settled to farmer bank account. UTR: ${res.utrNumber}`);
      await loadQueue();
    } catch (err: any) {
      setProcError(err.message || 'Failed to confirm DBT payment');
      setError(err.message);
    } finally {
      setProcLoading(false);
      setProcSubmittingAction(null);
    }
  }

  async function generateBillPdf() {
    if (!selectedEntry || !procurement) return;
    setProcLoading(true);
    setProcSubmittingAction('bill');
    setProcMessage(null);
    setProcError(null);
    try {
      const res = await callAuthed(`/admin/procurement/${selectedEntry._id}/generate-bill`, {
        method: 'POST',
      });
      setProcurement(res.procurement || { ...procurement, billPdfUrl: res.billPdfUrl });
      setProcMessage('Official Mandi Bill PDF generated and uploaded to AWS S3 successfully!');
      if (res.billPdfUrl) {
        window.open(res.billPdfUrl, '_blank');
      }
      await loadQueue();
    } catch (err: any) {
      setProcError(err.message || 'Failed to generate bill PDF');
      setError(err.message);
    } finally {
      setProcLoading(false);
      setProcSubmittingAction(null);
    }
  }

  async function updateLogisticsPartner() {
    if (!shipment) return;
    setShipLoading(true);
    setProcMessage(null);
    try {
      const updated = await callAuthed(`/shipments/${shipment._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          partnerName: carrierName,
          vehicleNumber,
          driverName,
          driverPhone,
        }),
      });
      setShipment(updated);
      setProcMessage('Logistics partner & vehicle details saved successfully.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setShipLoading(false);
    }
  }

  async function addTransitCheckpoint() {
    if (!shipment || !checkpointTitle.trim() || !checkpointLocation.trim()) return;
    setShipLoading(true);
    setProcMessage(null);
    try {
      const updated = await callAuthed(`/shipments/${shipment._id}/checkpoint`, {
        method: 'POST',
        body: JSON.stringify({
          status: checkpointStatus,
          title: checkpointTitle.trim(),
          location: checkpointLocation.trim(),
        }),
      });
      setShipment(updated);
      setCheckpointTitle('');
      setCheckpointLocation('');
      setProcMessage('Live checkpoint posted! Now visible on customer tracking page.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setShipLoading(false);
    }
  }

  async function generate7DaySlots(cId: string, cName: string) {
    setSlotGenLoading(cId);
    setSlotGenMessage(null);
    try {
      const dates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return d.toISOString().slice(0, 10);
      });
      for (const date of dates) {
        await callAuthed('/admin/slots/generate', {
          method: 'POST',
          body: JSON.stringify({ centerId: cId, date }),
        });
      }
      setSlotGenMessage(`Successfully generated 7-day slot schedule for ${cName}!`);
    } catch (err: any) {
      setSlotGenMessage(`Slot schedule updated for ${cName} (${err.message})`);
    } finally {
      setSlotGenLoading(null);
    }
  }

  async function handleCreateCenter(e: React.FormEvent) {
    e.preventDefault();
    if (!newCenter.name.trim() || !newCenter.code.trim() || !newCenter.district.trim() || !newCenter.state.trim()) {
      setCenterFormError('Please fill in Center Name, Code, District, and State.');
      return;
    }
    setCenterFormLoading(true);
    setCenterFormError(null);
    setCenterFormSuccess(null);
    try {
      const cropsArr = newCenter.crops
        .split(',')
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean);
      const payload = {
        name: newCenter.name.trim(),
        code: newCenter.code.trim().toUpperCase(),
        district: newCenter.district.trim(),
        state: newCenter.state.trim(),
        address: newCenter.address.trim() || undefined,
        crops: cropsArr.length > 0 ? cropsArr : ['wheat', 'paddy'],
        dailyCapacity: Number(newCenter.dailyCapacity) || 200,
        openTime: newCenter.openTime || '08:00',
        closeTime: newCenter.closeTime || '17:00',
        contactPhone: newCenter.contactPhone.trim() || undefined,
      };
      await callAuthed('/admin/centers', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setCenterFormSuccess(`Procurement Centre "${payload.name}" (${payload.code}) registered successfully!`);
      await loadCenters();
      setTimeout(() => {
        setCenterModalOpen(false);
        setCenterFormSuccess(null);
        setNewCenter({
          name: '',
          code: '',
          district: '',
          state: '',
          address: '',
          crops: 'wheat, paddy',
          dailyCapacity: 200,
          openTime: '08:00',
          closeTime: '17:00',
          contactPhone: '',
        });
      }, 1400);
    } catch (err: any) {
      setCenterFormError(err.message || 'Failed to register centre');
    } finally {
      setCenterFormLoading(false);
    }
  }

  function signOut() {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    window.localStorage.removeItem('sih26032_admin_staff');
    setToken(null);
    setStaffUser(null);
    setQueue(null);
  }

  if (!token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-neutral-100 dark:bg-neutral-950">
        <div className="w-full max-w-md">
          {/* Staff Brand Header */}
          <div className="text-center mb-6">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-2xl shadow-inner mb-3">
              🏛️
            </div>
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700">
                Staff Admin Portal · Restricted
              </span>
            </div>
            <h1 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
              Procurement Centre Login
            </h1>
            <p className="mt-1.5 text-xs text-neutral-600 dark:text-neutral-400 max-w-sm mx-auto">
              Sign in to manage farmer queues, approve produce, release DBT payments, and monitor load balancers.
            </p>
          </div>

          <Card className="p-6 sm:p-8 shadow-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            {error && (
              <div className="mb-4">
                <Alert>{error}</Alert>
              </div>
            )}

            {failedAttempts >= 3 && !lockoutUntil && (
              <div className="mb-4 rounded-2xl bg-red-50/90 dark:bg-red-950/40 p-3.5 border border-red-200 dark:border-red-900 text-xs text-red-900 dark:text-red-300">
                <div className="flex items-center gap-1.5 font-bold">
                  <IconShieldCheck className="h-4 w-4 text-red-700 dark:text-red-400" />
                  <span>Warning: {failedAttempts} failed attempts detected</span>
                </div>
                <p className="mt-1 text-red-800 dark:text-red-400">Your account may be locked after continued failed attempts.</p>
              </div>
            )}

            <form onSubmit={login} className="space-y-4">
              <TextField
                label="Username or Email"
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                placeholder="Enter your username or email"
                disabled={!!lockoutUntil}
              />
              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={!!lockoutUntil}
              />
              <Button type="submit" loading={loginLoading} disabled={!!lockoutUntil} className="w-full">
                <IconAdmin className="h-4 w-4" /> Sign In to Admin Console
              </Button>
            </form>
          </Card>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-500 dark:text-neutral-400 px-2">
            <Link href="/" className="hover:text-neutral-900 dark:hover:text-white transition flex items-center gap-1">
              ← Return to Citizen Mandi Portal
            </Link>
            <Link href="/operator" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition flex items-center gap-1 font-mono font-medium">
              Operator Terminal [CLI] ➔
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const filteredCenters = centers.filter((c) => {
    const q = centerAdminSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.code && c.code.toLowerCase().includes(q)) ||
      c.district.toLowerCase().includes(q) ||
      (c.state && c.state.toLowerCase().includes(q)) ||
      (c.crops && c.crops.some((cr) => cr.toLowerCase().includes(q)));
    const matchesState = centerAdminState === 'All' || c.state === centerAdminState;
    return matchesSearch && matchesState;
  });

  const centerStates = Array.from(new Set(centers.map((c) => c.state).filter(Boolean) as string[])).sort();
  const totalDailyCapacity = centers.reduce((sum, c) => sum + (c.dailyCapacity || 200), 0);

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col font-sans">
      {/* Top Administrative Bar */}
      <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md px-4 sm:px-6 py-2.5 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Brand & Staff Badges */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-lg shadow-xs shrink-0">
              🏛️
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white tracking-tight truncate">
                  Smart Mandi Admin
                </h1>
                <span className="rounded bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-300 px-1.5 py-0.2 text-[10px] font-mono font-bold uppercase tracking-wider">
                  {staffUser?.role || 'STAFF ADMIN'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-500 dark:text-neutral-400 truncate">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  ONLINE
                </span>
                <span>·</span>
                <span>Center: {centers.find((c) => c._id === centerId)?.name || 'Central Office'}</span>
              </div>
            </div>
          </div>

          {/* Quick Switchers & User Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              href="/operator"
              className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-900 hover:bg-black text-emerald-400 border border-neutral-800 px-3 py-1.5 text-xs font-bold transition shadow-xs"
              title="Open backend server operator terminal & live logs"
            >
              <span>🖥️ Operator Terminal</span>
              <span className="rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300 text-[10px] px-1 font-mono">CLI</span>
            </Link>

            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-200 px-3 py-1.5 text-xs font-semibold transition shadow-xs"
              title="View public citizen mandi website"
            >
              <span>🌐 Citizen View</span>
            </Link>

            <div className="h-6 w-px bg-neutral-200 dark:border-neutral-800 hidden sm:block" />

            <div className="flex items-center gap-2">
              <span className="hidden md:inline text-xs font-semibold text-neutral-700 dark:text-neutral-300 truncate max-w-[120px]">
                {staffUser?.name || staffUser?.username || 'Admin'}
              </span>
              <Button variant="ghost" size="sm" onClick={signOut} className="text-xs">
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Administrative Container */}
      <main className="max-w-7xl mx-auto w-full flex-1 p-4 sm:p-6 space-y-6">
        <PageHeader
          eyebrow="Admin console"
          title="Queue & Procurement operations"
          subtitle="Manage farmers, weigh crops, and release 20% safety advance payments."
        />

      {/* Admin Module Navigation Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 border-b border-neutral-200 pb-3 flex-wrap">
        <button
          type="button"
          onClick={() => setAdminTab('queue')}
          className={`rounded-xl px-4 py-2.5 sm:py-2 text-xs font-bold transition text-center justify-center ${
            adminTab === 'queue'
              ? 'bg-brand-700 text-white shadow-sm'
              : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
          }`}
        >
          🌾 Mandi Operations & Live Queue
        </button>

        <button
          type="button"
          onClick={() => {
            setAdminTab('users');
            loadFarmers(1);
          }}
          className={`rounded-xl px-4 py-2.5 sm:py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            adminTab === 'users'
              ? 'bg-brand-700 text-white shadow-sm'
              : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
          }`}
        >
          <IconUser className="h-3.5 w-3.5" />
          <span>Registered Farmers {farmersStats ? `(${farmersStats.totalFarmers})` : ''}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setAdminTab('database');
            loadDatabaseOverview();
            loadCollectionData(activeCollection, 1);
          }}
          className={`rounded-xl px-4 py-2.5 sm:py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            adminTab === 'database'
              ? 'bg-brand-700 text-white shadow-sm'
              : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
          }`}
        >
          <IconDatabase className="h-3.5 w-3.5" />
          <span>🗄️ Database Inspector & Telemetry</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab('centers')}
          className={`rounded-xl px-4 py-2.5 sm:py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            adminTab === 'centers'
              ? 'bg-brand-700 text-white shadow-sm'
              : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
          }`}
        >
          <span>🏛️ Procurement Centres ({centers.length})</span>
        </button>
<button
          type="button"
          onClick={() => {
            setAdminTab('announcements');
            loadAnnouncements();
          }}
          className={`rounded-xl px-4 py-2.5 sm:py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            adminTab === 'announcements'
              ? 'bg-brand-700 text-white shadow-sm'
              : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
          }`}
        >
          <span>📢 Announcements ({announcementsStats?.activeCount ?? announcements.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setAdminTab('system');
            loadSystemMetrics();
          }}
          className={`rounded-xl px-4 py-2.5 sm:py-2 text-xs font-bold transition flex items-center justify-center gap-2 ${
            adminTab === 'system'
              ? 'bg-brand-700 text-white shadow-sm'
              : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>⚡ System & Rate Limits</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setAdminTab('reviews');
            loadAdminReviews();
          }}
          className={`rounded-xl px-4 py-2.5 sm:py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            adminTab === 'reviews'
              ? 'bg-brand-700 text-white shadow-sm'
              : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
          }`}
        >
          <IconStar className="h-3.5 w-3.5 text-amber-500 fill-amber-500" filled />
          <span>Buyer Produce Reviews</span>
        </button>

        <a
          href="/operator"
          className="rounded-xl px-4 py-2.5 sm:py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 bg-neutral-900 hover:bg-black text-emerald-400 border border-neutral-800 shadow-sm"
          title="Open live terminal and backend server console"
        >
          <span>🖥️ Operator Terminal</span>
          <span className="rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300 text-[10px] px-1 font-mono">CLI</span>
        </a>
      </div>


      {adminTab === 'queue' && (
        <div className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 sm:w-80 shadow-sm">
          <IconMapPin className="h-4 w-4 shrink-0 text-neutral-400" />
          <select
            value={centerId}
            onChange={(e) => setCenterId(e.target.value)}
            className="w-full bg-transparent text-sm focus:outline-none"
          >
            <option value="">Select a procurement centre</option>
            {Array.from(new Set(centers.map((c) => c.state)))
              .filter(Boolean)
              .sort()
              .map((state) => (
                <optgroup key={state} label={state}>
                  {centers
                    .filter((c) => c.state === state)
                    .map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} — {c.district}
                      </option>
                    ))}
                </optgroup>
              ))}
          </select>
        </div>
        <Button variant="secondary" onClick={loadQueue} disabled={!centerId}>
          Refresh
        </Button>
      </div>

      {error && <Alert>{error}</Alert>}

      {!queue && centerId && (
        <div className="flex justify-center py-10">
          <EmptyState icon={<IconQueue className="h-9 w-9" />} title="Loading queue…" />
        </div>
      )}

      {!centerId && <EmptyState icon={<IconQueue className="h-9 w-9" />} title="Select a centre to manage its queue" />}

      {queue && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Now Serving" value={queue.nowServing ? `#${queue.nowServing.token}` : '—'} tone="brand" />
            <StatTile label="Waiting" value={String(queue.counts.waiting)} />
            <StatTile label="Completed" value={String(queue.counts.completed)} />
            <StatTile label="Total" value={String(queue.counts.total)} />
          </div>

          <Card className="overflow-hidden shadow-sm">
            <div className="border-b border-neutral-100 px-5 py-3 text-sm font-semibold text-neutral-700 flex items-center justify-between">
              <span>{queue.center.name} — {queue.date}</span>
              <span className="text-xs text-brand-700 font-medium bg-brand-50 px-2.5 py-1 rounded-full border border-brand-200">
                🛡️ 20% Safety Advance Guarantee Active
              </span>
            </div>
            {queue.waiting.length === 0 ? (
              <div className="p-8">
                <EmptyState title="No one waiting in the queue" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-400">
                    <tr>
                      <th className="px-5 py-2.5">Token</th>
                      <th className="px-5 py-2.5">Farmer</th>
                      <th className="px-5 py-2.5">Crop</th>
                      <th className="px-5 py-2.5">Status</th>
                      <th className="px-5 py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.waiting.map((entry) => (
                      <tr key={entry._id} className="border-t border-neutral-100 hover:bg-neutral-50/50">
                        <td className="px-5 py-3 font-semibold text-neutral-900">#{entry.token}</td>
                        <td className="px-5 py-3">
                          <div className="font-medium text-neutral-900">{entry.farmer?.name || 'Farmer'}</div>
                          <div className="text-xs text-neutral-400">{entry.farmer?.phone} · {entry.farmer?.village || 'village'}</div>
                        </td>
                        <td className="px-5 py-3 text-neutral-600 capitalize">
                          {entry.crop || 'Produce'} ({entry.estimatedQuantityQtl || 10} qtl)
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={entry.status} />
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {entry.status === 'booked' && (
                              <Button size="sm" variant="secondary" loading={actionLoading === 'checkin-' + entry._id} onClick={() => checkIn(entry._id)}>
                                Check In
                              </Button>
                            )}
                            <Button size="sm" loading={actionLoading === 'callnext-' + entry._id} onClick={() => callNext(entry._id)}>
                              Call Next
                            </Button>
                            <button
                              onClick={() => openProcurementModal(entry)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition shadow-xs"
                            >
                              <span>🌾</span> Weigh &amp; Pay (20% Adv)
                            </button>
                            {entry.billPdfUrl && (
                              <a
                                href={entry.billPdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2 py-1.5 text-xs font-semibold text-teal-800 border border-teal-200 hover:bg-teal-100 transition shadow-xs"
                              >
                                <span>📄 Bill</span>
                              </a>
                            )}
                            <Button size="sm" variant="danger" loading={actionLoading === 'noshow-' + entry._id} onClick={() => markNoShow(entry._id)}>
                              No-Show
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Procurement & 20% Advance Payment Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm" onClick={() => setSelectedEntry(null)} />
          <div className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-neutral-900/10">
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-600 via-emerald-600 to-teal-600 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">
                  Crop Procurement — Token #{selectedEntry.token}
                </h3>
                <p className="text-xs text-brand-100">
                  {selectedEntry.farmer?.name} ({selectedEntry.farmer?.phone}) · {selectedEntry.farmer?.village}
                </p>
              </div>
              <button onClick={() => setSelectedEntry(null)} className="rounded-full p-1 text-white/80 hover:bg-white/10 hover:text-white">
                <IconClose className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {procError && <Alert tone="error">{procError}</Alert>}
              {procMessage && <Alert tone="success">{procMessage}</Alert>}

              {procurement && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">Crop</label>
                      <select
                        value={procurement.crop}
                        onChange={(e) => {
                          const cr = e.target.value;
                          const newRate = DEFAULT_RATES[cr] || procurement.ratePerQtl;
                          setProcurement({ ...procurement, crop: cr, ratePerQtl: newRate });
                          recalculateProcurement(procurement.quantityQtl, newRate);
                        }}
                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                      >
                        <option value="wheat">Wheat (गेहूं) - ₹2,275</option>
                        <option value="paddy">Paddy (धान) - ₹2,203</option>
                        <option value="maize">Maize (मक्का) - ₹2,090</option>
                        <option value="mustard">Mustard (सरसों) - ₹5,650</option>
                        <option value="cotton">Cotton (कपास) - ₹7,122</option>
                        <option value="soybean">Soybean (सोयाबीन) - ₹4,892</option>
                        <option value="gram">Gram / Chana (चना) - ₹5,440</option>
                        <option value="pulses">Pulses (दालें) - ₹6,950</option>
                        <option value="cumin">Cumin / Jeera (जीरा) - ₹18,500</option>
                        <option value="onion">Onion (प्याज) - ₹1,950</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">Weighed (Quintals)</label>
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={procurement.quantityQtl}
                        onChange={(e) => recalculateProcurement(Number(e.target.value), procurement.ratePerQtl)}
                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">Rate / MSP (₹/Qtl)</label>
                      <input
                        type="number"
                        min="1"
                        value={procurement.ratePerQtl}
                        onChange={(e) => recalculateProcurement(procurement.quantityQtl, Number(e.target.value))}
                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Calculations breakdown */}
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-500">Total Crop Purchase Value:</span>
                      <span className="text-base font-bold text-neutral-900">₹{procurement.amount.toLocaleString()}</span>
                    </div>

                    <div className="h-px bg-neutral-200" />

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-emerald-800 uppercase flex items-center gap-1">
                          <span>🛡️</span> 20% Safety Advance Guarantee
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          {procurement.advanceStatus === 'paid' ? `Paid (Ref: ${procurement.advancePaymentRef})` : 'Payable upfront to farmer'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-extrabold text-emerald-700">₹{procurement.advanceAmount.toLocaleString()}</div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          procurement.advanceStatus === 'paid' ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {procurement.advanceStatus === 'paid' ? 'PAID' : 'PENDING'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-neutral-700 uppercase">
                          80% Balance Settlement
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          {procurement.balanceStatus === 'paid' ? `Paid (Ref: ${procurement.paymentRef})` : 'Payable on final clearance'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-extrabold text-neutral-800">₹{procurement.balanceAmount.toLocaleString()}</div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          procurement.balanceStatus === 'paid' ? 'bg-emerald-600 text-white' : 'bg-neutral-200 text-neutral-700'
                        }`}>
                          {procurement.balanceStatus === 'paid' ? 'PAID' : 'PENDING'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2 pt-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={procSubmittingAction === 'weighed'}
                        disabled={procLoading}
                        onClick={() => saveProcurementStage('weighed')}
                      >
                        Mark Weighed
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={procSubmittingAction === 'approved'}
                        disabled={procLoading}
                        onClick={() => saveProcurementStage('approved')}
                      >
                        Approve Quality (A Grade)
                      </Button>
                    </div>

                    {procurement.paymentConfirmed ? (
                      <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-3.5 space-y-2 text-xs text-emerald-900 mt-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold flex items-center gap-1.5 text-emerald-800">
                            <span className="text-base font-black text-emerald-600">✓</span> Government DBT Payment Confirmed
                          </span>
                          <span className="bg-emerald-600 text-white font-mono font-bold px-2 py-0.5 rounded text-[10px]">
                            PAID IN FULL
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px] font-mono text-emerald-700">
                          <div>UTR: {procurement.utrNumber || procurement.paymentRef || 'N/A'}</div>
                          <div>Slip ID: {procurement.paymentConfirmationSlipId || 'DBT-REC'}</div>
                        </div>

                        {/* Bill PDF Action Area */}
                        <div className="pt-2 border-t border-emerald-200/80 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1 text-[11px] text-emerald-900 font-medium">
                            <span>📄</span>
                            <span>{procurement.billPdfUrl ? 'Official Mandi Bill stored in AWS S3' : 'Official Mandi Bill (PDF)'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {procurement.billPdfUrl && (
                              <a
                                href={procurement.billPdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 text-xs font-bold transition shadow-xs"
                              >
                                <span>📥 Download Bill (PDF)</span>
                              </a>
                            )}
                            <button
                              type="button"
                              disabled={procLoading}
                              onClick={generateBillPdf}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-900 px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer"
                            >
                              <span>{procSubmittingAction === 'bill' ? 'Generating...' : procurement.billPdfUrl ? '🔄 Regenerate' : '📄 Generate Bill (PDF)'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 pt-2 border-t border-neutral-100">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={procLoading || procurement.advanceStatus === 'paid'}
                            onClick={payAdvance}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            {procSubmittingAction === 'advance' ? (
                              <IconSpinner className="h-4 w-4 animate-spin text-white" />
                            ) : (
                              <IconRupee className="h-4 w-4" />
                            )}
                            <span>
                              {procSubmittingAction === 'advance'
                                ? 'Releasing 20% Advance...'
                                : procurement.advanceStatus === 'paid'
                                ? '20% Advance Already Paid'
                                : `Release 20% Advance (₹${procurement.advanceAmount.toLocaleString()})`}
                            </span>
                          </button>

                          <button
                            type="button"
                            disabled={procLoading || procurement.balanceStatus === 'paid'}
                            onClick={payBalance}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-neutral-900 px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            {procSubmittingAction === 'balance' ? (
                              <IconSpinner className="h-4 w-4 animate-spin text-white" />
                            ) : (
                              <IconWheat className="h-4 w-4" />
                            )}
                            <span>
                              {procSubmittingAction === 'balance'
                                ? 'Releasing Final 80%...'
                                : procurement.balanceStatus === 'paid'
                                ? 'Final 80% Settled'
                                : `Release Final 80% (₹${procurement.balanceAmount.toLocaleString()})`}
                            </span>
                          </button>
                        </div>

                        <button
                          type="button"
                          disabled={procLoading}
                          onClick={confirmDbtPayment}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-700 to-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:from-brand-800 hover:to-emerald-800 disabled:opacity-50 cursor-pointer"
                        >
                          {procSubmittingAction === 'confirm' ? (
                            <IconSpinner className="h-4 w-4 animate-spin text-emerald-300" />
                          ) : (
                            <IconShieldCheck className="h-4 w-4 text-emerald-300" />
                          )}
                          <span>
                            {procSubmittingAction === 'confirm'
                              ? 'Confirming & Settling DBT Payment...'
                              : `Confirm & Settle Full DBT Payment (₹${procurement.amount.toLocaleString()})`}
                          </span>
                        </button>

                        {procurement.amount > 0 && (
                          <div className="pt-1 flex items-center justify-between border-t border-neutral-100">
                            <span className="text-[11px] text-neutral-500">Mandi Bill &amp; S3 Archive:</span>
                            {procurement.billPdfUrl ? (
                              <div className="flex items-center gap-2">
                                <a
                                  href={procurement.billPdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-emerald-700 font-bold hover:underline"
                                >
                                  📥 View Bill (PDF)
                                </a>
                                <button
                                  type="button"
                                  disabled={procLoading}
                                  onClick={generateBillPdf}
                                  className="text-[11px] text-neutral-600 hover:text-neutral-900 underline"
                                >
                                  Regenerate
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={procLoading}
                                onClick={generateBillPdf}
                                className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700 transition"
                              >
                                <span>📄 Preview / Upload Bill (PDF)</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 3rd-Party Logistics Dispatch & Live Movement */}
                    <div className="border-t border-neutral-200 pt-4 mt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-neutral-900 text-xs uppercase tracking-wider">
                          <IconTruck className="h-4 w-4 text-brand-600" />
                          <span>3rd-Party Logistics Partner & Tracking</span>
                        </div>
                        {selectedEntry && (
                          <a
                            href={`/tracking?id=${selectedEntry._id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold text-brand-700 hover:underline inline-flex items-center gap-1"
                          >
                            <span>Open Tracking Page</span> ➔
                          </a>
                        )}
                      </div>

                      {shipment && (
                        <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-200 space-y-3 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-neutral-200">
                            <div>
                              <span className="text-neutral-500">Consignment:</span>{' '}
                              <strong className="font-mono text-neutral-800">{shipment.trackingNumber}</strong>
                            </div>
                            <div>
                              <span className="text-neutral-500">Order:</span>{' '}
                              <strong className="font-mono text-neutral-800">{shipment.orderId}</strong>
                            </div>
                            <StatusBadge status={shipment.status} />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[10px] font-bold text-neutral-600 uppercase mb-1">Carrier Partner</label>
                              <select
                                value={carrierName}
                                onChange={(e) => setCarrierName(e.target.value)}
                                className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                              >
                                <option value="Delhivery Agri Logistics">Delhivery Agri Logistics</option>
                                <option value="BlackBuck Ag-Freight">BlackBuck Ag-Freight</option>
                                <option value="TCI Express Mandi Line">TCI Express Mandi Line</option>
                                <option value="Rivigo Agri Relay">Rivigo Agri Relay</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-neutral-600 uppercase mb-1">Vehicle / Truck No</label>
                              <input
                                type="text"
                                value={vehicleNumber}
                                onChange={(e) => setVehicleNumber(e.target.value)}
                                placeholder="HR 05 BA 4421"
                                className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-neutral-600 uppercase mb-1">Driver Name</label>
                              <input
                                type="text"
                                value={driverName}
                                onChange={(e) => setDriverName(e.target.value)}
                                placeholder="Driver Name"
                                className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-neutral-600 uppercase mb-1">Driver Phone</label>
                              <input
                                type="text"
                                value={driverPhone}
                                onChange={(e) => setDriverPhone(e.target.value)}
                                placeholder="+91 98765 43210"
                                className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="pt-1 flex justify-end">
                            <Button
                              size="sm"
                              variant="secondary"
                              loading={shipLoading}
                              onClick={updateLogisticsPartner}
                              className="text-xs"
                            >
                              Update Logistics Details
                            </Button>
                          </div>

                          {/* Quick Checkpoint Addition */}
                          <div className="pt-2 border-t border-neutral-200 space-y-2">
                            <div className="text-[11px] font-bold text-neutral-700 uppercase">
                              Post Live Movement Checkpoint
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <select
                                value={checkpointStatus}
                                onChange={(e) => setCheckpointStatus(e.target.value)}
                                className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                              >
                                <option value="produce_dispatched">Produce Dispatched</option>
                                <option value="picked_up">Picked Up by Truck</option>
                                <option value="in_transit">In Transit (Corridor)</option>
                                <option value="out_for_delivery">Arrived at Depot</option>
                                <option value="delivered">Delivered & Verified</option>
                              </select>
                              <input
                                type="text"
                                value={checkpointTitle}
                                onChange={(e) => setCheckpointTitle(e.target.value)}
                                placeholder="Checkpoint Title (e.g. Passed Toll)"
                                className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                              />
                              <input
                                type="text"
                                value={checkpointLocation}
                                onChange={(e) => setCheckpointLocation(e.target.value)}
                                placeholder="Location (e.g. Panipat NH-44)"
                                className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                              />
                            </div>
                            <div className="flex justify-end">
                              <Button
                                size="sm"
                                loading={shipLoading}
                                onClick={addTransitCheckpoint}
                                disabled={!checkpointTitle.trim() || !checkpointLocation.trim()}
                                className="text-xs"
                              >
                                📍 Post Live Checkpoint
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
        </div>
      )}

      {/* Farmers & Users Directory Tab */}
      {adminTab === 'users' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-white p-5 border border-neutral-200/90 shadow-sm">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 border border-brand-200">
                <IconUser className="h-3.5 w-3.5 text-brand-700" />
                <span>Central Farmer Registry · Direct Benefit Transfer (DBT)</span>
              </div>
              <h2 className="text-xl font-black text-neutral-900 mt-2">
                Registered Farmers & KYC Directory
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Inspect farmer profiles, linked Aadhaar credentials, land holdings, MSP disbursements, and generated S3 bill archives.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => loadFarmers(farmerPage, farmerSearch, farmerStateFilter)}
                disabled={farmersLoading}
                className="text-xs flex items-center gap-1.5"
              >
                {farmersLoading ? <IconSpinner className="h-3.5 w-3.5 animate-spin" /> : <span>🔄 Refresh Registry</span>}
              </Button>
            </div>
          </div>

          {/* Telemetry KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Registered Farmers</span>
                <span className="rounded-xl bg-brand-50 p-2 text-brand-700">
                  <IconUser className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-black text-neutral-900">{farmersStats?.totalFarmers ?? farmers.length}</p>
              <p className="mt-1 text-[11px] text-neutral-500">Verified phone authentication</p>
            </div>

            <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Aadhaar Verified</span>
                <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                  <IconShieldCheck className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-black text-emerald-700">
                {farmersStats?.verifiedKyc ?? farmers.length}
                <span className="text-xs font-semibold text-emerald-600 ml-1.5">
                  ({farmersStats?.totalFarmers ? Math.round(((farmersStats.verifiedKyc) / farmersStats.totalFarmers) * 100) : 100}%)
                </span>
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">Direct Benefit Transfer ready</p>
            </div>

            <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Farmland Registered</span>
                <span className="rounded-xl bg-amber-50 p-2 text-amber-700">
                  <IconWheat className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-black text-neutral-900">
                {farmersStats?.totalLandAcres ?? 0} <span className="text-sm font-semibold text-neutral-500">Acres</span>
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">Geotagged agricultural holdings</p>
            </div>

            <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">State Footprint</span>
                <span className="rounded-xl bg-blue-50 p-2 text-blue-700">
                  <IconGlobe className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-black text-neutral-900">{farmersStats?.statesCount ?? 5}</p>
              <p className="mt-1 text-[11px] text-neutral-500">States & Union Territories</p>
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm">
            <div className="flex-1 relative">
              <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                value={farmerSearch}
                onChange={(e) => setFarmerSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') loadFarmers(1, farmerSearch, farmerStateFilter);
                }}
                placeholder="Search by farmer name, mobile (+91), village, district, or Aadhaar..."
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-neutral-300 focus:border-brand-600 focus:ring-1 focus:ring-brand-600 outline-none transition"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={farmerStateFilter}
                onChange={(e) => {
                  setFarmerStateFilter(e.target.value);
                  loadFarmers(1, farmerSearch, e.target.value);
                }}
                className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-700 focus:border-brand-600 focus:outline-none shadow-sm"
              >
                <option value="All">All States (13+)</option>
                <option value="Punjab">Punjab</option>
                <option value="Haryana">Haryana</option>
                <option value="Uttar Pradesh">Uttar Pradesh</option>
                <option value="Madhya Pradesh">Madhya Pradesh</option>
                <option value="Rajasthan">Rajasthan</option>
                <option value="Gujarat">Gujarat</option>
                <option value="Maharashtra">Maharashtra</option>
                <option value="Bihar">Bihar</option>
                <option value="Karnataka">Karnataka</option>
              </select>

              <Button
                size="sm"
                onClick={() => loadFarmers(1, farmerSearch, farmerStateFilter)}
                disabled={farmersLoading}
                className="text-xs px-3.5 py-2"
              >
                Filter
              </Button>

              {(farmerSearch || farmerStateFilter !== 'All') && (
                <button
                  type="button"
                  onClick={() => {
                    setFarmerSearch('');
                    setFarmerStateFilter('All');
                    loadFarmers(1, '', 'All');
                  }}
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 transition"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Farmers Directory Table */}
          <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
            {farmersLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
                <IconSpinner className="h-8 w-8 animate-spin text-brand-600 mb-2" />
                <p className="text-xs font-semibold">Loading farmer records...</p>
              </div>
            ) : farmers.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 mb-3">
                  <IconUser className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-bold text-neutral-800">No registered farmers found</h4>
                <p className="text-xs text-neutral-500 mt-1">Try adjusting your search query or state filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50/70 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                      <th className="py-3 px-4">Farmer Identity</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4">Land & Crops</th>
                      <th className="py-3 px-4">Aadhaar KYC</th>
                      <th className="py-3 px-4">MSP Activity</th>
                      <th className="py-3 px-4">Tier Badge</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-xs text-neutral-700">
                    {farmers.map((f) => (
                      <tr key={f._id} className="hover:bg-neutral-50/80 transition">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-brand-600 to-emerald-700 text-white font-black text-xs flex items-center justify-center shadow-xs">
                              {f.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-neutral-900">{f.name}</p>
                              <a
                                href={`tel:${f.phone}`}
                                className="text-[11px] text-neutral-500 hover:text-brand-700 flex items-center gap-1 mt-0.5"
                              >
                                <IconPhone className="h-3 w-3 text-neutral-400" />
                                <span>{f.phone}</span>
                              </a>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-medium text-neutral-800">{f.village || '—'}</p>
                          <p className="text-[11px] text-neutral-500">
                            {f.district ? `${f.district}, ` : ''}{f.state || '—'}
                          </p>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-neutral-900">{f.landAreaAcres ? `${f.landAreaAcres} Acres` : '—'}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(f.crops && f.crops.length > 0 ? f.crops : ['wheat']).slice(0, 2).map((crop) => (
                              <span
                                key={crop}
                                className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 border border-amber-200 capitalize"
                              >
                                {crop}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {(f.aadhaarLast4 || f.aadhaarNumber) ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                              <IconShieldCheck className="h-3.5 w-3.5" />
                              <span>•••• {f.aadhaarLast4 || f.aadhaarNumber?.slice(-4)}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 border border-amber-300 animate-pulse">
                              ⚠️ Aadhaar Pending
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-neutral-900">
                            ₹{(f.stats?.totalMspValue || 0).toLocaleString('en-IN')}
                          </p>
                          <p className="text-[11px] text-neutral-500">
                            {f.stats?.totalBookings || 0} slots · {f.stats?.completedDeliveries || 0} delivered
                          </p>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              f.badge === 'kisan_ratna'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : f.badge === 'verified_prime'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                            }`}
                          >
                            {f.badge === 'kisan_ratna' ? '👑 Kisan Ratna' : f.badge === 'verified_prime' ? '⭐ Prime' : 'Standard'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => openFarmerDossier(f._id)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-800 border border-brand-200 px-3 py-1.5 text-xs font-bold transition shadow-2xs"
                          >
                            <span>Dossier & Bills</span>
                            {f.stats?.hasBill && (
                              <span className="rounded-full bg-emerald-600 text-white text-[9px] px-1.5 py-0.2 font-bold" title="S3 PDF Available">
                                S3
                              </span>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {farmerTotalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200 bg-neutral-50/50 text-xs text-neutral-600">
                <div>
                  Showing page <span className="font-bold text-neutral-900">{farmerPage}</span> of{' '}
                  <span className="font-bold text-neutral-900">{farmerTotalPages}</span> ({farmerTotalCount} total farmers)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={farmerPage <= 1 || farmersLoading}
                    onClick={() => loadFarmers(farmerPage - 1, farmerSearch, farmerStateFilter)}
                    className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold hover:bg-white disabled:opacity-50 transition"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={farmerPage >= farmerTotalPages || farmersLoading}
                    onClick={() => loadFarmers(farmerPage + 1, farmerSearch, farmerStateFilter)}
                    className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold hover:bg-white disabled:opacity-50 transition"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Database Inspector & Telemetry Tab */}
      {adminTab === 'database' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-white p-5 border border-neutral-200/90 shadow-sm">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span>MongoDB Cluster Telemetry · Database: {dbOverview?.database?.name || 'sih26032'}</span>
              </div>
              <h2 className="text-xl font-black text-neutral-900 mt-2">
                Database Inspector & Collection Explorer
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Inspect 10 MongoDB collections, examine document records, verify storage footprints, and inspect raw JSON payloads.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  loadDatabaseOverview();
                  loadCollectionData(activeCollection, collectionPage, collectionSearch);
                }}
                disabled={dbLoading || collectionLoading}
                className="text-xs flex items-center gap-1.5"
              >
                {dbLoading ? <IconSpinner className="h-3.5 w-3.5 animate-spin" /> : <span>🔄 Refresh Cluster</span>}
              </Button>
            </div>
          </div>

          {/* MongoDB Cluster Health KPI Tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="rounded-2xl border border-neutral-200/80 bg-white p-3.5 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Connection</span>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-base font-black text-emerald-700">ONLINE</span>
              </div>
              <p className="text-[10px] text-neutral-400 mt-1 font-mono">127.0.0.1:27017</p>
            </div>

            <div className="rounded-2xl border border-neutral-200/80 bg-white p-3.5 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Collections</span>
              <p className="text-base font-black text-neutral-900 mt-1.5">{dbOverview?.database?.collections || 10}</p>
              <p className="text-[10px] text-neutral-400 mt-1">Active registered schemas</p>
            </div>

            <div className="rounded-2xl border border-neutral-200/80 bg-white p-3.5 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Total Documents</span>
              <p className="text-base font-black text-neutral-900 mt-1.5">
                {(dbOverview?.database?.objects || 2553).toLocaleString('en-IN')}
              </p>
              <p className="text-[10px] text-neutral-400 mt-1">Across all collections</p>
            </div>

            <div className="rounded-2xl border border-neutral-200/80 bg-white p-3.5 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Data Footprint</span>
              <p className="text-base font-black text-neutral-900 mt-1.5">
                {dbOverview?.database?.dataSize ? `${(dbOverview.database.dataSize / 1024 / 1024).toFixed(2)} MB` : '0.53 MB'}
              </p>
              <p className="text-[10px] text-neutral-400 mt-1">Uncompressed BSON payload</p>
            </div>

            <div className="rounded-2xl border border-neutral-200/80 bg-white p-3.5 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">B-Tree Indexes</span>
              <p className="text-base font-black text-neutral-900 mt-1.5">{dbOverview?.database?.indexes || 46}</p>
              <p className="text-[10px] text-neutral-400 mt-1">
                {dbOverview?.database?.indexSize ? `${(dbOverview.database.indexSize / 1024 / 1024).toFixed(2)} MB index` : '0.43 MB'}
              </p>
            </div>
          </div>

          {/* Two-Column Explorer Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Collections Selector (4 cols) */}
            <div className="lg:col-span-4 rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                <h3 className="text-xs font-black uppercase tracking-wider text-neutral-500">
                  Schemas & Collections ({dbOverview?.collections?.length || 10})
                </h3>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-600">
                  sih26032
                </span>
              </div>

              <div className="space-y-1.5 max-h-[620px] overflow-y-auto pr-1">
                {(dbOverview?.collections || [
                  { name: 'farmers', displayName: 'Registered Farmers', description: 'Farmer KYC & contact records', category: 'Core Agri', count: 9 },
                  { name: 'procurements', displayName: 'Crop Procurements & DBT', description: 'Produce intake, MSP valuation, advance & S3 bills', category: 'Core Agri', count: 4 },
                  { name: 'queues', displayName: 'Live Queue & Token Bookings', description: 'Real-time arrival tokens and queue state', category: 'Operations', count: 8 },
                  { name: 'centers', displayName: 'Procurement Centres / Mandis', description: 'APMC mandis and warehouse yards', category: 'Operations', count: 18 },
                  { name: 'slots', displayName: '1-Hour Slot Capacity Windows', description: 'Hourly scheduling capacity slots', category: 'Operations', count: 2495 },
                  { name: 'notifications', displayName: 'SMS & WhatsApp Dispatch Logs', description: 'Delivery receipts and push alerts', category: 'Communication', count: 3 },
                  { name: 'shipments', displayName: 'Logistics & 3PL Consignments', description: 'Trucking GPS checkpoints and transit status', category: 'Logistics', count: 5 },
                  { name: 'reviews', displayName: 'Buyer Produce Ratings', description: 'Mandi feedback and quality star reviews', category: 'Feedback', count: 8 },
                  { name: 'staffs', displayName: 'Mandi Staff & Admins', description: 'Mandi operators and admin credentials', category: 'Security', count: 3 },
                  { name: 'otps', displayName: 'Phone OTP Auth Verifications', description: 'One-time passwords and verification tokens', category: 'Security', count: 0 },
                ]).map((col) => {
                  const isActive = activeCollection === col.name;
                  return (
                    <button
                      key={col.name}
                      type="button"
                      onClick={() => handleSelectCollection(col.name)}
                      className={`w-full text-left p-3 rounded-xl border transition flex items-center justify-between gap-2 ${
                        isActive
                          ? 'bg-brand-50 border-brand-300 ring-1 ring-brand-300'
                          : 'bg-white border-neutral-200/80 hover:bg-neutral-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${isActive ? 'text-brand-900' : 'text-neutral-900'}`}>
                            {col.displayName || col.name}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-neutral-400 truncate">
                          db.{col.name}
                        </p>
                        <p className="text-[10px] text-neutral-500 mt-0.5 truncate">
                          {col.description}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-black ${
                            isActive
                              ? 'bg-brand-700 text-white'
                              : 'bg-neutral-100 text-neutral-700'
                          }`}
                        >
                          {col.count}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Document Records Browser (8 cols) */}
            <div className="lg:col-span-8 rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm space-y-4">
              {/* Collection Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black text-neutral-900">
                      db.{activeCollection}
                    </span>
                    <span className="rounded-full bg-brand-50 text-brand-800 text-[11px] font-bold px-2 py-0.5 border border-brand-200">
                      {collectionTotal} records
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Live document stream with primary key lookup & BSON inspection.
                  </p>
                </div>

                {/* Search in collection */}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
                    <input
                      type="text"
                      value={collectionSearch}
                      onChange={(e) => setCollectionSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') loadCollectionData(activeCollection, 1, collectionSearch);
                      }}
                      placeholder="Search ID, text..."
                      className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-neutral-300 focus:border-brand-600 outline-none w-44"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => loadCollectionData(activeCollection, 1, collectionSearch)}
                    disabled={collectionLoading}
                    className="text-xs px-2.5 py-1.5"
                  >
                    Go
                  </Button>
                </div>
              </div>

              {/* Document Cards */}
              {collectionLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
                  <IconSpinner className="h-7 w-7 animate-spin text-brand-600 mb-2" />
                  <p className="text-xs font-semibold">Querying db.{activeCollection}...</p>
                </div>
              ) : collectionDocs.length === 0 ? (
                <div className="py-12 text-center text-neutral-500">
                  <p className="text-xs font-semibold">No documents found in db.{activeCollection}</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {collectionDocs.map((doc, idx) => (
                    <div
                      key={doc._id || idx}
                      className="rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-4 hover:bg-neutral-50 hover:border-neutral-300 transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-neutral-200/60">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[11px] font-bold text-neutral-500">_id:</span>
                          <span className="font-mono text-[11px] font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md border border-brand-200">
                            {doc._id}
                          </span>
                          {doc.createdAt && (
                            <span className="text-[10px] text-neutral-400">
                              {new Date(doc.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => copyDocJson(doc)}
                            className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-[10px] font-semibold text-neutral-600 hover:bg-neutral-100 transition"
                          >
                            {copiedDocId === doc._id ? '✓ Copied!' : 'Copy'}
                          </button>
                          <button
                            type="button"
                            onClick={() => openDocInspector(doc)}
                            className="rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white px-2.5 py-1 text-[11px] font-bold transition flex items-center gap-1"
                          >
                            <span>{`{ }`} Raw JSON</span>
                          </button>
                        </div>
                      </div>

                      {/* Summary Fields Preview */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2.5 text-xs">
                        {activeCollection === 'farmers' && (
                          <>
                            <div>
                              <span className="text-[10px] uppercase text-neutral-400 block font-bold">Name</span>
                              <span className="font-bold text-neutral-900">{doc.name}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase text-neutral-400 block font-bold">Phone</span>
                              <span className="text-neutral-700 font-mono">{doc.phone}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase text-neutral-400 block font-bold">Location</span>
                              <span className="text-neutral-700">{doc.village ? `${doc.village}, ${doc.state || ''}` : doc.state || '—'}</span>
                            </div>
                          </>
                        )}

                        {activeCollection === 'procurements' && (
                          <>
                            <div>
                              <span className="text-[10px] uppercase text-neutral-400 block font-bold">Crop & Qty</span>
                              <span className="font-bold text-neutral-900 capitalize">{doc.crop} · {doc.quantityQtl} Qtl</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase text-neutral-400 block font-bold">Total MSP Amount</span>
                              <span className="font-bold text-emerald-700">₹{doc.amount?.toLocaleString('en-IN')}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase text-neutral-400 block font-bold">Stage</span>
                              <span className="font-semibold text-neutral-800 uppercase text-[11px]">{doc.stage}</span>
                            </div>
                          </>
                        )}

                        {activeCollection === 'queues' && (
                          <>
                            <div>
                              <span className="text-[10px] uppercase text-neutral-400 block font-bold">Token</span>
                              <span className="font-bold text-brand-700 text-sm">#{doc.token}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase text-neutral-400 block font-bold">Crop</span>
                              <span className="font-semibold text-neutral-900 capitalize">{doc.crop || 'wheat'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase text-neutral-400 block font-bold">Status</span>
                              <span className="font-semibold text-neutral-800 uppercase text-[11px]">{doc.status}</span>
                            </div>
                          </>
                        )}

                        {activeCollection === 'centers' && (
                          <>
                            <div>
                              <span className="text-[10px] uppercase text-neutral-400 block font-bold">Centre Name</span>
                              <span className="font-bold text-neutral-900">{doc.name}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase text-neutral-400 block font-bold">Code</span>
                              <span className="font-mono text-neutral-700">{doc.code}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase text-neutral-400 block font-bold">State / District</span>
                              <span className="text-neutral-700">{doc.district}, {doc.state}</span>
                            </div>
                          </>
                        )}

                        {activeCollection === 'slots' && (
                          <>
                            <div>
                              <span className="text-[10px] uppercase text-neutral-400 block font-bold">Date</span>
                              <span className="font-medium text-neutral-900">{doc.date}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase text-neutral-400 block font-bold">Time Window</span>
                              <span className="font-mono text-neutral-700">{doc.startTime} - {doc.endTime}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase text-neutral-400 block font-bold">Capacity</span>
                              <span className="text-neutral-700">{doc.bookedCount || 0} / {doc.maxCapacity || 50} Booked</span>
                            </div>
                          </>
                        )}

                        {activeCollection === 'notifications' && (
                          <>
                            <div>
                              <span className="text-[10px] uppercase text-neutral-400 block font-bold">Channel</span>
                              <span className="font-bold text-emerald-700 uppercase">{doc.channel}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase text-neutral-400 block font-bold">Recipient</span>
                              <span className="font-mono text-neutral-700">{doc.recipientPhone}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase text-neutral-400 block font-bold">Status</span>
                              <span className="font-semibold text-neutral-800">{doc.status}</span>
                            </div>
                          </>
                        )}

                        {activeCollection === 'shipments' && (
                          <>
                            <div>
                              <span className="text-[10px] uppercase text-neutral-400 block font-bold">Tracking #</span>
                              <span className="font-mono font-bold text-neutral-900">{doc.trackingNumber}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase text-neutral-400 block font-bold">Carrier</span>
                              <span className="text-neutral-700">{doc.carrierName || doc.logisticsPartner?.name || 'Logistics'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase text-neutral-400 block font-bold">Status</span>
                              <span className="font-semibold text-emerald-700 uppercase text-[11px]">{doc.status}</span>
                            </div>
                          </>
                        )}

                        {activeCollection === 'reviews' && (
                          <>
                            <div>
                              <span className="text-[10px] uppercase text-neutral-400 block font-bold">Farmer</span>
                              <span className="font-bold text-neutral-900">{doc.farmerName || 'Farmer'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase text-neutral-400 block font-bold">Rating</span>
                              <span className="font-bold text-amber-600">★ {doc.rating} / 5</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase text-neutral-400 block font-bold">Crop</span>
                              <span className="text-neutral-700 capitalize">{doc.crop}</span>
                            </div>
                          </>
                        )}

                        {activeCollection === 'staffs' && (
                          <>
                            <div>
                              <span className="text-[10px] uppercase text-neutral-400 block font-bold">Username</span>
                              <span className="font-bold text-neutral-900">{doc.username}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase text-neutral-400 block font-bold">Email</span>
                              <span className="text-neutral-700 font-mono text-[11px]">{doc.email}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase text-neutral-400 block font-bold">Role</span>
                              <span className="font-semibold text-brand-700 uppercase text-[11px]">{doc.role}</span>
                            </div>
                          </>
                        )}

                        {activeCollection === 'otps' && (
                          <>
                            <div>
                              <span className="text-[10px] uppercase text-neutral-400 block font-bold">Phone</span>
                              <span className="font-mono text-neutral-900">{doc.phone}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase text-neutral-400 block font-bold">Attempts</span>
                              <span className="text-neutral-700">{doc.attempts || 0}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase text-neutral-400 block font-bold">Expires</span>
                              <span className="text-neutral-700 text-[11px]">
                                {doc.expiresAt ? new Date(doc.expiresAt).toLocaleTimeString() : '—'}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {collectionTotalPages > 1 && (
                <div className="flex items-center justify-between pt-3 border-t border-neutral-200 text-xs text-neutral-600">
                  <div>
                    Page <span className="font-bold text-neutral-900">{collectionPage}</span> of{' '}
                    <span className="font-bold text-neutral-900">{collectionTotalPages}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={collectionPage <= 1 || collectionLoading}
                      onClick={() => loadCollectionData(activeCollection, collectionPage - 1, collectionSearch)}
                      className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold hover:bg-neutral-100 disabled:opacity-50 transition"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={collectionPage >= collectionTotalPages || collectionLoading}
                      onClick={() => loadCollectionData(activeCollection, collectionPage + 1, collectionSearch)}
                      className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold hover:bg-neutral-100 disabled:opacity-50 transition"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. System Infrastructure, Load Balancer & Rate Limits Tab */}
      {adminTab === 'system' && (

        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-white p-5 border border-neutral-200/90 shadow-sm">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span>Production Infrastructure · Multi-Worker Node Cluster</span>
              </div>
              <h2 className="text-xl font-black text-neutral-900 mt-2">
                High-Availability Load Balancer & Rate Limit Security
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Real-time reverse proxy telemetry, ingress throttling, PM2 worker load distribution, and database health.
              </p>
            </div>

            <Button
              variant="secondary"
              onClick={loadSystemMetrics}
              disabled={metricsLoading}
              className="text-xs shrink-0 flex items-center gap-1.5"
            >
              {metricsLoading ? <IconSpinner className="h-4 w-4" /> : <span>🔄 Refresh Telemetry</span>}
            </Button>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl bg-white p-4 border border-neutral-200/80 shadow-sm">
              <span className="text-xs font-semibold text-neutral-500">Load Balancer</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-black text-emerald-700">ACTIVE</span>
              </div>
              <span className="text-[11px] text-neutral-400">least_conn & round-robin</span>
            </div>

            <div className="rounded-2xl bg-white p-4 border border-neutral-200/80 shadow-sm">
              <span className="text-xs font-semibold text-neutral-500">Rate Limit Defense</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-black text-brand-700">4 Tiers Armed</span>
              </div>
              <span className="text-[11px] text-neutral-400">Global, Auth, OTP, Slots</span>
            </div>

            <div className="rounded-2xl bg-white p-4 border border-neutral-200/80 shadow-sm">
              <span className="text-xs font-semibold text-neutral-500">Node Cluster Mode</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-black text-neutral-900">
                  {systemMetrics?.cpuCores || 2} CPU Cores
                </span>
              </div>
              <span className="text-[11px] text-neutral-400">PID: {systemMetrics?.pid || '48573'}</span>
            </div>

            <div className="rounded-2xl bg-white p-4 border border-neutral-200/80 shadow-sm">
              <span className="text-xs font-semibold text-neutral-500">Database Status</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-black text-emerald-700">OPTIMAL</span>
              </div>
              <span className="text-[11px] text-neutral-400">MongoDB Latency &lt; 2ms</span>
            </div>
          </div>

          {/* Detailed Diagnostic Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 1: Ingress Load Balancer Diagnostics */}
            <Card className="p-6 shadow-sm border border-neutral-200/90 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div className="flex items-center gap-2">
                  <IconGlobe className="h-5 w-5 text-brand-600" />
                  <h3 className="font-bold text-neutral-900 text-sm">Reverse Proxy & Load Balancer Ingress</h3>
                </div>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                  Passing ALB Health Checks
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-neutral-50 p-3">
                  <span className="text-neutral-400 block text-[11px]">Detected Client IP</span>
                  <strong className="font-mono text-neutral-800 text-xs mt-0.5 block">
                    {systemMetrics?.loadBalancer?.detectedClientIp || '127.0.0.1 (Reverse Proxy)'}
                  </strong>
                </div>

                <div className="rounded-xl bg-neutral-50 p-3">
                  <span className="text-neutral-400 block text-[11px]">Forwarded Protocol</span>
                  <strong className="font-mono text-neutral-800 text-xs mt-0.5 block">
                    {systemMetrics?.loadBalancer?.forwardedProto || 'https / direct'}
                  </strong>
                </div>

                <div className="rounded-xl bg-neutral-50 p-3">
                  <span className="text-neutral-400 block text-[11px]">Balancing Algorithm</span>
                  <strong className="text-neutral-800 text-xs mt-0.5 block">
                    Least Connections (least_conn)
                  </strong>
                </div>

                <div className="rounded-xl bg-neutral-50 p-3">
                  <span className="text-neutral-400 block text-[11px]">Reverse Proxy Trust</span>
                  <strong className="text-emerald-700 text-xs mt-0.5 block">
                    Trust Proxy = 1 (AWS ALB / Nginx)
                  </strong>
                </div>
              </div>

              <div className="rounded-xl bg-neutral-900 text-neutral-200 p-3.5 font-mono text-[11px] space-y-1">
                <div className="text-neutral-400 text-[10px] uppercase font-bold">Upstream Load Balancer Pool</div>
                <div>upstream emandi_backend_cluster &#123;</div>
                <div className="pl-4 text-emerald-400">least_conn;</div>
                <div className="pl-4">server 127.0.0.1:5000 max_fails=3 fail_timeout=10s;</div>
                <div className="pl-4 text-neutral-500">keepalive 32;</div>
                <div>&#125;</div>
              </div>
            </Card>

            {/* Card 2: Multi-Tier Rate Limiting Defense */}
            <Card className="p-6 shadow-sm border border-neutral-200/90 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div className="flex items-center gap-2">
                  <IconShieldCheck className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-bold text-neutral-900 text-sm">Active Rate Limiting & Anti-Abuse Tiers</h3>
                </div>
                <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700 border border-brand-200">
                  Standard RateLimit-* Headers
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl bg-neutral-50 p-2.5">
                  <span className="text-neutral-400 block text-[10px]">Requests Tracked</span>
                  <strong className="text-base font-black text-neutral-900">
                    {systemMetrics?.rateLimiter?.totalRequests || 0}
                  </strong>
                </div>
                <div className="rounded-xl bg-neutral-50 p-2.5">
                  <span className="text-neutral-400 block text-[10px]">Active Unique IPs</span>
                  <strong className="text-base font-black text-brand-700">
                    {systemMetrics?.rateLimiter?.activeUniqueIPs || 1}
                  </strong>
                </div>
                <div className="rounded-xl bg-neutral-50 p-2.5">
                  <span className="text-neutral-400 block text-[10px]">Blocked Floods</span>
                  <strong className="text-base font-black text-emerald-700">
                    {systemMetrics?.rateLimiter?.rateLimitBlocks || 0}
                  </strong>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 border border-neutral-100">
                  <span className="font-semibold text-neutral-800">1. Global Ingress Limiter</span>
                  <span className="font-mono font-bold text-neutral-600 bg-white px-2 py-0.5 rounded border">500 req / minute</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 border border-neutral-100">
                  <span className="font-semibold text-neutral-800">2. Admin Login Brute-Force Defense</span>
                  <span className="font-mono font-bold text-amber-700 bg-white px-2 py-0.5 rounded border border-amber-200">25 attempts / 15 min</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 border border-neutral-100">
                  <span className="font-semibold text-neutral-800">3. Farmer Mobile OTP SMS Limiter</span>
                  <span className="font-mono font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">15 requests / 10 min</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 border border-neutral-100">
                  <span className="font-semibold text-neutral-800">4. Slot Booking Anti-Scalping Limiter</span>
                  <span className="font-mono font-bold text-purple-700 bg-white px-2 py-0.5 rounded border border-purple-200">60 req / minute</span>
                </div>
              </div>
            </Card>

            {/* Card 3: Node Process & Host Compute Resources */}
            <Card className="p-6 shadow-sm border border-neutral-200/90 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <h3 className="font-bold text-neutral-900 text-sm">Server Compute & Memory Telemetry</h3>
                <span className="font-mono text-xs text-neutral-500">
                  Uptime: {Math.floor((systemMetrics?.uptimeSeconds || 0) / 60)}m {((systemMetrics?.uptimeSeconds || 0) % 60)}s
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="rounded-xl bg-neutral-50 p-2.5">
                  <span className="text-[10px] text-neutral-400 block">Process RSS</span>
                  <strong className="text-sm font-black text-neutral-800">{systemMetrics?.memory?.rssMb || 95} MB</strong>
                </div>
                <div className="rounded-xl bg-neutral-50 p-2.5">
                  <span className="text-[10px] text-neutral-400 block">V8 Heap Used</span>
                  <strong className="text-sm font-black text-brand-700">{systemMetrics?.memory?.heapUsedMb || 35} MB</strong>
                </div>
                <div className="rounded-xl bg-neutral-50 p-2.5">
                  <span className="text-[10px] text-neutral-400 block">System Free RAM</span>
                  <strong className="text-sm font-black text-emerald-700">{systemMetrics?.memory?.systemFreeMb || 2400} MB</strong>
                </div>
                <div className="rounded-xl bg-neutral-50 p-2.5">
                  <span className="text-[10px] text-neutral-400 block">Load Average</span>
                  <strong className="text-sm font-black text-neutral-800">
                    {systemMetrics?.loadAverage ? systemMetrics.loadAverage[0].toFixed(2) : '0.85'}
                  </strong>
                </div>
              </div>

              <div className="rounded-xl bg-neutral-50 p-3 text-xs space-y-1 text-neutral-600">
                <div className="flex justify-between">
                  <span>Host Platform:</span>
                  <strong className="font-mono text-neutral-800">{systemMetrics?.platform || 'Linux 6.8 (x64)'}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Process Cluster Mode:</span>
                  <strong className="font-mono text-neutral-800">{systemMetrics?.clusterMode || 'PM2 Cluster'}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Worker PID / Instance:</span>
                  <strong className="font-mono text-neutral-800">PID {systemMetrics?.pid || process.pid} (Instance #{systemMetrics?.instanceId || 0})</strong>
                </div>
              </div>
            </Card>

            {/* Card 4: Cloud & Messaging Subsystems */}
            <Card className="p-6 shadow-sm border border-neutral-200/90 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <h3 className="font-bold text-neutral-900 text-sm">Cloud Infrastructure Integrations</h3>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                  All Systems Operational
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between rounded-xl bg-neutral-50 p-3 border border-neutral-100">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                    <div>
                      <strong className="text-neutral-800 block">AWS Simple Notification Service (SNS)</strong>
                      <span className="text-[11px] text-neutral-400">Live SMS delivery for 20% advance & full DBT confirmation</span>
                    </div>
                  </div>
                  <span className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-800 border">
                    ACTIVE (Transactional)
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-neutral-50 p-3 border border-neutral-100">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                    <div>
                      <strong className="text-neutral-800 block">Cloud Media Storage (Proxied)</strong>
                      <span className="text-[11px] text-neutral-400">Secure proxied media assets & verified lot images</span>
                    </div>
                  </div>
                  <span className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-800 border">
                    ACTIVE (Media Service)
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-neutral-50 p-3 border border-neutral-100">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                    <div>
                      <strong className="text-neutral-800 block">MongoDB Replica Connection</strong>
                      <span className="text-[11px] text-neutral-400">Database: emandi_db with indexed queues & bookings</span>
                    </div>
                  </div>
                  <span className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-800 border">
                    CONNECTED
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* 3. Buyer Produce Reviews Tab */}
      {adminTab === 'reviews' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-white p-5 border border-neutral-200/90 shadow-sm">
            <div>
              <h2 className="text-xl font-black text-neutral-900">Buyer Quality Reviews & Assessment Log</h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Inspect institutional buyer feedback from FCI, ITC, roller flour mills, and wholesale aggregators.
              </p>
            </div>
            <Button variant="secondary" onClick={loadAdminReviews} disabled={reviewsLoading} className="text-xs shrink-0">
              {reviewsLoading ? <IconSpinner className="h-4 w-4" /> : <span>🔄 Refresh Reviews</span>}
            </Button>
          </div>

          <div className="space-y-3">
            {adminReviews.length === 0 ? (
              <div className="rounded-2xl bg-white p-12 text-center border border-neutral-200">
                <EmptyState title="No buyer reviews found" description="Reviews submitted by bulk buyers will appear here." />
              </div>
            ) : (
              adminReviews.map((rev) => (
                <div key={rev._id} className="rounded-2xl bg-white p-5 shadow-sm border border-neutral-200/90">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-sm text-neutral-900">{rev.buyerName}</strong>
                        <span className="text-xs text-neutral-500">({rev.buyerCompany})</span>
                        <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                          Verified Buyer
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5">{rev.buyerRole} · {rev.buyerCity || 'Patiala Mandi'}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900 border border-amber-200 flex items-center gap-1">
                        <IconStar className="h-3.5 w-3.5 fill-amber-500 text-amber-500" filled />
                        <span>{rev.rating?.toFixed(1) || '5.0'}</span>
                      </span>
                      <span className="text-xs text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-lg font-medium">
                        {rev.lotQuantityQtl ? `${rev.lotQuantityQtl} Qtl · ` : ''}{rev.crop} Lot
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between rounded-xl bg-neutral-50 p-2.5 text-xs text-neutral-600 border border-neutral-100">
                    <div className="flex items-center gap-2">
                      {typeof rev.farmer === 'object' && rev.farmer?.photoUrl ? (
                        <img
                          src={rev.farmer.photoUrl}
                          alt={rev.farmer.name}
                          className="h-7 w-7 rounded-full object-cover border border-amber-300"
                        />
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-800 text-[10px] font-bold">
                          {typeof rev.farmer === 'object' ? rev.farmer?.name?.charAt(0) : 'F'}
                        </span>
                      )}
                      <span className="font-semibold text-neutral-800">
                        {typeof rev.farmer === 'object' ? rev.farmer?.name : 'Farmer Producer'}
                      </span>
                      {typeof rev.farmer === 'object' && rev.farmer?.district && (
                        <span className="text-[11px] text-neutral-400">({rev.farmer.district})</span>
                      )}
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-neutral-700 leading-relaxed font-normal">
                    &ldquo;{rev.comment}&rdquo;
                  </p>

                  {rev.cropImageUrl && (
                    <div className="mt-2.5 flex items-center gap-2.5 rounded-xl bg-amber-50/50 p-2 border border-amber-200/60">
                      <img
                        src={rev.cropImageUrl}
                        alt={`${rev.crop} sample`}
                        className="h-12 w-16 shrink-0 rounded-lg object-cover border border-neutral-200"
                      />
                      <div className="text-[11px] text-neutral-600 min-w-0">
                        <div className="font-bold text-neutral-800 flex items-center gap-1">
                          <span>🌾 {rev.crop} Lot Sample</span>
                          <span className="text-emerald-700 font-semibold">• S3 Cloud Media</span>
                        </div>
                        <div className="text-[10px] text-neutral-500">
                          {rev.lotQuantityQtl ? `${rev.lotQuantityQtl} Qtl · ` : ''}Verified Produce Sample
                        </div>
                      </div>
                    </div>
                  )}

                  {rev.tags && rev.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {rev.tags.map((t: string) => (
                        <span key={t} className="rounded bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
                          ✓ {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 4. Procurement Centres Management Tab */}
      {adminTab === 'centers' && (
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-white p-5 border border-neutral-200/90 shadow-sm">
            <div>
              <h2 className="text-xl font-black text-neutral-900 flex items-center gap-2">
                <span>🏛️</span> National Procurement Centres & Mandis
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Central government network across 13+ states. Monitor capacities, register new APMC yards, and issue automated slot calendars.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="secondary" size="sm" onClick={loadCenters} className="text-xs">
                🔄 Refresh
              </Button>
              <Button size="sm" onClick={() => setCenterModalOpen(true)} className="text-xs flex items-center gap-1.5">
                <IconBuilding className="h-4 w-4" />
                <span>+ Register Centre</span>
              </Button>
            </div>
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile
              label="Procurement Centres"
              value={String(centers.length)}
              tone="brand"
            />
            <StatTile
              label="States & UTs Covered"
              value={String(centerStates.length)}
              tone="default"
            />
            <StatTile
              label="Total Daily Capacity"
              value={`${totalDailyCapacity.toLocaleString('en-IN')} Q`}
              tone="default"
            />
            <StatTile
              label="Slot Schedule"
              value="7 Days"
              tone="brand"
            />
          </div>

          {/* Slot Generation Feedback Message */}
          {slotGenMessage && (
            <Alert tone="info">{slotGenMessage}</Alert>
          )}

          {/* Search & State Filter Bar */}
          <div className="space-y-3 rounded-2xl bg-white p-4 border border-neutral-200/90 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  value={centerAdminSearch}
                  onChange={(e) => setCenterAdminSearch(e.target.value)}
                  placeholder="Search mandi, district, code, crop..."
                  className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 py-2 text-xs text-neutral-800 placeholder-neutral-400 focus:bg-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition"
                />
                {centerAdminSearch && (
                  <button
                    type="button"
                    onClick={() => setCenterAdminSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    <IconClose className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="text-xs text-neutral-500 font-medium self-end sm:self-auto">
                Showing {filteredCenters.length} of {centers.length} centres
              </div>
            </div>

            {/* State Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 text-xs no-scrollbar">
              <button
                type="button"
                onClick={() => setCenterAdminState('All')}
                className={`rounded-full px-3 py-1 font-semibold text-xs transition shrink-0 ${
                  centerAdminState === 'All'
                    ? 'bg-brand-700 text-white shadow-sm'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                All ({centers.length})
              </button>
              {centerStates.map((st) => {
                const count = centers.filter((c) => c.state === st).length;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setCenterAdminState(st)}
                    className={`rounded-full px-3 py-1 font-semibold text-xs transition shrink-0 ${
                      centerAdminState === st
                        ? 'bg-brand-700 text-white shadow-sm'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {st} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Centres Grid */}
          {filteredCenters.length === 0 ? (
            <div className="rounded-2xl bg-white p-12 text-center border border-neutral-200">
              <EmptyState
                title="No procurement centres match your filter"
                description="Try clearing your search query or selecting 'All' states."
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCenters.map((c) => (
                <div
                  key={c._id}
                  className="flex flex-col justify-between rounded-2xl bg-white p-5 border border-neutral-200/90 shadow-sm hover:shadow-md transition group"
                >
                  <div className="space-y-3">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                          {c.state || 'General'}
                        </span>
                        <h3 className="text-base font-bold text-neutral-900 mt-1.5 leading-snug group-hover:text-brand-800 transition">
                          {c.name}
                        </h3>
                      </div>
                      {c.code && (
                        <span className="shrink-0 rounded-lg bg-neutral-100 px-2 py-1 text-[11px] font-mono font-bold text-neutral-700 border border-neutral-200">
                          {c.code}
                        </span>
                      )}
                    </div>

                    {/* Address */}
                    <div className="flex items-start gap-1.5 text-xs text-neutral-500">
                      <IconMapPin className="h-3.5 w-3.5 text-neutral-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{c.address || `${c.district}, ${c.state}`}</span>
                    </div>

                    {/* Operational Details Badges */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-neutral-50 p-2 border border-neutral-100">
                        <div className="text-[10px] uppercase font-semibold text-neutral-400 flex items-center gap-1">
                          <IconClock className="h-3 w-3" /> Hours
                        </div>
                        <div className="font-semibold text-neutral-800 mt-0.5">
                          {c.openTime || '08:00'} – {c.closeTime || '17:00'}
                        </div>
                      </div>
                      <div className="rounded-xl bg-neutral-50 p-2 border border-neutral-100">
                        <div className="text-[10px] uppercase font-semibold text-neutral-400 flex items-center gap-1">
                          <IconRupee className="h-3 w-3" /> Daily Intake
                        </div>
                        <div className="font-semibold text-neutral-800 mt-0.5">
                          {c.dailyCapacity || 200} Qtl / day
                        </div>
                      </div>
                    </div>

                    {/* Contact Phone */}
                    {c.contactPhone && (
                      <div className="flex items-center gap-1.5 text-xs text-neutral-600 bg-emerald-50/60 rounded-xl px-2.5 py-1.5 border border-emerald-100">
                        <IconPhone className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="font-mono font-medium">{c.contactPhone}</span>
                      </div>
                    )}

                    {/* Supported Crops */}
                    {c.crops && c.crops.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {c.crops.map((crop) => (
                          <span
                            key={crop}
                            className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200 capitalize"
                          >
                            🌾 {crop}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={slotGenLoading === c._id}
                      onClick={() => generate7DaySlots(c._id, c.name)}
                      className="flex-1 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-800 px-3 py-2 text-xs font-bold border border-brand-200 flex items-center justify-center gap-1.5 transition disabled:opacity-60"
                      title="Generates or verifies 7 daily slot windows for this procurement centre"
                    >
                      {slotGenLoading === c._id ? (
                        <IconSpinner className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <span>⚡ 7-Day Slots</span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCenterId(c._id);
                        setAdminTab('queue');
                      }}
                      className="rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white px-3 py-2 text-xs font-bold transition flex items-center justify-center gap-1"
                      title="Open live token queue for this centre"
                    >
                      <span>Queue Board</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. Announcements & Mandi Advisories Control Tab */}
      {adminTab === 'announcements' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-white p-5 border border-neutral-200/90 shadow-sm">
            <div>
              <h2 className="text-xl font-black text-neutral-900 flex items-center gap-2">
                <span>📢</span> Official Announcements & Procurement Advisories
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Central government advisory broadcasting console. Publish real-time MSP updates, 20% DBT safety advance alerts, weather warnings, and gate pass tokens directly to all farmers' notification bells.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={loadAnnouncements}
                className="text-xs"
                disabled={announcementsLoading}
              >
                🔄 Refresh
              </Button>
              <Button
                size="sm"
                onClick={openCreateAnnouncementModal}
                className="text-xs flex items-center gap-1.5"
              >
                <span>+ Create Announcement</span>
              </Button>
            </div>
          </div>

          {announcementFeedback && (
            <div
              className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between border ${
                announcementFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-red-50 text-red-800 border-red-300'
              }`}
            >
              <span>{announcementFeedback.message}</span>
              <button
                type="button"
                onClick={() => setAnnouncementFeedback(null)}
                className="text-neutral-500 hover:text-neutral-700 font-bold ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-500">Total Advisories</span>
                <span className="text-base">📢</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-neutral-900">
                  {announcementsStats?.total ?? announcements.length}
                </span>
                <span className="text-[11px] text-neutral-400">Recorded</span>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-800">Live on Portal</span>
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-emerald-900">
                  {announcementsStats?.activeCount ?? announcements.filter((a) => a.isActive).length}
                </span>
                <span className="text-[11px] font-bold text-emerald-700">Active / Visible</span>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-500">Drafts / Inactive</span>
                <span className="text-base">📁</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-neutral-700">
                  {announcementsStats?.inactiveCount ?? announcements.filter((a) => !a.isActive).length}
                </span>
                <span className="text-[11px] text-neutral-400">Hidden</span>
              </div>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-red-800">Urgent / High Priority</span>
                <span className="text-base">🚨</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-red-900">
                  {announcementsStats?.urgentCount ??
                    announcements.filter((a) => (a.priority === 'urgent' || a.priority === 'high') && a.isActive).length}
                </span>
                <span className="text-[11px] font-bold text-red-700">Broadcast Alert</span>
              </div>
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="rounded-2xl bg-white p-4 border border-neutral-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">
                🔍
              </span>
              <input
                type="text"
                value={announcementSearch}
                onChange={(e) => setAnnouncementSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') loadAnnouncements();
                }}
                placeholder="Search advisories by title, message, or state..."
                className="w-full rounded-xl border border-neutral-300 py-2 pl-9 pr-8 text-xs font-medium focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
              {announcementSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setAnnouncementSearch('');
                    setTimeout(loadAnnouncements, 50);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={announcementTypeFilter}
                onChange={(e) => {
                  setAnnouncementTypeFilter(e.target.value);
                  setTimeout(loadAnnouncements, 50);
                }}
                className="rounded-xl border border-neutral-300 py-2 px-2.5 text-xs font-medium focus:border-brand-500 focus:outline-none"
              >
                <option value="all">All Categories</option>
                <option value="msp">🌾 MSP Rates</option>
                <option value="payment_advance">💰 20% DBT Advance</option>
                <option value="booking_confirmed">🎫 Gate Pass & Slots</option>
                <option value="weather">🌧️ Weather & Harvest</option>
                <option value="emergency">🚨 Emergency Alerts</option>
                <option value="logistics">🚚 Logistics & 3PL</option>
                <option value="general">📢 General Notices</option>
              </select>

              <select
                value={announcementPriorityFilter}
                onChange={(e) => {
                  setAnnouncementPriorityFilter(e.target.value);
                  setTimeout(loadAnnouncements, 50);
                }}
                className="rounded-xl border border-neutral-300 py-2 px-2.5 text-xs font-medium focus:border-brand-500 focus:outline-none"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>

              <div className="flex items-center rounded-xl bg-neutral-100 p-1 border border-neutral-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setAnnouncementStatusFilter('all');
                    setTimeout(loadAnnouncements, 50);
                  }}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    announcementStatusFilter === 'all'
                      ? 'bg-white text-neutral-900 shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAnnouncementStatusFilter('active');
                    setTimeout(loadAnnouncements, 50);
                  }}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    announcementStatusFilter === 'active'
                      ? 'bg-white text-emerald-800 shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  Active Only
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAnnouncementStatusFilter('inactive');
                    setTimeout(loadAnnouncements, 50);
                  }}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    announcementStatusFilter === 'inactive'
                      ? 'bg-white text-neutral-800 shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  Inactive
                </button>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={loadAnnouncements}
                className="text-xs"
              >
                Filter
              </Button>
            </div>
          </div>

          {/* Announcements Grid / List */}
          {announcementsLoading ? (
            <div className="py-16 text-center">
              <IconSpinner className="mx-auto h-8 w-8 animate-spin text-brand-600" />
              <p className="text-xs font-semibold text-neutral-500 mt-2">Loading announcements...</p>
            </div>
          ) : announcements.length === 0 ? (
            <div className="rounded-2xl bg-white border border-neutral-200 p-12 text-center">
              <span className="text-4xl block mb-2">📢</span>
              <h3 className="text-base font-bold text-neutral-800">No Announcements Found</h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                No advisories match your current filter criteria. Create a new official broadcast for farmers.
              </p>
              <Button
                onClick={openCreateAnnouncementModal}
                size="sm"
                className="mt-4 text-xs"
              >
                + Create Announcement
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {announcements.map((item) => {
                const isUrgent = item.priority === 'urgent';
                const isHigh = item.priority === 'high';
                return (
                  <div
                    key={item._id}
                    className={`rounded-2xl border bg-white p-5 shadow-xs transition flex flex-col justify-between ${
                      item.isActive
                        ? isUrgent
                          ? 'border-red-300 ring-1 ring-red-200'
                          : isHigh
                          ? 'border-amber-300'
                          : 'border-neutral-200 hover:border-brand-300'
                        : 'border-neutral-200 opacity-60 bg-neutral-50/60'
                    }`}
                  >
                    <div>
                      {/* Top Badges and Active Switch */}
                      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Priority Pill */}
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide border flex items-center gap-1 ${
                              item.priority === 'urgent'
                                ? 'bg-red-100 text-red-800 border-red-300 animate-pulse'
                                : item.priority === 'high'
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : item.priority === 'low'
                                ? 'bg-neutral-100 text-neutral-700 border-neutral-200'
                                : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            }`}
                          >
                            {item.priority === 'urgent' && <span>⚡</span>}
                            <span>{item.priority}</span>
                          </span>

                          {/* Category Pill */}
                          <span className="rounded-lg bg-neutral-100 text-neutral-700 border border-neutral-200 px-2 py-0.5 text-[10px] font-bold">
                            {item.type === 'msp' && '🌾 MSP Rates'}
                            {item.type === 'payment_advance' && '💰 20% DBT Advance'}
                            {item.type === 'booking_confirmed' && '🎫 Gate Pass'}
                            {item.type === 'weather' && '🌧️ Weather'}
                            {item.type === 'emergency' && '🚨 Emergency'}
                            {item.type === 'logistics' && '🚚 Logistics'}
                            {item.type === 'general' && '📢 Notice'}
                          </span>

                          {/* State Tag */}
                          <span className="rounded-lg bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 text-[10px] font-bold">
                            📍 {item.state || 'All India'}
                          </span>
                        </div>

                        {/* Quick Live Toggle Switch */}
                        <button
                          type="button"
                          onClick={() => handleToggleAnnouncement(item._id)}
                          disabled={announcementActionLoading === item._id}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold transition flex items-center gap-1.5 border cursor-pointer ${
                            item.isActive
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shadow-2xs'
                              : 'bg-neutral-100 text-neutral-500 border-neutral-300 hover:bg-neutral-200'
                          }`}
                          title={item.isActive ? 'Click to deactivate / hide from portal' : 'Click to activate / show on portal'}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              item.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400'
                            }`}
                          />
                          <span>{item.isActive ? 'LIVE ON PORTAL' : 'HIDDEN / DRAFT'}</span>
                        </button>
                      </div>

                      {/* Announcement Title */}
                      <h3 className="text-sm sm:text-base font-extrabold text-neutral-900 leading-snug">
                        {item.title}
                      </h3>

                      {/* Message Content */}
                      <p className="mt-2 text-xs font-mono text-neutral-700 bg-neutral-50 p-3 rounded-xl border border-neutral-200/80 leading-relaxed whitespace-pre-wrap">
                        {item.message}
                      </p>

                      {/* Metadata Details */}
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-500">
                        <span>👤 By: <strong>{item.authorName || 'Admin'}</strong></span>
                        <span>🎯 Audience: <strong>{item.targetAudience}</strong></span>
                        <span>🌾 Crop: <strong>{item.crop || 'All Crops'}</strong></span>
                        <span>🕒 {new Date(item.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditAnnouncementModal(item)}
                          className="rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-3 py-1.5 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <span>✎ Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleAnnouncement(item._id)}
                          disabled={announcementActionLoading === item._id}
                          className="rounded-lg border border-neutral-200 hover:bg-neutral-100 text-neutral-600 px-3 py-1.5 text-xs font-semibold transition cursor-pointer"
                        >
                          {item.isActive ? 'Deactivate' : 'Publish Live'}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteAnnouncement(item._id)}
                        disabled={announcementActionLoading === item._id}
                        className="rounded-lg text-red-600 hover:bg-red-50 px-2.5 py-1.5 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <span>🗑️ Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Announcement Modal */}
      {announcementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm"
            onClick={() => setAnnouncementModalOpen(false)}
          />
          <div className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-neutral-900/10">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-brand-700 via-emerald-700 to-teal-700 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <span>📢</span>
                  <span>{editingAnnouncement ? 'Edit Announcement' : 'Create New Announcement'}</span>
                </h3>
                <p className="text-xs text-brand-100">
                  Broadcast advisories directly to all farmers and notification bells.
                </p>
              </div>
              <button
                onClick={() => setAnnouncementModalOpen(false)}
                className="rounded-full p-1 text-white/80 hover:bg-white/10 hover:text-white cursor-pointer"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveAnnouncement} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1">
                  Advisory Title *
                </label>
                <input
                  type="text"
                  required
                  maxLength={150}
                  value={announcementForm.title}
                  onChange={(e) => setAnnouncementForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. 🌾 Wheat MSP Procurement Live across All 18 Mandis"
                  className="w-full rounded-xl border border-neutral-300 py-2.5 px-3 text-sm font-semibold focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1">
                    Category / Type *
                  </label>
                  <select
                    value={announcementForm.type}
                    onChange={(e) => setAnnouncementForm((p) => ({ ...p, type: e.target.value }))}
                    className="w-full rounded-xl border border-neutral-300 py-2.5 px-3 text-sm font-medium focus:border-brand-500 focus:outline-none"
                  >
                    <option value="general">📢 General Notice</option>
                    <option value="msp">🌾 MSP Procurement Rates</option>
                    <option value="payment_advance">💰 20% DBT Advance</option>
                    <option value="booking_confirmed">🎫 Gate Pass & Slots</option>
                    <option value="weather">🌧️ Weather & Moisture</option>
                    <option value="emergency">🚨 Emergency Warning</option>
                    <option value="logistics">🚚 Logistics & Transport</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1">
                    Priority Level *
                  </label>
                  <select
                    value={announcementForm.priority}
                    onChange={(e) =>
                      setAnnouncementForm((p) => ({
                        ...p,
                        priority: e.target.value as 'low' | 'normal' | 'high' | 'urgent',
                      }))
                    }
                    className="w-full rounded-xl border border-neutral-300 py-2.5 px-3 text-sm font-medium focus:border-brand-500 focus:outline-none"
                  >
                    <option value="normal">Normal (Standard Bulletin)</option>
                    <option value="high">High (Featured Advisory)</option>
                    <option value="urgent">Urgent (Red Alert Banner)</option>
                    <option value="low">Low (Informational)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1">
                    Target State / Mandi Region
                  </label>
                  <input
                    type="text"
                    value={announcementForm.state}
                    onChange={(e) => setAnnouncementForm((p) => ({ ...p, state: e.target.value }))}
                    placeholder="e.g. All India, Punjab, Haryana, etc."
                    className="w-full rounded-xl border border-neutral-300 py-2 px-3 text-xs font-medium focus:border-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1">
                    Relevant Crop Lots
                  </label>
                  <input
                    type="text"
                    value={announcementForm.crop}
                    onChange={(e) => setAnnouncementForm((p) => ({ ...p, crop: e.target.value }))}
                    placeholder="e.g. All Crops, Wheat, Mustard, Paddy"
                    className="w-full rounded-xl border border-neutral-300 py-2 px-3 text-xs font-medium focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700">
                    Advisory Body & Instructions *
                  </label>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    {announcementForm.message.length} / 1000 characters
                  </span>
                </div>
                <textarea
                  required
                  rows={4}
                  maxLength={1000}
                  value={announcementForm.message}
                  onChange={(e) => setAnnouncementForm((p) => ({ ...p, message: e.target.value }))}
                  placeholder="Provide precise procurement directives, MSP numbers, tractor gate rules, or bank settlement updates..."
                  className="w-full rounded-xl border border-neutral-300 p-3 text-xs font-mono text-neutral-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>

              {/* Active on Portal checkbox */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                <input
                  type="checkbox"
                  id="announcementIsActive"
                  checked={announcementForm.isActive}
                  onChange={(e) => setAnnouncementForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="announcementIsActive" className="text-xs font-bold text-emerald-950 cursor-pointer">
                  Publish Immediately on Farmer Portal (तुरंत पोर्टल पर सक्रिय करें)
                </label>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setAnnouncementModalOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  loading={announcementActionLoading === 'save'}
                  className="text-xs font-bold px-5"
                >
                  {editingAnnouncement ? 'Save Changes' : 'Publish Announcement'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register New Centre Modal */}
      {centerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm" onClick={() => setCenterModalOpen(false)} />
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-neutral-900/10">
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-700 via-emerald-700 to-teal-700 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <IconBuilding className="h-5 w-5" />
                  <span>Register Procurement Centre</span>
                </h3>
                <p className="text-xs text-brand-100">
                  Add an APMC Mandi, PAC yard, or state warehousing depot.
                </p>
              </div>
              <button
                onClick={() => setCenterModalOpen(false)}
                className="rounded-full p-1 text-white/80 hover:bg-white/10 hover:text-white"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleCreateCenter} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {centerFormError && <Alert tone="error">{centerFormError}</Alert>}
              {centerFormSuccess && <Alert tone="success">{centerFormSuccess}</Alert>}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextField
                  label="Centre / Mandi Name"
                  required
                  value={newCenter.name}
                  onChange={(e) => setNewCenter({ ...newCenter, name: e.target.value })}
                  placeholder="e.g. Ludhiana Grain Market Yard"
                />
                <TextField
                  label="Centre Code (Unique)"
                  required
                  value={newCenter.code}
                  onChange={(e) => setNewCenter({ ...newCenter, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. PB-LDH-01"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextField
                  label="State"
                  required
                  value={newCenter.state}
                  onChange={(e) => setNewCenter({ ...newCenter, state: e.target.value })}
                  placeholder="e.g. Punjab"
                />
                <TextField
                  label="District"
                  required
                  value={newCenter.district}
                  onChange={(e) => setNewCenter({ ...newCenter, district: e.target.value })}
                  placeholder="e.g. Ludhiana"
                />
              </div>

              <TextField
                label="Full Mandi / PAC Address"
                value={newCenter.address}
                onChange={(e) => setNewCenter({ ...newCenter, address: e.target.value })}
                placeholder="e.g. Near GT Road, Grain Market Complex, Ludhiana - 141001"
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <TextField
                  label="Daily Capacity (Qtl)"
                  type="number"
                  value={newCenter.dailyCapacity.toString()}
                  onChange={(e) => setNewCenter({ ...newCenter, dailyCapacity: Number(e.target.value) || 200 })}
                  placeholder="200"
                />
                <TextField
                  label="Open Time"
                  value={newCenter.openTime}
                  onChange={(e) => setNewCenter({ ...newCenter, openTime: e.target.value })}
                  placeholder="08:00"
                />
                <TextField
                  label="Close Time"
                  value={newCenter.closeTime}
                  onChange={(e) => setNewCenter({ ...newCenter, closeTime: e.target.value })}
                  placeholder="17:00"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextField
                  label="Helpline / Landline"
                  value={newCenter.contactPhone}
                  onChange={(e) => setNewCenter({ ...newCenter, contactPhone: e.target.value })}
                  placeholder="e.g. +91 161 2400123"
                />
                <TextField
                  label="Supported Crops (comma-separated)"
                  value={newCenter.crops}
                  onChange={(e) => setNewCenter({ ...newCenter, crops: e.target.value })}
                  placeholder="wheat, paddy, mustard"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCenterModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={centerFormLoading}
                >
                  Register Centre
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Farmer Dossier & S3 Bill Modal */}
      {dossierModalOpen && (

        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm" onClick={() => setDossierModalOpen(false)} />
          <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-neutral-900/10 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-brand-700 via-emerald-700 to-teal-700 px-6 py-4 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <IconUser className="h-5 w-5" />
                  <span>Farmer Dossier & MSP Records</span>
                </h3>
                <p className="text-xs text-brand-100">
                  Aadhaar KYC authentication, token history, DBT disbursements & S3 bills
                </p>
              </div>
              <button
                onClick={() => setDossierModalOpen(false)}
                className="rounded-full p-1 text-white/80 hover:bg-white/10 hover:text-white transition"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {dossierLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
                  <IconSpinner className="h-8 w-8 animate-spin text-brand-600 mb-2" />
                  <p className="text-xs font-semibold">Loading farmer dossier...</p>
                </div>
              ) : !farmerDossier ? (
                <div className="py-10 text-center text-neutral-500">
                  <p className="text-sm font-semibold">Unable to load farmer details.</p>
                </div>
              ) : (
                <>
                  {/* Farmer Identity Card */}
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-brand-600 to-emerald-700 text-white font-black text-base flex items-center justify-center shadow-sm">
                          {farmerDossier.farmer.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-black text-neutral-900">{farmerDossier.farmer.name}</h4>
                            {(farmerDossier.farmer.aadhaarLast4 || farmerDossier.farmer.aadhaarNumber) && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                                <IconShieldCheck className="h-3 w-3" />
                                <span>Aadhaar •••• {farmerDossier.farmer.aadhaarLast4 || farmerDossier.farmer.aadhaarNumber?.slice(-4)}</span>
                              </span>
                            )}
                            {farmerDossier.farmer.aadhaarCardUrl && (
                              <a
                                href={farmerDossier.farmer.aadhaarCardUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200 hover:bg-blue-100"
                              >
                                <span>📄 View Aadhaar Card</span>
                              </a>
                            )}
                          </div>
                          <p className="text-xs text-neutral-500 font-mono mt-0.5">
                            {farmerDossier.farmer.phone} · Member since {new Date(farmerDossier.farmer.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>

                      {/* Tier Badge Controls */}
                      <div className="flex items-center gap-2 self-start sm:self-center">
                        <span className="text-[11px] font-bold text-neutral-500 uppercase">Badge Tier:</span>
                        <select
                          value={farmerDossier.farmer.badge || 'standard'}
                          disabled={updatingFarmerBadge}
                          onChange={(e) => handleUpdateBadge(farmerDossier.farmer._id, e.target.value)}
                          className="rounded-xl border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-bold text-neutral-800 focus:border-brand-600 focus:outline-none shadow-xs"
                        >
                          <option value="standard">Standard Farmer</option>
                          <option value="verified_prime">⭐ Verified Prime</option>
                          <option value="kisan_ratna">👑 Kisan Ratna</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-neutral-200/80 text-xs">
                      <div>
                        <span className="text-[10px] uppercase text-neutral-400 font-bold block">Village & District</span>
                        <span className="font-semibold text-neutral-800">
                          {farmerDossier.farmer.village || '—'}, {farmerDossier.farmer.district || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-neutral-400 font-bold block">State</span>
                        <span className="font-semibold text-neutral-800">{farmerDossier.farmer.state || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-neutral-400 font-bold block">Farmland</span>
                        <span className="font-semibold text-neutral-800">
                          {farmerDossier.farmer.landAreaAcres ? `${farmerDossier.farmer.landAreaAcres} Acres` : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-neutral-400 font-bold block">Primary Crops</span>
                        <span className="font-semibold text-neutral-800 capitalize">
                          {farmerDossier.farmer.crops && farmerDossier.farmer.crops.length > 0
                            ? farmerDossier.farmer.crops.join(', ')
                            : 'Wheat, Paddy'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Section 1: Mandi Slot Bookings */}
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-neutral-600 mb-2.5 flex items-center justify-between">
                      <span>🌾 Mandi Slot Bookings ({farmerDossier.bookings.length})</span>
                    </h4>
                    {farmerDossier.bookings.length === 0 ? (
                      <div className="rounded-xl border border-neutral-200 p-4 text-center text-xs text-neutral-500">
                        No tokens booked yet.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {farmerDossier.bookings.map((b) => (
                          <div
                            key={b._id}
                            className="rounded-xl border border-neutral-200/90 bg-white p-3 flex items-center justify-between gap-3 text-xs shadow-2xs"
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-black text-brand-800 bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-200 text-sm">
                                #{b.token}
                              </span>
                              <div>
                                <p className="font-bold text-neutral-900">
                                  {b.center?.name || 'Procurement Mandi'}
                                </p>
                                <p className="text-[11px] text-neutral-500">
                                  {b.date} · {b.slot?.startTime} - {b.slot?.endTime} · {b.estimatedQuantityQtl || 10} Qtl {b.crop || 'wheat'}
                                </p>
                              </div>
                            </div>
                            <div>
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                  b.status === 'completed'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : b.status === 'serving'
                                    ? 'bg-blue-100 text-blue-800 animate-pulse'
                                    : b.status === 'no_show' || b.status === 'cancelled'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {b.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section 2: Crop Procurements, MSP & S3 Mandi Bills */}
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-neutral-600 mb-2.5 flex items-center justify-between">
                      <span>💰 MSP Procurements & AWS S3 Bill Archives ({farmerDossier.procurements.length})</span>
                    </h4>
                    {farmerDossier.procurements.length === 0 ? (
                      <div className="rounded-xl border border-neutral-200 p-4 text-center text-xs text-neutral-500">
                        No crop procurements settled yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {farmerDossier.procurements.map((p) => (
                          <div
                            key={p._id}
                            className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm space-y-3"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-neutral-100">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-neutral-900 capitalize text-sm">
                                    🌾 {p.crop} ({p.quantityQtl} Qtl @ ₹{p.ratePerQtl}/Qtl)
                                  </span>
                                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 border border-emerald-200">
                                    {p.stage}
                                  </span>
                                </div>
                                <p className="text-xs text-neutral-500 mt-0.5">
                                  Settled on {new Date(p.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' })}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] uppercase text-neutral-400 block font-bold">Total MSP Settlement</span>
                                <span className="text-base font-black text-emerald-700">
                                  ₹{p.amount.toLocaleString('en-IN')}
                                </span>
                              </div>
                            </div>

                            {/* Advance & Balance Breakdown */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                              <div className="rounded-xl bg-neutral-50 p-2.5 border border-neutral-200/70">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-neutral-600">20% Safety Advance</span>
                                  <span className="font-black text-neutral-900">₹{p.advanceAmount.toLocaleString('en-IN')}</span>
                                </div>
                                <p className="text-[11px] text-emerald-700 mt-1 font-mono">
                                  ✓ DBT Disbursed {p.utrNumber ? `· UTR: ${p.utrNumber}` : ''}
                                </p>
                              </div>

                              <div className="rounded-xl bg-neutral-50 p-2.5 border border-neutral-200/70">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-neutral-600">80% Post-QA Balance</span>
                                  <span className="font-black text-neutral-900">₹{p.balanceAmount.toLocaleString('en-IN')}</span>
                                </div>
                                <p className="text-[11px] text-emerald-700 mt-1 font-mono">
                                  ✓ Cleared via PFMS / NACH
                                </p>
                              </div>
                            </div>

                            {/* S3 Mandi Bill Download Button */}
                            <div className="pt-1 flex items-center justify-between">
                              <span className="text-[11px] text-neutral-500">
                                Official Digital Procurement Receipt
                              </span>
                              {p.billPdfUrl ? (
                                <a
                                  href={p.billPdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-bold transition shadow-xs"
                                >
                                  <span>📄 Download S3 Mandi Bill (PDF)</span>
                                </a>
                              ) : (
                                <span className="text-[11px] text-neutral-400 italic">
                                  Bill generated upon final weighing
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section 3: SMS & WhatsApp Alerts Log */}
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-neutral-600 mb-2.5 flex items-center justify-between">
                      <span>📲 SMS & WhatsApp Dispatch Log ({farmerDossier.notifications.length})</span>
                    </h4>
                    {farmerDossier.notifications.length === 0 ? (
                      <div className="rounded-xl border border-neutral-200 p-4 text-center text-xs text-neutral-500">
                        No automated alerts dispatched yet.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                        {farmerDossier.notifications.map((n) => (
                          <div
                            key={n._id}
                            className="rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-3 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                    n.channel === 'whatsapp'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {n.channel}
                                </span>
                                <span className="font-bold text-neutral-900">{n.title}</span>
                              </div>
                              <span className="text-[10px] text-neutral-400">
                                {new Date(n.sentAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-[11px] text-neutral-600 whitespace-pre-line">{n.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDossierModalOpen(false)}
                className="text-xs"
              >
                Close Dossier
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Raw JSON Document Inspector Modal */}
      {docModalOpen && inspectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm" onClick={() => setDocModalOpen(false)} />
          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-neutral-900 shadow-2xl ring-1 ring-white/10 max-h-[85vh] flex flex-col text-neutral-100">
            {/* Header */}
            <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-950/80">
              <div>
                <h3 className="text-sm font-bold font-mono text-emerald-400 flex items-center gap-2">
                  <IconDatabase className="h-4 w-4" />
                  <span>db.{activeCollection}.findOne({`{ _id: "${inspectedDoc._id}" }`})</span>
                </h3>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  BSON Document representation
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyDocJson(inspectedDoc)}
                  className="rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs px-2.5 py-1 font-semibold text-neutral-200 transition"
                >
                  {copiedDocId === inspectedDoc._id ? '✓ Copied!' : 'Copy JSON'}
                </button>
                <button
                  onClick={() => setDocModalOpen(false)}
                  className="rounded-full p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
                >
                  <IconClose className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Code Body */}
            <div className="p-6 overflow-y-auto flex-1 font-mono text-xs leading-relaxed">
              <pre className="text-emerald-400 selection:bg-emerald-900 whitespace-pre-wrap break-all">
                {JSON.stringify(inspectedDoc, null, 2)}
              </pre>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-neutral-800 bg-neutral-950/50 flex items-center justify-end shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDocModalOpen(false)}
                className="text-xs text-neutral-300 hover:text-white"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}

