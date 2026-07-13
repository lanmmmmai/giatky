import React, { useEffect, useRef, useState } from 'react';
import {
  getSeoSettings,
  updateSeoSettings,
  createSeoSettings,
  deleteSeoSettings,
  uploadSeoImage,
  deleteSeoImage,
  SeoSettings,
  SeoImageUploadResult,
} from '../../api/seo';
import { getEmailLogs, EmailLog } from '../../api/email';
import EmailTemplatesTab from './EmailTemplatesTab';
import EmailSettingsTab from './EmailSettingsTab';
import { useToastStore } from '../../stores/toastStore';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { useConfirm } from '../../components/ConfirmDialog';
import {
  Globe, Mail, Eye, Edit3, ClipboardList, CheckCircle, XCircle, Save,
  Plus, Trash2, UploadCloud, Image as ImageIcon, X, Search, Settings2, Facebook,
} from 'lucide-react';

const SEO_STORAGE_MARKER = '/object/public/seo-assets/';

const storagePathFromUrl = (url?: string): string | null => {
  if (!url) return null;
  if (url.includes(SEO_STORAGE_MARKER)) return url.split(SEO_STORAGE_MARKER)[1].split('?')[0];
  return null;
};

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary';

const ROBOTS_OPTIONS = ['index, follow', 'index, nofollow', 'noindex, follow', 'noindex, nofollow'];
const TWITTER_CARD_OPTIONS = [
  { value: 'summary_large_image', label: 'Summary Large Image (ảnh lớn)' },
  { value: 'summary', label: 'Summary (ảnh nhỏ)' },
];

const emptySeoForm = {
  domain: '', meta_title: '', meta_description: '', keywords: '', canonical_url: '',
  robots: 'index, follow', og_title: '', og_description: '',
  twitter_card: 'summary_large_image', twitter_title: '', twitter_description: '',
};

/* ─────────── Preview SEO: giống Google Search + chia sẻ Facebook ─────────── */
interface SeoPreviewData {
  domain: string;
  canonical_url?: string;
  meta_title?: string;
  meta_description?: string;
  keywords?: string;
  robots?: string;
  og_title?: string;
  og_description?: string;
  og_image?: string;
}

const GooglePreview: React.FC<{ data: SeoPreviewData }> = ({ data }) => (
  <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-0.5">
    <p className="text-[11px] text-emerald-700 font-medium truncate">
      {data.canonical_url || (data.domain ? `https://${data.domain}` : 'https://ten-mien-cua-ban.vn')}
    </p>
    <p className="text-sm text-blue-700 font-medium leading-snug line-clamp-1">
      {data.meta_title || 'Tiêu đề SEO sẽ hiển thị tại đây'}
    </p>
    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
      {data.meta_description || 'Mô tả SEO mặc định của domain sẽ hiển thị tại đây khi người dùng tìm kiếm trên Google.'}
    </p>
  </div>
);

const FacebookPreview: React.FC<{ data: SeoPreviewData }> = ({ data }) => (
  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
    {data.og_image ? (
      <img src={data.og_image} alt="Facebook preview" className="w-full aspect-[1200/630] object-cover" />
    ) : (
      <div className="w-full aspect-[1200/630] flex flex-col items-center justify-center text-slate-300 gap-1.5">
        <ImageIcon size={26} strokeWidth={1.5} />
        <span className="text-[10px] font-semibold text-slate-400">Chưa có ảnh chia sẻ</span>
      </div>
    )}
    <div className="p-3 bg-white border-t border-slate-100 space-y-0.5">
      <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide truncate">{data.domain || 'ten-mien-cua-ban.vn'}</p>
      <p className="text-xs font-bold text-slate-800 line-clamp-1">{data.og_title || data.meta_title || 'Tiêu đề SEO'}</p>
      <p className="text-[11px] text-slate-500 line-clamp-1">{data.og_description || data.meta_description || 'Mô tả SEO'}</p>
    </div>
  </div>
);

