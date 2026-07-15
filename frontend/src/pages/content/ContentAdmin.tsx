import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createPost,
  deletePost,
  duplicatePost,
  getAdminPosts,
  getJobApplication,
  getJobApplicationLogs,
  getJobApplications,
  JobApplication,
  JobShift,
  Post,
  PostPayload,
  publishPost,
  unpublishPost,
  updateJobApplicationStatus,
  updatePost,
} from '../../api/content';
import { getBranches, Branch } from '../../api/branches';
import { uploadSeoImage } from '../../api/seo';
import { useToastStore } from '../../stores/toastStore';
import { useConfirm } from '../../components/ConfirmDialog';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { Copy, Eye, FileText, Image, Plus, Save, Search, Trash2, Upload, X } from 'lucide-react';

const typeLabels: Record<string, string> = {
  news: 'Tin tức',
  recruitment: 'Tuyển dụng',
  announcement: 'Thông báo',
  guide: 'Hướng dẫn',
  other: 'Khác',
};

const statusLabels: Record<string, string> = {
  draft: 'Nháp',
  pending: 'Chờ duyệt',
  published: 'Đã xuất bản',
  hidden: 'Đã ẩn',
  expired: 'Hết hạn',
  NEW: 'Mới',
  VIEWED: 'Đã xem',
  CONTACTING: 'Đang liên hệ',
  INTERVIEW_SCHEDULED: 'Hẹn phỏng vấn',
  INTERVIEW_PASSED: 'Đạt phỏng vấn',
  INTERVIEW_FAILED: 'Không đạt',
  HIRED: 'Đã nhận việc',
  REJECTED: 'Đã từ chối',
  ARCHIVED: 'Lưu hồ sơ',
};

// Danh sách ca chuẩn để admin chọn khi tạo bài tuyển dụng.
// 1 ca → ứng viên được tự gán; ≥2 ca → form ứng tuyển bắt buộc chọn.
const JOB_SHIFT_OPTIONS: JobShift[] = [
  { id: 'morning', name: 'Ca sáng', start_time: '07:00', end_time: '12:00' },
  { id: 'afternoon', name: 'Ca chiều', start_time: '12:00', end_time: '17:00' },
  { id: 'evening', name: 'Ca tối', start_time: '17:00', end_time: '22:00' },
  { id: 'office', name: 'Giờ hành chính', start_time: '08:00', end_time: '17:00' },
];

const emptyForm: PostPayload = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  post_type: 'news',
  status: 'draft',
  featured_image: '',
  category: '',
  tags: [],
  is_featured: false,
  sort_order: 0,
  meta_title: '',
  meta_description: '',
  keywords: '',
  canonical_url: '',
  og_image: '',
  allow_application_form: false,
  allow_comments: false,
  published_at: '',
  expired_at: '',
  job_post: null,
};

