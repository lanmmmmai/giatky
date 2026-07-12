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
import {
  getEmailTemplates, createEmailTemplate, updateEmailTemplate, deleteEmailTemplate,
  getEmailLogs, EmailTemplate, EmailLog, EMAIL_TEMPLATE_TYPES,
} from '../../api/email';
import { useToastStore } from '../../stores/toastStore';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import {
  Globe, Mail, Eye, Edit3, ClipboardList, CheckCircle, XCircle, Save,
  Plus, Trash2, UploadCloud, Image as ImageIcon, X, Search
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

// Client-side HTML sanitizer for the email preview (project has no sanitize
// library; combined with an empty-sandbox iframe as defense in depth)
const sanitizeHtml = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, iframe, object, embed, form, link, meta, base').forEach(el => el.remove());
  doc.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith('on') || ((name === 'href' || name === 'src' || name === 'xlink:href') && value.startsWith('javascript:'))) {
        el.removeAttribute(attr.name);
      }
    });
  });
  return '<!doctype html>' + (doc.documentElement?.outerHTML || '');
};

// Convert plain text (with {{variables}}) into readable, indented email HTML
const generateHtmlFromText = (text: string): string => {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `      <p style="margin: 0 0 16px;">\n        ${p.replace(/\n/g, '<br />\n        ')}\n      </p>`)
    .join('\n');
  return `<html>
  <body style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6; margin: 0;">
    <div style="max-width: 640px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #6C63FF; margin: 0 0 16px;">Giặt Ký</h2>
${paragraphs}
    </div>
  </body>
</html>`;
};