const AIPreview: React.FC<{ data: SeoPreviewData }> = ({ data }) => (
  <div className="border border-slate-200 rounded-2xl p-4 bg-slate-950 text-white space-y-3">
    <div>
      <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">AI citation source</p>
      <p className="text-xs font-mono text-white/80 truncate">{data.canonical_url || (data.domain ? `https://${data.domain}` : 'https://ten-mien-cua-ban.vn')}</p>
    </div>
    <div>
      <p className="text-sm font-black">{data.meta_title || 'Tiêu đề SEO'}</p>
      <p className="text-xs text-white/65 leading-5 mt-1">{data.meta_description || 'Mô tả ngắn để ChatGPT, Gemini, Claude, Perplexity và Copilot hiểu nội dung trang.'}</p>
    </div>
    <div className="grid grid-cols-2 gap-2 text-[11px]">
      <div className="rounded-xl bg-white/10 p-2"><span className="block text-white/40">Robots</span>{data.robots || 'index, follow'}</div>
      <div className="rounded-xl bg-white/10 p-2"><span className="block text-white/40">Keywords</span><span className="line-clamp-1">{data.keywords || 'Giặt Ký, quản lý giặt là'}</span></div>
    </div>
  </div>
);

const Cms: React.FC = () => {
  const { addToast } = useToastStore();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<'seo' | 'templates' | 'settings' | 'logs'>('seo');
  const [loading, setLoading] = useState(true);

  // Data states
  const [seoList, setSeoList] = useState<SeoSettings[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);

  // SEO tab: list <-> form
  const [seoMode, setSeoMode] = useState<'list' | 'form'>('list');
  const [editingSeo, setEditingSeo] = useState<SeoSettings | null>(null);
  const [seoFilter, setSeoFilter] = useState('');
  const [seoForm, setSeoForm] = useState({ ...emptySeoForm });
  const [seoDomainError, setSeoDomainError] = useState('');
  const [savingSeo, setSavingSeo] = useState(false);
  const [seoPreviewRow, setSeoPreviewRow] = useState<SeoSettings | null>(null);

  // OG image upload state — file is always uploaded through the backend, never a URL input
  const [pendingImage, setPendingImage] = useState<SeoImageUploadResult | null>(null);
  const [savedImageUrl, setSavedImageUrl] = useState('');
  const [imageRemoved, setImageRemoved] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Favicon & Twitter image: upload ngay khi chọn, lưu URL vào form khi bấm Lưu
  const [faviconUrl, setFaviconUrl] = useState('');
  const [twitterImageUrl, setTwitterImageUrl] = useState('');
  const [uploadingKind, setUploadingKind] = useState<'' | 'favicon' | 'twitter'>('');
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const twitterInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    if (activeTab === 'templates' || activeTab === 'settings') return; // tab tự tải dữ liệu
    setLoading(true);
    try {
      if (activeTab === 'seo') {
        const data = await getSeoSettings();
        setSeoList(data);
      } else if (activeTab === 'logs') {
        const data = await getEmailLogs();
        setEmailLogs(data);
      }
    } catch (_) {
      addToast('Không thể tải dữ liệu cấu hình.', 'error');
    } finally {
      setLoading(false);
    }
  };

  /* ─────────────── SEO handlers ─────────────── */

  const resetSeoForm = () => {
    setSeoForm({ ...emptySeoForm });
    setSeoDomainError('');
    setPendingImage(null);
    setSavedImageUrl('');
    setImageRemoved(false);
    setFaviconUrl('');
    setTwitterImageUrl('');
  };

  const openSeoCreate = () => {
    resetSeoForm();
    setEditingSeo(null);
    setSeoMode('form');
  };

  const openSeoEdit = (s: SeoSettings) => {
    setSeoForm({
      domain: s.domain,
      meta_title: s.meta_title || '',
      meta_description: s.meta_description || '',
      keywords: s.keywords || '',
      canonical_url: s.canonical_url || '',
      robots: s.robots || 'index, follow',
      og_title: s.og_title || '',
      og_description: s.og_description || '',
      twitter_card: s.twitter_card || 'summary_large_image',
      twitter_title: s.twitter_title || '',
      twitter_description: s.twitter_description || '',
    });
    setSeoDomainError('');
    setPendingImage(null);
    setSavedImageUrl(s.og_image || '');
    setImageRemoved(false);
    setFaviconUrl(s.favicon || '');
    setTwitterImageUrl(s.twitter_image || '');
    setEditingSeo(s);
    setSeoMode('form');
  };

  const closeSeoForm = async () => {
    // A pending upload that was never saved is orphaned — clean it up safely
    if (pendingImage) {
      try { await deleteSeoImage(pendingImage.path, editingSeo?.id); } catch (_) {}
    }
    resetSeoForm();
    setEditingSeo(null);
    setSeoMode('list');
  };

  const handleImageSelect = async (file: File | undefined | null) => {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      addToast('Chỉ chấp nhận ảnh JPG, JPEG, PNG hoặc WEBP.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast('Ảnh vượt quá dung lượng tối đa 5 MB.', 'error');
      return;
    }

    setUploadingImage(true);
    try {
      const result = await uploadSeoImage(file, seoForm.domain, 'og');
      // Replacing an unsaved pending upload: remove the previous orphan object
      if (pendingImage) {
        try { await deleteSeoImage(pendingImage.path, editingSeo?.id); } catch (_) {}
      }
      setPendingImage(result);
      setImageRemoved(false);
      addToast('Upload ảnh thành công.', 'success');
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Upload ảnh thất bại.', 'error');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExtraImageSelect = async (file: File | undefined | null, kind: 'favicon' | 'twitter') => {
    if (!file) return;
    const allowed = kind === 'favicon'
      ? ['image/jpeg', 'image/png', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon']
      : ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      addToast(kind === 'favicon' ? 'Favicon chấp nhận ICO, PNG, JPG, WEBP.' : 'Chỉ chấp nhận ảnh JPG, PNG, WEBP.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast('Ảnh vượt quá dung lượng tối đa 5 MB.', 'error');
      return;
    }
    setUploadingKind(kind);
    try {
      const result = await uploadSeoImage(file, seoForm.domain, kind);
      if (kind === 'favicon') setFaviconUrl(result.public_url);
      else setTwitterImageUrl(result.public_url);
      addToast('Upload ảnh thành công.', 'success');
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Upload ảnh thất bại.', 'error');
    } finally {
      setUploadingKind('');
      if (kind === 'favicon' && faviconInputRef.current) faviconInputRef.current.value = '';
      if (kind === 'twitter' && twitterInputRef.current) twitterInputRef.current.value = '';
    }
  };

  const handleRemoveImage = async () => {
    if (pendingImage) {
      // Not referenced in DB yet — safe to delete immediately
      try {
        await deleteSeoImage(pendingImage.path, editingSeo?.id);
      } catch (err: any) {
        addToast(err.response?.data?.detail || 'Xóa ảnh trong Storage thất bại.', 'error');
        return;
      }
      setPendingImage(null);
      addToast('Đã xóa ảnh vừa upload.', 'success');
      return;
    }
    if (savedImageUrl) {
      // Only clear the reference now; the object is removed after the config is saved
      setImageRemoved(true);
    }
  };

  const handleSaveSeo = async (e: React.FormEvent) => {
    e.preventDefault();
    const domainValue = seoForm.domain.trim();
    if (!domainValue) {
      setSeoDomainError('Vui lòng nhập domain.');
      return;
    }
    setSeoDomainError('');

    const effectiveImage = pendingImage ? pendingImage.public_url : (imageRemoved ? '' : savedImageUrl);
    const payload = {
      ...seoForm,
      domain: domainValue,
      og_image: effectiveImage,
      favicon: faviconUrl,
      twitter_image: twitterImageUrl,
    };

    setSavingSeo(true);
    try {
      if (editingSeo) {
        await updateSeoSettings(editingSeo.id, payload);
        // Old image replaced or removed → delete the old object only after DB update
        // succeeded, and only if no other config still uses it (backend enforces this)
        const oldPath = storagePathFromUrl(editingSeo.og_image);
        const oldStillUsed = effectiveImage === editingSeo.og_image;
        if (oldPath && !oldStillUsed) {
          try { await deleteSeoImage(oldPath, editingSeo.id); } catch (_) {}
        }
        addToast('Cấu hình SEO đã được cập nhật.', 'success');
      } else {
        await createSeoSettings(payload);
        addToast('Đã tạo cấu hình SEO mới.', 'success');
      }
      resetSeoForm();
      setEditingSeo(null);
      setSeoMode('list');
      loadData();
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Lưu cấu hình SEO thất bại.';
      if (String(detail).toLowerCase().includes('domain')) setSeoDomainError(detail);
      addToast(detail, 'error');
    } finally {
      setSavingSeo(false);
    }
  };

  const handleDeleteSeo = async (s: SeoSettings) => {
    await confirm({
      title: 'Xóa cấu hình SEO?',
      description: 'Cấu hình SEO của domain này sẽ bị xóa và không thể hoàn tác.',
      objectName: s.domain,
      confirmText: 'Xóa cấu hình',
      variant: 'danger',
      disableBackdropClose: true,
      onConfirm: async () => {
        try {
          await deleteSeoSettings(s.id);
          addToast('Đã xóa cấu hình SEO.', 'success');
          await loadData();
        } catch (err: any) {
          addToast(err.response?.data?.detail || 'Xóa cấu hình SEO thất bại.', 'error');
          throw err;
        }
      },
    });
  };

  const previewImageUrl = pendingImage ? pendingImage.public_url : (imageRemoved ? '' : savedImageUrl);
  const filteredSeoList = seoList.filter(s => !seoFilter.trim() || s.domain.toLowerCase().includes(seoFilter.trim().toLowerCase()));

  const formPreviewData: SeoPreviewData = {
    domain: seoForm.domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, ''),
    canonical_url: seoForm.canonical_url,
    meta_title: seoForm.meta_title,
    meta_description: seoForm.meta_description,
    og_title: seoForm.og_title,
    og_description: seoForm.og_description,
    og_image: previewImageUrl,
  };

  const tabs: { key: typeof activeTab; icon: React.ReactNode; label: string }[] = [
    { key: 'seo', icon: <Globe size={16} />, label: 'Tối ưu SEO Domain' },
    { key: 'templates', icon: <Mail size={16} />, label: 'Email Templates' },
    { key: 'settings', icon: <Settings2 size={16} />, label: 'Email Settings' },
    { key: 'logs', icon: <ClipboardList size={16} />, label: 'Lịch sử gửi email' },
  ];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-800">Cấu hình CMS & SEO</h2>
        <p className="text-xs text-slate-500 font-medium">Quản lý SEO domain, mẫu email tự động, cấu hình SMTP và lịch sử gửi mail</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-6 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content panel */}
      {activeTab === 'templates' ? (
        <div className="animate-in fade-in duration-200"><EmailTemplatesTab /></div>
      ) : activeTab === 'settings' ? (
        <div className="animate-in fade-in duration-200"><EmailSettingsTab /></div>
      ) : loading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-6 animate-in fade-in duration-200">

          {/* TAB 1: SEO SETTINGS PER DOMAIN */}
          {activeTab === 'seo' && seoMode === 'list' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Lọc theo domain..."
                    value={seoFilter}
                    onChange={(e) => setSeoFilter(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary"
                  />
                </div>
                <button onClick={openSeoCreate} className="primary-action">
                  <Plus size={15} strokeWidth={1.5} /> Thêm cấu hình SEO
                </button>
              </div>

              {filteredSeoList.length === 0 ? (
                <EmptyState
                  message={seoList.length === 0 ? 'Chưa có cấu hình SEO cho domain nào.' : 'Không có domain nào khớp bộ lọc.'}
                  subMessage={seoList.length === 0 ? 'Bấm "Thêm cấu hình SEO" để tạo cấu hình cho domain đầu tiên.' : undefined}
                />
              ) : (
                <div className="bg-white rounded-[20px] border border-[#ECECEC] shadow-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-primary/5 text-slate-400 border-b border-slate-100 uppercase tracking-wider text-[9px] font-bold">
                          <th className="p-4 pl-6">Domain</th>
                          <th className="p-4">SEO Title</th>
                          <th className="p-4">Ảnh chia sẻ</th>
                          <th className="p-4">Ngày cập nhật</th>
                          <th className="p-4">Người cập nhật</th>
                          <th className="p-4 pr-6 text-center">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSeoList.map(s => (
                          <tr key={s.id} className="border-b border-slate-100 last:border-b-0 hover:bg-primary/5 transition-colors">
                            <td className="p-4 pl-6">
                              <div className="font-bold text-slate-900 font-mono">{s.domain}</div>
                              {s.canonical_url && <div className="text-[10px] text-slate-400 mt-0.5">{s.canonical_url}</div>}
                            </td>
                            <td className="p-4 text-slate-600 font-semibold max-w-[220px] truncate">{s.meta_title || '—'}</td>
                            <td className="p-4">
                              {s.og_image ? (
                                <img
                                  src={s.og_image}
                                  alt={`OG ${s.domain}`}
                                  className="w-16 h-9 object-cover rounded-lg border border-slate-200 bg-slate-50"
                                />
                              ) : (
                                <span className="w-16 h-9 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-300">
                                  <ImageIcon size={14} strokeWidth={1.5} />
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-slate-500 whitespace-nowrap">
                              {new Date(s.updated_at || s.created_at).toLocaleString('vi-VN')}
                            </td>
                            <td className="p-4 text-slate-500 font-medium">{s.updated_by_name || '—'}</td>
                            <td className="p-4 pr-6">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => setSeoPreviewRow(s)}
                                  className="p-2 text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 rounded-2xl transition-all btn-press"
                                  title="Preview SEO"
                                >
                                  <Eye size={13} strokeWidth={1.5} />
                                </button>
                                <button
                                  onClick={() => openSeoEdit(s)}
                                  className="p-2 text-primary hover:bg-primary/10 border border-transparent hover:border-primary/20 rounded-2xl transition-all btn-press"
                                  title="Chỉnh sửa"
                                >
                                  <Edit3 size={13} strokeWidth={1.5} />
                                </button>
                                <button
                                  onClick={() => handleDeleteSeo(s)}
                                  className="p-2 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-2xl transition-all btn-press"
                                  title="Xóa cấu hình"
                                >
                                  <Trash2 size={13} strokeWidth={1.5} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Preview SEO modal: Google Search + Facebook share */}
              {seoPreviewRow && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setSeoPreviewRow(null)}>
                  <div className="bg-white rounded-[20px] shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-4" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                        <Eye size={15} /> Preview SEO: <span className="font-mono">{seoPreviewRow.domain}</span>
                      </h4>
                      <button onClick={() => setSeoPreviewRow(null)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-2xl"><X size={16} /></button>
                    </div>
                    <div className="space-y-1.5">
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><Search size={11} /> Google Search</h5>
                      <GooglePreview data={seoPreviewRow} />
                    </div>
                    <div className="space-y-1.5">
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><Facebook size={11} /> Chia sẻ Facebook</h5>
                      <FacebookPreview data={seoPreviewRow} />
                    </div>
                    <div className="space-y-1.5">
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><ClipboardList size={11} /> AI Preview</h5>
                      <AIPreview data={seoPreviewRow} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'seo' && seoMode === 'form' && (
            <form onSubmit={handleSaveSeo} className="space-y-6">
              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-[20px] border border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {editingSeo ? `Chỉnh sửa SEO: ${editingSeo.domain}` : 'Thêm cấu hình SEO mới'}
                  </h3>
                  <span className="text-[10px] text-slate-400">Mỗi domain chỉ có một cấu hình SEO duy nhất · Khi lưu, hệ thống tự sinh đầy đủ thẻ meta, OpenGraph, Twitter Card, Canonical</span>
                </div>
                <button
                  type="button"
                  onClick={closeSeoForm}
                  className="px-3.5 py-1.5 text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-2xl transition-all"
                >
                  Quay lại danh sách
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Left column: domain + meta info + OG/Twitter text */}
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-[20px] border border-[#ECECEC] shadow-card space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Thông tin domain & meta</h4>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">Domain *</label>
                      <input
                        type="text"
                        placeholder="giatky.vn hoặc https://www.giatky.vn"
                        value={seoForm.domain}
                        onChange={(e) => { setSeoForm(p => ({ ...p, domain: e.target.value })); setSeoDomainError(''); }}
                        className={`w-full px-3 py-2 border rounded-2xl text-xs outline-none focus:border-primary font-mono ${seoDomainError ? 'border-rose-300' : 'border-slate-200'}`}
                      />
                      {seoDomainError
                        ? <p className="text-[10px] text-rose-600 font-semibold">{seoDomainError}</p>
                        : <p className="text-[10px] text-slate-400">Hệ thống tự chuẩn hóa: bỏ https://, www., dấu / cuối và chuyển chữ thường.</p>}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">Tiêu đề SEO mặc định (Meta Title)</label>
                      <input
                        type="text"
                        value={seoForm.meta_title}
                        onChange={(e) => setSeoForm(p => ({ ...p, meta_title: e.target.value }))}
                        className={inputCls}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">Mô tả SEO mặc định (Meta Description)</label>
                      <textarea
                        value={seoForm.meta_description}
                        onChange={(e) => setSeoForm(p => ({ ...p, meta_description: e.target.value }))}
                        className="w-full p-3 border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary min-h-20"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">Từ khóa SEO (ngăn cách bằng dấu phẩy)</label>
                      <input
                        type="text"
                        value={seoForm.keywords}
                        onChange={(e) => setSeoForm(p => ({ ...p, keywords: e.target.value }))}
                        className={inputCls}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600">Canonical URL</label>
                        <input
                          type="text"
                          placeholder="Để trống sẽ tự dùng https://domain"
                          value={seoForm.canonical_url}
                          onChange={(e) => setSeoForm(p => ({ ...p, canonical_url: e.target.value }))}
                          className={`${inputCls} font-mono`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600">Robots</label>
                        <select
                          value={seoForm.robots}
                          onChange={(e) => setSeoForm(p => ({ ...p, robots: e.target.value }))}
                          className={`${inputCls} font-mono`}
                        >
                          {ROBOTS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-[20px] border border-[#ECECEC] shadow-card space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Open Graph (Facebook, Zalo...)</h4>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">OG Title</label>
                      <input type="text" placeholder="Để trống sẽ dùng Meta Title" value={seoForm.og_title} onChange={(e) => setSeoForm(p => ({ ...p, og_title: e.target.value }))} className={inputCls} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">OG Description</label>
                      <textarea placeholder="Để trống sẽ dùng Meta Description" value={seoForm.og_description} onChange={(e) => setSeoForm(p => ({ ...p, og_description: e.target.value }))} className="w-full p-3 border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary min-h-16" />
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-[20px] border border-[#ECECEC] shadow-card space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Twitter Card</h4>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">Loại card</label>
                      <select value={seoForm.twitter_card} onChange={(e) => setSeoForm(p => ({ ...p, twitter_card: e.target.value }))} className={inputCls}>
                        {TWITTER_CARD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">Twitter Title</label>
                      <input type="text" placeholder="Để trống sẽ dùng OG Title / Meta Title" value={seoForm.twitter_title} onChange={(e) => setSeoForm(p => ({ ...p, twitter_title: e.target.value }))} className={inputCls} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">Twitter Description</label>
                      <textarea placeholder="Để trống sẽ dùng OG Description / Meta Description" value={seoForm.twitter_description} onChange={(e) => setSeoForm(p => ({ ...p, twitter_description: e.target.value }))} className="w-full p-3 border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary min-h-16" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">Twitter Image</label>
                      <div className="flex items-center gap-2.5">
                        {twitterImageUrl ? (
                          <img src={twitterImageUrl} alt="Twitter" className="w-16 h-9 object-cover rounded-lg border border-slate-200 bg-slate-50" />
                        ) : (
                          <span className="w-16 h-9 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-300 shrink-0">
                            <ImageIcon size={14} strokeWidth={1.5} />
                          </span>
                        )}
                        <button type="button" onClick={() => twitterInputRef.current?.click()} disabled={uploadingKind === 'twitter'} className="px-3 py-2 bg-primary/10 hover:bg-primary/15 text-primary rounded-2xl text-xs font-bold transition-all btn-press">
                          {uploadingKind === 'twitter' ? 'Đang upload...' : twitterImageUrl ? 'Thay ảnh' : 'Upload ảnh'}
                        </button>
                        {twitterImageUrl && (
                          <button type="button" onClick={() => setTwitterImageUrl('')} className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-2xl text-xs font-bold transition-all btn-press">Gỡ</button>
                        )}
                        <input ref={twitterInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleExtraImageSelect(e.target.files?.[0], 'twitter')} />
                      </div>
                      <p className="text-[10px] text-slate-400">Để trống sẽ dùng ảnh Open Graph.</p>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-[20px] border border-[#ECECEC] shadow-card space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Favicon</h4>
                    <div className="flex items-center gap-2.5">
                      {faviconUrl ? (
                        <img src={faviconUrl} alt="Favicon" className="w-9 h-9 object-contain rounded-lg border border-slate-200 bg-slate-50 p-1" />
                      ) : (
                        <span className="w-9 h-9 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-300 shrink-0">
                          <ImageIcon size={14} strokeWidth={1.5} />
                        </span>
                      )}
                      <button type="button" onClick={() => faviconInputRef.current?.click()} disabled={uploadingKind === 'favicon'} className="px-3 py-2 bg-primary/10 hover:bg-primary/15 text-primary rounded-2xl text-xs font-bold transition-all btn-press">
                        {uploadingKind === 'favicon' ? 'Đang upload...' : faviconUrl ? 'Thay favicon' : 'Upload favicon'}
                      </button>
                      {faviconUrl && (
                        <button type="button" onClick={() => setFaviconUrl('')} className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-2xl text-xs font-bold transition-all btn-press">Gỡ</button>
                      )}
                      <input ref={faviconInputRef} type="file" accept="image/x-icon,image/vnd.microsoft.icon,image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => handleExtraImageSelect(e.target.files?.[0], 'favicon')} />
                    </div>
                    <p className="text-[10px] text-slate-400">Hỗ trợ ICO, PNG, JPG, WEBP · Khuyến nghị 32 × 32 px hoặc 48 × 48 px.</p>
                  </div>
                </div>

                {/* Right column: image upload + previews */}
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-[20px] border border-[#ECECEC] shadow-card space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Ảnh đại diện chia sẻ (Open Graph)</h4>

                    {previewImageUrl ? (
                      <div className="space-y-3">
                        <img
                          src={previewImageUrl}
                          alt="OG preview"
                          className="w-full aspect-[1200/630] object-cover rounded-2xl border border-slate-200 bg-slate-50"
                        />
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="truncate font-medium">
                            {pendingImage ? pendingImage.original_name : 'Ảnh đang lưu trong Supabase Storage'}
                          </span>
                          {pendingImage && <span className="font-mono font-semibold ml-2 shrink-0">{formatFileSize(pendingImage.size)}</span>}
                        </div>
                        <div className="flex gap-2.5">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingImage}
                            className="flex-1 py-2 bg-primary/10 hover:bg-primary/15 text-primary rounded-2xl text-xs font-bold transition-all btn-press"
                          >
                            {uploadingImage ? 'Đang upload...' : 'Thay ảnh'}
                          </button>
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            disabled={uploadingImage}
                            className="flex-1 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-2xl text-xs font-bold transition-all btn-press"
                          >
                            Xóa ảnh
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => !uploadingImage && fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                        onDragLeave={() => setDragActive(false)}
                        onDrop={(e) => { e.preventDefault(); setDragActive(false); handleImageSelect(e.dataTransfer.files?.[0]); }}
                        className={`border-2 border-dashed rounded-[24px] p-8 text-center cursor-pointer transition-all ${
                          dragActive ? 'border-primary bg-primary/10' : 'border-primary/20 bg-primary/5 hover:bg-primary/10'
                        }`}
                      >
                        <UploadCloud className="mx-auto text-slate-400 mb-2" size={28} strokeWidth={1.5} />
                        <p className="text-xs font-bold text-slate-700">
                          {uploadingImage ? 'Đang upload ảnh...' : 'Kéo ảnh vào đây hoặc bấm để chọn'}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                          Hỗ trợ: JPG, JPEG, PNG, WEBP · Tối đa 5 MB<br />
                          Kích thước khuyến nghị: 1200 × 630 px
                        </p>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => handleImageSelect(e.target.files?.[0])}
                    />
                    {imageRemoved && !pendingImage && (
                      <p className="text-[10px] text-amber-600 font-semibold">
                        Ảnh sẽ được gỡ khỏi cấu hình và xóa khỏi Storage khi bấm Lưu.
                      </p>
                    )}
                  </div>

                  {/* Google preview */}
                  <div className="bg-white p-6 rounded-[20px] border border-[#ECECEC] shadow-card space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-1.5">
                      <Eye size={13} strokeWidth={1.5} /> Google Preview
                    </h4>
                    <GooglePreview data={formPreviewData} />
                  </div>

                  {/* Facebook preview */}
                  <div className="bg-white p-6 rounded-[20px] border border-[#ECECEC] shadow-card space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-1.5">
                      <Facebook size={13} strokeWidth={1.5} /> Facebook Preview
                    </h4>
                    <FacebookPreview data={formPreviewData} />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingSeo || uploadingImage || uploadingKind !== ''}
                className="w-full lg:w-auto px-8 py-3 bg-primary hover:bg-primary-dark disabled:bg-secondary text-white rounded-2xl font-bold text-xs shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-1.5"
              >
                <Save size={14} /> {savingSeo ? 'Đang lưu...' : editingSeo ? 'Lưu cấu hình' : 'Tạo cấu hình SEO'}
              </button>
            </form>
          )}

          {/* TAB 4: EMAIL LOGS */}
          {activeTab === 'logs' && (
            <div className="bg-white rounded-[20px] border border-[#ECECEC] shadow-card overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-primary/5 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Lịch sử thư tín hệ thống</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase tracking-wider text-[10px] font-semibold">
                      <th className="p-4">Người nhận</th>
                      <th className="p-4">Tiêu đề</th>
                      <th className="p-4">Trạng thái</th>
                      <th className="p-4">Thời gian gửi</th>
                      <th className="p-4">Người gửi/Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emailLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400">Hệ thống chưa gửi email nào.</td>
                      </tr>
                    ) : (
                      emailLogs.map(log => (
                        <tr key={log.id} className="border-b border-slate-100 last:border-b-0 hover:bg-primary/5">
                          <td className="p-4 font-bold text-slate-800">{log.to_email}</td>
                          <td className="p-4 text-slate-600 font-medium">{log.subject}</td>
                          <td className="p-4">
                            {log.status === 'sent' ? (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-0.5 w-fit">
                                <CheckCircle size={10} /> Đã gửi
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-0.5 w-fit" title={log.error_message}>
                                <XCircle size={10} /> Thất bại
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-slate-400">
                            {new Date(log.created_at).toLocaleString('vi-VN')}
                          </td>
                          <td className="p-4 text-slate-500 font-medium">
                            {log.sender_name || 'Hệ thống tự động'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default Cms;