const slugify = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'd')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const ContentAdmin: React.FC = () => {
  const { addToast } = useToastStore();
  const confirm = useConfirm();
  const [tab, setTab] = useState<'posts' | 'applications'>('posts');
  const [posts, setPosts] = useState<Post[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingFeaturedImage, setUploadingFeaturedImage] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [appSearch, setAppSearch] = useState('');
  const [appStatus, setAppStatus] = useState('');
  const [form, setForm] = useState<PostPayload>(emptyForm);
  const [selectedApplication, setSelectedApplication] = useState<JobApplication | null>(null);
  const [applicationLogs, setApplicationLogs] = useState<any[]>([]);
  const [applicationNote, setApplicationNote] = useState('');

  useEffect(() => {
    loadBase();
  }, []);

  useEffect(() => {
    if (tab === 'posts') loadPosts();
    else loadApplications();
  }, [tab, typeFilter, statusFilter, appStatus]);

  const loadBase = async () => {
    setLoading(true);
    try {
      const [branchData] = await Promise.all([getBranches(), loadPosts()]);
      setBranches(branchData);
    } catch (_) {
      addToast('Không thể tải dữ liệu nội dung.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadPosts = async () => {
    const data = await getAdminPosts({
      search: search || undefined,
      post_type: typeFilter || undefined,
      status_filter: statusFilter || undefined,
    });
    setPosts(data);
    return data;
  };

  const loadApplications = async () => {
    setLoading(true);
    try {
      const data = await getJobApplications({
        search: appSearch || undefined,
        status_filter: appStatus || undefined,
      });
      setApplications(data);
    } catch (_) {
      addToast('Không thể tải hồ sơ ứng tuyển.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setUploadingFeaturedImage(false);
    setFormOpen(true);
  };

  const openEdit = (post: Post) => {
    setEditingId(post.id);
    setForm({
      ...emptyForm,
      ...post,
      tags: post.tags || [],
      published_at: post.published_at ? post.published_at.slice(0, 16) : '',
      expired_at: post.expired_at ? post.expired_at.slice(0, 16) : '',
      job_post: post.job_post ? {
        ...post.job_post,
        branch_ids: post.job_post.branches?.map(b => b.branch_id) || [],
      } : null,
    });
    setUploadingFeaturedImage(false);
    setFormOpen(true);
  };

  const updateForm = (field: keyof PostPayload, value: any) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'title' && !editingId && !prev.slug) next.slug = slugify(value);
      if (field === 'post_type' && value === 'recruitment' && !next.job_post) {
        next.job_post = { job_title: next.title, employment_type: 'shift', allow_online_application: true, branch_ids: [], shifts: [] };
        next.allow_application_form = true;
      }
      if (field === 'post_type' && value !== 'recruitment') {
        next.job_post = null;
        next.allow_application_form = false;
      }
      return next;
    });
  };

  const updateJob = (field: string, value: any) => {
    setForm(prev => {
      const nextJob: any = {
        ...(prev.job_post || { allow_online_application: true, branch_ids: [], shifts: [] }),
        [field]: value,
      };
      // Đổi sang hình thức khác "theo ca" thì bỏ ca đã chọn, tránh bài
      // full_time/part_time lỡ mang theo danh sách ca cũ.
      if (field === 'employment_type' && value !== 'shift') {
        nextJob.shifts = [];
      }
      return { ...prev, job_post: nextJob };
    });
  };

  const handleFeaturedImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('Vui lòng chọn file ảnh hợp lệ.', 'warning');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      addToast('Ảnh đại diện không được vượt quá 5 MB.', 'warning');
      return;
    }

    setUploadingFeaturedImage(true);
    try {
      const result = await uploadSeoImage(file, 'giatky.site', 'og');
      updateForm('featured_image', result.public_url);
      if (!form.og_image) updateForm('og_image', result.public_url);
      addToast('Upload ảnh đại diện thành công.', 'success');
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Upload ảnh đại diện thất bại.', 'error');
    } finally {
      setUploadingFeaturedImage(false);
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) {
      addToast('Vui lòng nhập tiêu đề bài viết.', 'warning');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        slug: form.slug || slugify(form.title),
        tags: typeof form.tags === 'string' ? String(form.tags).split(',').map(t => t.trim()).filter(Boolean) : form.tags,
        published_at: form.published_at || undefined,
        expired_at: form.expired_at || undefined,
        job_post: form.job_post ? {
          ...form.job_post,
          application_deadline: form.job_post.application_deadline || undefined,
          receiving_email: form.job_post.receiving_email || undefined,
          recruiter_id: form.job_post.recruiter_id || undefined,
        } : null,
      };
      if (editingId) {
        await updatePost(editingId, payload);
        addToast('Cập nhật bài viết thành công.', 'success');
      } else {
        await createPost(payload);
        addToast('Tạo bài viết thành công.', 'success');
      }
      setFormOpen(false);
      await loadPosts();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Không thể lưu bài viết.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (post: Post) => {
    await confirm({
      title: 'Xóa bài viết?',
      description: 'Bài viết sẽ được xóa mềm và không còn hiển thị trong danh sách công khai.',
      objectName: post.title,
      confirmText: 'Xóa bài viết',
      variant: 'danger',
      disableBackdropClose: true,
      onConfirm: async () => {
        try {
          await deletePost(post.id);
          addToast('Đã xóa bài viết.', 'success');
          await loadPosts();
        } catch (err: any) {
          addToast(err.response?.data?.detail || 'Xóa bài viết thất bại.', 'error');
          throw err;
        }
      },
    });
  };

  const handlePostAction = async (post: Post, action: 'publish' | 'hide' | 'duplicate') => {
    try {
      if (action === 'publish') await publishPost(post.id);
      if (action === 'hide') await unpublishPost(post.id);
      if (action === 'duplicate') await duplicatePost(post.id);
      addToast(action === 'publish' ? 'Đã xuất bản bài viết.' : action === 'hide' ? 'Đã ẩn bài viết.' : 'Đã nhân bản bài viết.', 'success');
      await loadPosts();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Thao tác thất bại.', 'error');
    }
  };

  const updateApplication = async (application: JobApplication, status: string) => {
    try {
      const updated = await updateJobApplicationStatus(application.id, { status });
      addToast('Đã cập nhật trạng thái hồ sơ.', 'success');
      if (selectedApplication?.id === application.id) setSelectedApplication({ ...selectedApplication, ...updated });
      await loadApplications();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Không thể cập nhật hồ sơ.', 'error');
    }
  };

  const openApplication = async (application: JobApplication) => {
    try {
      const [detail, logs] = await Promise.all([
        getJobApplication(application.id),
        getJobApplicationLogs(application.id),
      ]);
      setSelectedApplication(detail);
      setApplicationNote(detail.internal_note || '');
      setApplicationLogs(logs || []);
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Không thể tải chi tiết hồ sơ.', 'error');
    }
  };

  const saveApplicationNote = async () => {
    if (!selectedApplication) return;
    try {
      const updated = await updateJobApplicationStatus(selectedApplication.id, { internal_note: applicationNote });
      setSelectedApplication({ ...selectedApplication, ...updated, internal_note: applicationNote });
      setApplicationLogs(await getJobApplicationLogs(selectedApplication.id));
      await loadApplications();
      addToast('Đã lưu ghi chú hồ sơ.', 'success');
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Không thể lưu ghi chú.', 'error');
    }
  };

  const filteredApplications = applications;

  if (loading && posts.length === 0 && tab === 'posts') return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Nội dung & tuyển dụng</h2>
          <p className="text-xs text-slate-500">Quản lý bài viết, tin tuyển dụng và hồ sơ ứng viên</p>
        </div>
        {tab === 'posts' && (
          <button onClick={openCreate} className="px-4 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-2xl text-xs font-bold shadow-sm transition-all active:scale-95 flex items-center gap-1.5">
            <Plus size={16} /> Thêm bài viết
          </button>
        )}
      </div>

      <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
        <button onClick={() => setTab('posts')} className={`px-4 py-2 rounded-xl text-xs font-bold ${tab === 'posts' ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Bài viết</button>
        <button onClick={() => setTab('applications')} className={`px-4 py-2 rounded-xl text-xs font-bold ${tab === 'applications' ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Hồ sơ ứng tuyển</button>
      </div>

      {tab === 'posts' ? (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-[20px] border border-[#E5E7EB] shadow-card flex flex-wrap gap-3 items-center">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadPosts()} placeholder="Tìm bài viết..." className="pl-9 pr-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary" />
            </div>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-2xl text-xs bg-white">
              <option value="">Tất cả loại</option>
              {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-2xl text-xs bg-white">
              <option value="">Tất cả trạng thái</option>
              {['draft', 'pending', 'published', 'hidden', 'expired'].map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
            </select>
            <button onClick={loadPosts} className="px-4 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-xs font-bold">Lọc</button>
          </div>

          {posts.length === 0 ? <EmptyState message="Chưa có bài viết nào." /> : (
            <div className="bg-white rounded-[20px] border border-[#E5E7EB] shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[960px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase tracking-wider text-[10px] font-semibold">
                      <th className="p-4">Tiêu đề</th>
                      <th className="p-4">Loại</th>
                      <th className="p-4">Slug</th>
                      <th className="p-4">Trạng thái</th>
                      <th className="p-4 text-center">Thao tác</th>
                      <th className="p-4">Tác giả</th>
                      <th className="p-4">Cập nhật</th>
                      <th className="p-4 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.map(post => (
                      <tr key={post.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                        <td className="p-4">
                          <div className="font-bold text-slate-800">{post.title}</div>
                          <div className="text-[10px] text-slate-400 max-w-xs truncate">{post.excerpt}</div>
                        </td>
                        <td className="p-4">{typeLabels[post.post_type]}</td>
                        <td className="p-4 font-mono text-slate-500">{post.slug}</td>
                        <td className="p-4"><span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-bold text-[10px]">{statusLabels[post.status]}</span></td>
                        <td className="p-4">{post.author_name || '-'}</td>
                        <td className="p-4">{post.updated_at ? new Date(post.updated_at).toLocaleDateString('vi-VN') : '-'}</td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-2">
                            <a href={`/bai-viet/${post.slug}`} target="_blank" rel="noreferrer" className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg" title="Xem trước"><Eye size={14} /></a>
                            <button onClick={() => openEdit(post)} className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-lg" title="Sửa"><FileText size={14} /></button>
                            <button onClick={() => handlePostAction(post, 'duplicate')} className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-lg" title="Nhân bản"><Copy size={14} /></button>
                            {post.status === 'published'
                              ? <button onClick={() => handlePostAction(post, 'hide')} className="px-2 py-1 bg-slate-100 rounded-lg text-[10px] font-bold">Ẩn</button>
                              : <button onClick={() => handlePostAction(post, 'publish')} className="px-2 py-1 bg-primary text-white rounded-lg text-[10px] font-bold">Xuất bản</button>}
                            <button onClick={() => handleDelete(post)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg" title="Xóa"><Trash2 size={14} /></button>
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
      ) : (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-[20px] border border-[#E5E7EB] shadow-card flex flex-wrap gap-3">
            <input value={appSearch} onChange={e => setAppSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadApplications()} placeholder="Tìm hồ sơ..." className="px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary" />
            <select value={appStatus} onChange={e => setAppStatus(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-2xl text-xs bg-white">
              <option value="">Tất cả trạng thái</option>
              {Object.keys(statusLabels).filter(s => s === s.toUpperCase()).map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
            </select>
            <button onClick={loadApplications} className="px-4 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-xs font-bold">Lọc</button>
          </div>

          {filteredApplications.length === 0 ? <EmptyState message="Chưa có hồ sơ ứng tuyển nào." /> : (
            <div className="bg-white rounded-[20px] border border-[#E5E7EB] shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[920px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase tracking-wider text-[10px] font-semibold">
                      <th className="p-4">Mã hồ sơ</th>
                      <th className="p-4">Ứng viên</th>
                      <th className="p-4">Vị trí</th>
                      <th className="p-4">Cơ sở</th>
                      <th className="p-4">Ca mong muốn</th>
                      <th className="p-4">Ngày gửi</th>
                      <th className="p-4">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApplications.map(app => (
                      <tr key={app.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                        <td className="p-4 font-mono font-bold">{app.application_code}</td>
                        <td className="p-4">
                          <div className="font-bold text-slate-800">{app.full_name}</div>
                          <div className="text-[10px] text-slate-400">{app.phone} {app.email ? `• ${app.email}` : ''}</div>
                        </td>
                        <td className="p-4">{app.job_title || app.post_title || '-'}</td>
                        <td className="p-4">{app.branch_name || '-'}</td>
                        <td className="p-4">{app.preferred_shift || '-'}</td>
                        <td className="p-4">{new Date(app.submitted_at).toLocaleDateString('vi-VN')}</td>
                        <td className="p-4">
                          <select value={app.status} onChange={e => updateApplication(app, e.target.value)} className="px-2 py-1 border border-slate-200 rounded-lg text-[10px] bg-white font-bold">
                            {Object.keys(statusLabels).filter(s => s === s.toUpperCase()).map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
                          </select>
                        </td>
                        <td className="p-4 text-center">
                          <button onClick={() => openApplication(app)} className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-lg" title="Xem hồ sơ"><Eye size={14} /></button>
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

      {formOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] border border-slate-200 shadow-xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">{editingId ? 'Chỉnh sửa bài viết' : 'Thêm bài viết'}</h3>
              <button onClick={() => setFormOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={16} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-1 text-xs font-semibold text-slate-600">Tiêu đề<input value={form.title} onChange={e => updateForm('title', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-2xl outline-none focus:border-primary" /></label>
                <label className="space-y-1 text-xs font-semibold text-slate-600">Slug<input value={form.slug || ''} onChange={e => updateForm('slug', slugify(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-2xl outline-none focus:border-primary font-mono" /></label>
                <label className="space-y-1 text-xs font-semibold text-slate-600">Loại bài<select value={form.post_type} onChange={e => updateForm('post_type', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-2xl bg-white"><option value="news">Tin tức</option><option value="recruitment">Tuyển dụng</option><option value="announcement">Thông báo</option><option value="guide">Hướng dẫn</option><option value="other">Khác</option></select></label>
                <label className="space-y-1 text-xs font-semibold text-slate-600">Trạng thái<select value={form.status} onChange={e => updateForm('status', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-2xl bg-white"><option value="draft">Nháp</option><option value="pending">Chờ duyệt</option><option value="published">Đã xuất bản</option><option value="hidden">Đã ẩn</option><option value="expired">Hết hạn</option></select></label>
              </div>
              <label className="space-y-1 text-xs font-semibold text-slate-600 block">Mô tả ngắn<textarea value={form.excerpt || ''} onChange={e => updateForm('excerpt', e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-2xl outline-none focus:border-primary" /></label>
              <label className="space-y-1 text-xs font-semibold text-slate-600 block">Nội dung chi tiết<textarea value={form.content || ''} onChange={e => updateForm('content', e.target.value)} rows={8} className="w-full px-3 py-2 border border-slate-200 rounded-2xl outline-none focus:border-primary font-mono" /></label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 text-xs font-semibold text-slate-600">
                  <div>Ảnh đại diện</div>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleFeaturedImageSelect}
                  />
                  {form.featured_image ? (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                      <img src={form.featured_image} alt="Ảnh đại diện bài viết" className="h-36 w-full object-cover" />
                      <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                        <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-slate-500">{form.featured_image}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => imageInputRef.current?.click()}
                            disabled={uploadingFeaturedImage}
                            className="inline-flex items-center gap-1 rounded-xl bg-primary/10 px-3 py-2 text-[10px] font-bold text-primary hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Upload size={12} /> {uploadingFeaturedImage ? 'Đang upload...' : 'Thay ảnh'}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateForm('featured_image', '')}
                            disabled={uploadingFeaturedImage}
                            className="rounded-xl bg-slate-100 px-3 py-2 text-[10px] font-bold text-slate-600 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={uploadingFeaturedImage}
                      className="flex h-[72px] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 hover:border-primary hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Image size={16} />
                      {uploadingFeaturedImage ? 'Đang upload ảnh...' : 'Chọn ảnh từ máy'}
                    </button>
                  )}
                </div>
                <label className="space-y-1 text-xs font-semibold text-slate-600">Tag<input value={(form.tags || []).join(', ')} onChange={e => updateForm('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))} className="w-full px-3 py-2 border border-slate-200 rounded-2xl outline-none focus:border-primary" /></label>
                <label className="space-y-1 text-xs font-semibold text-slate-600">Meta title<input value={form.meta_title || ''} onChange={e => updateForm('meta_title', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-2xl outline-none focus:border-primary" /></label>
                <label className="space-y-1 text-xs font-semibold text-slate-600">Meta description<input value={form.meta_description || ''} onChange={e => updateForm('meta_description', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-2xl outline-none focus:border-primary" /></label>
              </div>

              {form.post_type === 'recruitment' && (
                <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 space-y-4">
                  <h4 className="text-sm font-bold text-slate-800">Thông tin tuyển dụng</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input placeholder="Tên vị trí" value={form.job_post?.job_title || ''} onChange={e => updateJob('job_title', e.target.value)} className="px-3 py-2 border border-slate-200 rounded-2xl text-xs" />
                    <input placeholder="Phòng ban" value={form.job_post?.department || ''} onChange={e => updateJob('department', e.target.value)} className="px-3 py-2 border border-slate-200 rounded-2xl text-xs" />
                    <select value={form.job_post?.employment_type || ''} onChange={e => updateJob('employment_type', e.target.value)} className="px-3 py-2 border border-slate-200 rounded-2xl text-xs bg-white"><option value="">Hình thức</option><option value="full_time">Toàn thời gian</option><option value="part_time">Bán thời gian</option><option value="shift">Theo ca</option><option value="seasonal">Thời vụ</option><option value="internship">Thực tập</option></select>
                    <input placeholder="Mức lương" value={form.job_post?.salary_text || ''} onChange={e => updateJob('salary_text', e.target.value)} className="px-3 py-2 border border-slate-200 rounded-2xl text-xs" />
                    <input type="number" placeholder="Số lượng" value={form.job_post?.quantity || ''} onChange={e => updateJob('quantity', Number(e.target.value))} className="px-3 py-2 border border-slate-200 rounded-2xl text-xs" />
                    <input type="date" value={form.job_post?.application_deadline || ''} onChange={e => updateJob('application_deadline', e.target.value)} className="px-3 py-2 border border-slate-200 rounded-2xl text-xs" />
                    <input placeholder="Email nhận hồ sơ" value={form.job_post?.receiving_email || ''} onChange={e => updateJob('receiving_email', e.target.value)} className="px-3 py-2 border border-slate-200 rounded-2xl text-xs" />
                    <input placeholder="Số điện thoại liên hệ" value={form.job_post?.contact_phone || ''} onChange={e => updateJob('contact_phone', e.target.value)} className="px-3 py-2 border border-slate-200 rounded-2xl text-xs" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <textarea placeholder="Quyền lợi" value={form.job_post?.benefits || ''} onChange={e => updateJob('benefits', e.target.value)} rows={3} className="px-3 py-2 border border-slate-200 rounded-2xl text-xs" />
                    <textarea placeholder="Mô tả công việc" value={form.job_post?.responsibilities || ''} onChange={e => updateJob('responsibilities', e.target.value)} rows={3} className="px-3 py-2 border border-slate-200 rounded-2xl text-xs" />
                    <textarea placeholder="Yêu cầu công việc" value={form.job_post?.requirements || ''} onChange={e => updateJob('requirements', e.target.value)} rows={3} className="px-3 py-2 border border-slate-200 rounded-2xl text-xs" />
                  </div>
                  {form.job_post?.employment_type === 'shift' && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-slate-600">Ca tuyển dụng</div>
                      <p className="text-[10px] text-slate-400">Chọn một hoặc nhiều ca. Nếu chỉ chọn 1 ca, ứng viên được tự gán ca đó; từ 2 ca trở lên, form ứng tuyển sẽ bắt buộc ứng viên chọn ca mong muốn.</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                        {JOB_SHIFT_OPTIONS.map(shift => {
                          const checked = (form.job_post?.shifts || []).some(s => s.id === shift.id);
                          return (
                            <label key={shift.id} className="flex items-center gap-2 text-xs bg-white border border-slate-200 rounded-xl px-3 py-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={e => {
                                  const current = form.job_post?.shifts || [];
                                  updateJob('shifts', e.target.checked
                                    ? [...current, shift]
                                    : current.filter(s => s.id !== shift.id));
                                }}
                              />
                              <span>{shift.name} <span className="text-slate-400">{shift.start_time}–{shift.end_time}</span></span>
                            </label>
                          );
                        })}
                      </div>
                      {(form.job_post?.shifts || []).length === 0 && (
                        <p className="text-[10px] font-semibold text-amber-600">Vị trí làm việc theo ca cần chọn ít nhất một ca trước khi xuất bản.</p>
                      )}
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-600">Cơ sở tuyển dụng</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {branches.map(branch => {
                        const checked = (form.job_post?.branch_ids || []).includes(branch.id);
                        return <label key={branch.id} className="flex items-center gap-2 text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"><input type="checkbox" checked={checked} onChange={e => {
                          const current = form.job_post?.branch_ids || [];
                          updateJob('branch_ids', e.target.checked ? [...current, branch.id] : current.filter(id => id !== branch.id));
                        }} />{branch.name}</label>;
                      })}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={form.job_post?.allow_online_application ?? true} onChange={e => updateJob('allow_online_application', e.target.checked)} /> Cho phép ứng tuyển online</label>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold">Hủy</button>
                <button type="submit" disabled={saving || uploadingFeaturedImage} className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"><Save size={14} />{saving ? 'Đang lưu...' : uploadingFeaturedImage ? 'Đang upload ảnh...' : 'Lưu bài viết'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedApplication && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] border border-slate-200 shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800">Hồ sơ {selectedApplication.application_code}</h3>
                <p className="text-xs text-slate-500">{selectedApplication.full_name} • {selectedApplication.phone}</p>
              </div>
              <button onClick={() => setSelectedApplication(null)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div><span className="font-bold text-slate-500">Vị trí:</span> {selectedApplication.job_title || selectedApplication.post_title || '-'}</div>
                <div><span className="font-bold text-slate-500">Cơ sở:</span> {selectedApplication.branch_name || '-'}</div>
                <div><span className="font-bold text-slate-500">Email:</span> {selectedApplication.email || '-'}</div>
                <div><span className="font-bold text-slate-500">Ca mong muốn:</span> {selectedApplication.preferred_shift || '-'}</div>
                <div><span className="font-bold text-slate-500">Kinh nghiệm:</span> {selectedApplication.experience || '-'}</div>
                <div><span className="font-bold text-slate-500">Học vấn:</span> {selectedApplication.education || '-'}</div>
                <div><span className="font-bold text-slate-500">Lương mong muốn:</span> {selectedApplication.expected_salary || '-'}</div>
                <div><span className="font-bold text-slate-500">Ngày gửi:</span> {new Date(selectedApplication.submitted_at).toLocaleString('vi-VN')}</div>
              </div>
              {selectedApplication.introduction && (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700 whitespace-pre-line">{selectedApplication.introduction}</div>
              )}
              <div className="flex flex-col sm:flex-row gap-3">
                <select value={selectedApplication.status} onChange={e => updateApplication(selectedApplication, e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white font-bold">
                  {Object.keys(statusLabels).filter(s => s === s.toUpperCase()).map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
                </select>
                {selectedApplication.cv_path && (
                  <span className="px-3 py-2 rounded-xl bg-slate-100 text-xs font-mono text-slate-600">CV: {selectedApplication.cv_path}</span>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600">Ghi chú nội bộ</label>
                <textarea value={applicationNote} onChange={e => setApplicationNote(e.target.value)} rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary" />
                <button onClick={saveApplicationNote} className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold">Lưu ghi chú</button>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-2">Lịch sử xử lý</h4>
                <div className="space-y-2">
                  {applicationLogs.length === 0 ? <div className="text-xs text-slate-400">Chưa có log xử lý.</div> : applicationLogs.map(log => (
                    <div key={log.id} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
                      <div className="font-bold text-slate-700">{log.action} {log.old_status ? `${statusLabels[log.old_status] || log.old_status} → ${statusLabels[log.new_status] || log.new_status}` : statusLabels[log.new_status] || log.new_status || ''}</div>
                      <div className="text-slate-400">{log.created_at ? new Date(log.created_at).toLocaleString('vi-VN') : ''} {log.users?.full_name ? `• ${log.users.full_name}` : ''}</div>
                      {log.note && <div className="text-slate-600 mt-1">{log.note}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentAdmin;