const Cms: React.FC = () => {
  const { addToast } = useToastStore();
  const [activeTab, setActiveTab] = useState<'seo' | 'templates' | 'logs'>('seo');
  const [loading, setLoading] = useState(true);

  // Data states
  const [seoList, setSeoList] = useState<SeoSettings[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);

  // SEO tab: list <-> form
  const [seoMode, setSeoMode] = useState<'list' | 'form'>('list');
  const [editingSeo, setEditingSeo] = useState<SeoSettings | null>(null);
  const [seoFilter, setSeoFilter] = useState('');
  const [seoForm, setSeoForm] = useState({ domain: '', meta_title: '', meta_description: '', keywords: '', canonical_url: '' });
  const [seoDomainError, setSeoDomainError] = useState('');
  const [savingSeo, setSavingSeo] = useState(false);

  // OG image upload state — file is always uploaded through the backend, never a URL input
  const [pendingImage, setPendingImage] = useState<SeoImageUploadResult | null>(null);
  const [savedImageUrl, setSavedImageUrl] = useState('');
  const [imageRemoved, setImageRemoved] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editing state - Template (list <-> form; form serves both create and edit)
  const [templateMode, setTemplateMode] = useState<'list' | 'form'>('list');
  const [editingTemplateId, setEditingTemplateId] = useState('');
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateBody, setTemplateBody] = useState('');       // html_content
  const [templateBodyText, setTemplateBodyText] = useState(''); // text_content
  const [templateName, setTemplateName] = useState('');
  const [templateType, setTemplateType] = useState('');
  const [templateVariables, setTemplateVariables] = useState<string[]>([]);
  const [templateIsActive, setTemplateIsActive] = useState(true);
  const [templateErrors, setTemplateErrors] = useState<{ name?: string; type?: string; subject?: string; content?: string }>({});
  const [savingTemplate, setSavingTemplate] = useState(false);
  // Content editor UI state — active_editor_mode is UI-only, not persisted
  const [editorMode, setEditorMode] = useState<'text' | 'html'>('text');
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const htmlAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'seo') {
        const data = await getSeoSettings();
        setSeoList(data);
      } else if (activeTab === 'templates') {
        const data = await getEmailTemplates();
        setTemplates(data);
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
    setSeoForm({ domain: '', meta_title: '', meta_description: '', keywords: '', canonical_url: '' });
    setSeoDomainError('');
    setPendingImage(null);
    setSavedImageUrl('');
    setImageRemoved(false);
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
    });
    setSeoDomainError('');
    setPendingImage(null);
    setSavedImageUrl(s.og_image || '');
    setImageRemoved(false);
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
      domain: domainValue,
      meta_title: seoForm.meta_title,
      meta_description: seoForm.meta_description,
      keywords: seoForm.keywords,
      canonical_url: seoForm.canonical_url,
      og_image: effectiveImage,
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
    if (!window.confirm(`Xóa cấu hình SEO của domain "${s.domain}"? Hành động này không thể hoàn tác.`)) return;
    try {
      await deleteSeoSettings(s.id);
      addToast('Đã xóa cấu hình SEO.', 'success');
      loadData();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Xóa cấu hình SEO thất bại.', 'error');
    }
  };

  const previewImageUrl = pendingImage ? pendingImage.public_url : (imageRemoved ? '' : savedImageUrl);
  const filteredSeoList = seoList.filter(s => !seoFilter.trim() || s.domain.toLowerCase().includes(seoFilter.trim().toLowerCase()));

  /* ─────────────── Email template handlers (unchanged) ─────────────── */

  const resetTemplateForm = () => {
    setEditingTemplateId('');
    setTemplateName('');
    setTemplateType('');
    setTemplateSubject('');
    setTemplateBody('');
    setTemplateBodyText('');
    setTemplateVariables([]);
    setTemplateIsActive(true);
    setTemplateErrors({});
    setEditorMode('text');
    setShowHtmlPreview(false);
  };

  const openCreateTemplate = () => {
    resetTemplateForm();
    setTemplateMode('form');
  };

  const handleEditTemplate = (tmpl: EmailTemplate) => {
    setEditingTemplateId(tmpl.id);
    setTemplateSubject(tmpl.subject);
    setTemplateBody(tmpl.body_html);
    setTemplateBodyText(tmpl.body_text || '');
    setTemplateName(tmpl.name);
    setTemplateType(tmpl.type);
    setTemplateVariables(tmpl.variables || []);
    setTemplateIsActive(tmpl.is_active);
    setTemplateErrors({});
    setEditorMode('text');
    setShowHtmlPreview(false);
    setTemplateMode('form');
  };

  const handleDeleteTemplate = async (tmpl: EmailTemplate) => {
    if (!window.confirm(`Xóa mẫu email "${tmpl.name}" (loại ${tmpl.type})? Hệ thống sẽ không gửi được loại email này cho đến khi tạo lại mẫu.`)) return;
    try {
      await deleteEmailTemplate(tmpl.id);
      addToast('Đã xóa mẫu email.', 'success');
      loadData();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Xóa mẫu email thất bại.', 'error');
    }
  };

  // Insert a variable chip at the caret of whichever editor is active
  const insertVariable = (v: string) => {
    const tag = `{{${v}}}`;
    const isText = editorMode === 'text';
    const ref = isText ? textAreaRef.current : htmlAreaRef.current;
    const value = isText ? templateBodyText : templateBody;
    const setter = isText ? setTemplateBodyText : setTemplateBody;
    if (ref) {
      const start = ref.selectionStart ?? value.length;
      const end = ref.selectionEnd ?? value.length;
      setter(value.slice(0, start) + tag + value.slice(end));
      requestAnimationFrame(() => {
        ref.focus();
        ref.selectionStart = ref.selectionEnd = start + tag.length;
      });
    } else {
      setter(value + tag);
    }
  };

  const handleCreateHtmlFromText = () => {
    if (!templateBodyText.trim()) {
      addToast('Vui lòng nhập nội dung văn bản thường trước.', 'warning');
      return;
    }
    if (templateBody.trim() && !window.confirm('Nội dung HTML hiện tại sẽ bị thay thế. Bạn có muốn tiếp tục?')) {
      return;
    }
    setTemplateBody(generateHtmlFromText(templateBodyText));
    addToast('Đã sinh mã HTML từ nội dung văn bản.', 'success');
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: typeof templateErrors = {};
    if (!templateName.trim()) errors.name = 'Tên mẫu không được để trống.';
    if (!editingTemplateId && !templateType) errors.type = 'Vui lòng chọn loại mẫu.';
    if (!templateSubject.trim()) errors.subject = 'Tiêu đề email không được để trống.';
    if (!templateBodyText.trim() && !templateBody.trim()) errors.content = 'Vui lòng nhập nội dung email.';
    setTemplateErrors(errors);
    if (Object.keys(errors).length > 0) return;

    // body_html is required by the schema — derive it from text when only text was entered
    let bodyHtml = templateBody;
    if (!bodyHtml.trim() && templateBodyText.trim()) {
      bodyHtml = generateHtmlFromText(templateBodyText);
      addToast('Đã tự động tạo HTML từ nội dung văn bản để lưu.', 'info');
    }
    if (bodyHtml.trim() && !templateBodyText.trim()) {
      addToast('Nên có nội dung văn bản dự phòng cho các trình đọc email không hỗ trợ HTML.', 'warning');
    }

    setSavingTemplate(true);
    try {
      if (editingTemplateId) {
        await updateEmailTemplate(editingTemplateId, {
          name: templateName,
          subject: templateSubject,
          body_html: bodyHtml,
          body_text: templateBodyText,
          is_active: templateIsActive,
        });
        addToast('Đã lưu mẫu email cập nhật.', 'success');
      } else {
        await createEmailTemplate({
          name: templateName,
          type: templateType,
          subject: templateSubject,
          body_html: bodyHtml,
          body_text: templateBodyText,
          variables: templateVariables,
          is_active: templateIsActive,
        });
        addToast('Đã tạo mẫu email mới.', 'success');
      }
      resetTemplateForm();
      setTemplateMode('list');
      loadData();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Lưu mẫu email thất bại.', 'error');
    } finally {
      setSavingTemplate(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-800">Cấu hình CMS & SEO</h2>
        <p className="text-xs text-slate-500 font-medium">Quản lý nội dung mẫu thư tự động, tra cứu lịch sử gửi mail và tối ưu hóa SEO</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('seo')}
          className={`flex items-center gap-1.5 px-6 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'seo' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Globe size={16} /> Tối ưu SEO Domain
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex items-center gap-1.5 px-6 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'templates' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Mail size={16} /> Mẫu email tự động
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-1.5 px-6 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'logs' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ClipboardList size={16} /> Lịch sử gửi email
        </button>
      </div>

      {/* Content panel */}
      {loading ? (
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
            </div>
          )}

          {activeTab === 'seo' && seoMode === 'form' && (
            <form onSubmit={handleSaveSeo} className="space-y-6">
              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-[20px] border border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {editingSeo ? `Chỉnh sửa SEO: ${editingSeo.domain}` : 'Thêm cấu hình SEO mới'}
                  </h3>
                  <span className="text-[10px] text-slate-400">Mỗi domain chỉ có một cấu hình SEO duy nhất</span>
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
                {/* Left column: domain + meta info */}
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
                      className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary"
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
                      className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Canonical URL</label>
                    <input
                      type="text"
                      placeholder="Để trống sẽ tự dùng https://domain"
                      value={seoForm.canonical_url}
                      onChange={(e) => setSeoForm(p => ({ ...p, canonical_url: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary font-mono"
                    />
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
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-emerald-700 font-medium truncate">
                        {seoForm.canonical_url || (seoForm.domain ? `https://${seoForm.domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '')}` : 'https://ten-mien-cua-ban.vn')}
                      </p>
                      <p className="text-sm text-blue-700 font-medium leading-snug line-clamp-1">
                        {seoForm.meta_title || 'Tiêu đề SEO sẽ hiển thị tại đây'}
                      </p>
                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                        {seoForm.meta_description || 'Mô tả SEO mặc định của domain sẽ hiển thị tại đây khi người dùng tìm kiếm trên Google.'}
                      </p>
                    </div>
                  </div>

                  {/* Social preview */}
                  <div className="bg-white p-6 rounded-[20px] border border-[#ECECEC] shadow-card space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-1.5">
                      <Globe size={13} strokeWidth={1.5} /> Social Preview
                    </h4>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
                      {previewImageUrl ? (
                        <img src={previewImageUrl} alt="Social preview" className="w-full aspect-[1200/630] object-cover" />
                      ) : (
                        <div className="w-full aspect-[1200/630] flex flex-col items-center justify-center text-slate-300 gap-1.5">
                          <ImageIcon size={26} strokeWidth={1.5} />
                          <span className="text-[10px] font-semibold text-slate-400">Chưa có ảnh chia sẻ</span>
                        </div>
                      )}
                      <div className="p-3 bg-white border-t border-slate-100 space-y-0.5">
                        <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide truncate">
                          {seoForm.domain.trim() || 'ten-mien-cua-ban.vn'}
                        </p>
                        <p className="text-xs font-bold text-slate-800 line-clamp-1">{seoForm.meta_title || 'Tiêu đề SEO'}</p>
                        <p className="text-[11px] text-slate-500 line-clamp-1">{seoForm.meta_description || 'Mô tả SEO'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingSeo || uploadingImage}
                className="w-full lg:w-auto px-8 py-3 bg-primary hover:bg-primary-dark disabled:bg-secondary text-white rounded-2xl font-bold text-xs shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-1.5"
              >
                <Save size={14} /> {savingSeo ? 'Đang lưu...' : editingSeo ? 'Lưu cấu hình' : 'Tạo cấu hình SEO'}
              </button>
            </form>
          )}

          {/* TAB 2: EMAIL TEMPLATES */}
          {activeTab === 'templates' && (
            editingTemplateId ? (
              <div className="space-y-6">
                {/* Header with cancel button */}
                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-[20px] border border-slate-200">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Biên tập: {templateName}</h3>
                    <span className="text-[10px] text-slate-400 font-mono">Loại: {templateType}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingTemplateId('')}
                    className="px-3.5 py-1.5 text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-2xl transition-all"
                  >
                    Quay lại danh sách
                  </button>
                </div>

                <form onSubmit={handleSaveTemplate} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  {/* Editor Panel (2 cols) */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Card 1: Thông tin email */}
                    <div className="bg-white p-5 rounded-[20px] border border-[#ECECEC] shadow-card space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                        <span className="p-1.5 bg-primary/10 text-primary rounded-lg"><Mail size={16} /></span>
                        <h4 className="font-bold text-slate-800 text-xs">Card 1: Thông tin email</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-500">Loại template</label>
                          <input
                            type="text"
                            value={templateType}
                            disabled
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono text-slate-500 outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-600">Tiêu đề thư (Subject) *</label>
                          <input
                            type="text"
                            value={templateSubject}
                            onChange={(e) => setTemplateSubject(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary"
                            placeholder="Nhập tiêu đề thư gửi..."
                            required
                          />
                        </div>
                      </div>
                      {templateVariables.length > 0 && (
                        <div className="pt-2">
                          <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Các biến được hỗ trợ:</div>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {templateVariables.map(v => (
                              <span key={v} className="bg-slate-100 px-2 py-0.5 rounded text-[9px] font-mono font-bold text-slate-600">
                                {`{{${v}}}`}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card 2: Nội dung text thường */}
                    <div className="bg-white p-5 rounded-[20px] border border-[#ECECEC] shadow-card space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                        <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><ClipboardList size={16} /></span>
                        <h4 className="font-bold text-slate-800 text-xs">Card 2: Nội dung text thường</h4>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600">Nội dung văn bản</label>
                        <p className="text-[10px] text-slate-400">Dùng cho người quản lý nhập nội dung dễ đọc. Hệ thống có thể dùng nội dung này làm bản text fallback khi gửi email.</p>
                        <textarea
                          value={templateBodyText}
                          onChange={(e) => setTemplateBodyText(e.target.value)}
                          className="w-full p-3 border border-slate-200 rounded-2xl outline-none min-h-36 text-xs text-slate-700"
                          placeholder={`Xin chào {{full_name}},\nChúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.\nVui lòng bấm vào link sau để đặt lại mật khẩu:\n{{reset_link}}\n\nTrân trọng,\nĐội ngũ Giặt Ký`}
                        />
                      </div>
                    </div>

                    {/* Card 3: Nội dung HTML */}
                    <div className="bg-white p-5 rounded-[20px] border border-[#ECECEC] shadow-card space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 bg-violet-50 text-violet-600 rounded-lg"><Globe size={16} /></span>
                          <h4 className="font-bold text-slate-800 text-xs">Card 3: Nội dung HTML *</h4>
                        </div>
                        <button
                          type="button"
                          onClick={handleCreateHtmlFromText}
                          className="px-3 py-1.5 bg-primary/10 hover:bg-primary/15 text-primary text-[11px] font-bold rounded-2xl transition-all"
                        >
                          Tạo HTML từ text
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-slate-400">Dùng để tùy chỉnh giao diện email. Có thể dùng các biến như {"{{full_name}}"}, {"{{reset_link}}"}, {"{{verify_link}}"}.</p>
                        <textarea
                          value={templateBody}
                          onChange={(e) => setTemplateBody(e.target.value)}
                          className="w-full p-3 border border-slate-200 rounded-2xl outline-none min-h-60 font-mono text-[10px]"
                          required
                        />
                      </div>
                    </div>

                    {/* Action row */}
                    <button
                      type="submit"
                      className="w-full py-3 bg-primary hover:bg-primary-dark text-white rounded-[20px] font-bold flex items-center justify-center gap-2 shadow-lg active:scale-[0.99] transition-all"
                    >
                      <Save size={16} /> Lưu mẫu email
                    </button>
                  </div>

                  {/* Preview Panel (1 col) */}
                  <div className="space-y-4 lg:sticky lg:top-4">
                    <div className="bg-white p-5 rounded-[20px] border border-[#ECECEC] shadow-card space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                        <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><Eye size={16} /></span>
                        <h4 className="font-bold text-slate-800 text-xs">Card 4: Xem trước email</h4>
                      </div>

                      <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50 min-h-96">
                        {templateBody.trim() ? (
                          <iframe
                            title="Email Preview"
                            srcDoc={templateBody}
                            className="w-full min-h-96 border-none bg-white"
                            sandbox="allow-same-origin"
                          />
                        ) : (
                          <div className="p-8 text-center text-slate-400 text-xs font-medium py-32 whitespace-pre-wrap">
                            {templateBodyText ? templateBodyText : 'Chưa có nội dung xem trước'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Danh sách các loại mẫu</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {templates.map(tmpl => (
                    <div key={tmpl.id} className="bg-white p-5 rounded-[20px] border border-[#ECECEC] shadow-card space-y-3 hover:border-primary transition-colors flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                          <div>
                            <h4 className="font-bold text-slate-800 text-xs">{tmpl.name}</h4>
                            <span className="text-[10px] font-mono text-slate-400">Loại: {tmpl.type}</span>
                          </div>
                          <button
                            onClick={() => handleEditTemplate(tmpl)}
                            className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          >
                            <Edit3 size={14} />
                          </button>
                        </div>
                        <p className="text-xs text-slate-600 font-bold">Tiêu đề gửi: <span className="font-medium text-slate-500">{tmpl.subject}</span></p>
                      </div>

                      <div className="pt-2">
                        <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Biến hỗ trợ:</div>
                        <div className="flex flex-wrap gap-1.5">
                          {(tmpl.variables || []).map(v => (
                            <span key={v} className="bg-slate-100 px-2 py-0.5 rounded text-[9px] font-mono font-bold text-slate-600">
                              {`{{${v}}}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          {/* TAB 3: EMAIL LOGS */}
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
