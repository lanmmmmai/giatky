import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Send } from 'lucide-react';
import { getPublicPost, Post, submitJobApplication } from '../../api/content';
import { getPublicBranches } from '../../api/branches';
import LoadingSpinner from '../../components/LoadingSpinner';

const MAX_CV_SIZE = 5 * 1024 * 1024;
const CV_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const contentToParagraphs = (content?: string) =>
  (content || '').split(/\n{2,}/).map(item => item.trim()).filter(Boolean);

const PublicPostDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [branches, setBranches] = useState<{ id: string; name: string; address?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    date_of_birth: '',
    address: '',
    preferred_branch_id: '',
    preferred_shift: '',
    experience: '',
    education: '',
    available_date: '',
    expected_salary: '',
    introduction: '',
    agreed_terms: false,
  });
  const [cv, setCv] = useState<File | null>(null);

  useEffect(() => {
    loadPost();
  }, [slug]);

  const jobBranches = useMemo(() => post?.job_post?.branches || [], [post]);
  const canApply = post?.post_type === 'recruitment' && post.job_post?.allow_online_application && post.allow_application_form;

  const loadPost = async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const [postData, branchData] = await Promise.all([getPublicPost(slug), getPublicBranches()]);
      setPost(postData);
      setBranches(branchData);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof typeof form, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleCvChange = (file?: File) => {
    setMessage(null);
    if (!file) {
      setCv(null);
      return;
    }
    if (!CV_TYPES.includes(file.type) || !/\.(pdf|doc|docx)$/i.test(file.name)) {
      setMessage({ type: 'error', text: 'CV chỉ hỗ trợ PDF, DOC hoặc DOCX.' });
      return;
    }
    if (file.size > MAX_CV_SIZE) {
      setMessage({ type: 'error', text: 'CV không được vượt quá 5MB.' });
      return;
    }
    setCv(file);
  };

  const submitApplication = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!post || !canApply) return;
    setMessage(null);
    setSubmitting(true);
    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (typeof value === 'boolean' || String(value).trim()) {
          payload.append(key, String(value));
        }
      });
      if (cv) payload.append('cv', cv);
      const res = await submitJobApplication(post.id, payload);
      setMessage({ type: 'success', text: res.message || 'Gửi hồ sơ ứng tuyển thành công.' });
      setForm({
        full_name: '',
        phone: '',
        email: '',
        date_of_birth: '',
        address: '',
        preferred_branch_id: '',
        preferred_shift: '',
        experience: '',
        education: '',
        available_date: '',
        expected_salary: '',
        introduction: '',
        agreed_terms: false,
      });
      setCv(null);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Không thể gửi hồ sơ. Vui lòng thử lại.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><LoadingSpinner /></div>;

  if (!post) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-extrabold text-slate-900">Không tìm thấy bài viết</h1>
          <Link to="/bai-viet" className="mt-3 inline-block text-primary text-sm font-bold">Quay lại danh sách</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-5xl mx-auto px-4 py-8">
        <Link to={post.post_type === 'recruitment' ? '/tuyen-dung' : '/bai-viet'} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-primary mb-6">
          <ArrowLeft size={16} /> Quay lại
        </Link>

        <article className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {post.featured_image && <img src={post.featured_image} alt={post.title} className="w-full max-h-[420px] object-cover" />}
          <div className="p-5 md:p-8 space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="px-2 py-1 rounded-md bg-slate-100 font-bold">{post.post_type === 'recruitment' ? 'Tuyển dụng' : 'Bài viết'}</span>
                <span className="inline-flex items-center gap-1"><Calendar size={13} />{post.published_at ? new Date(post.published_at).toLocaleDateString('vi-VN') : '-'}</span>
              </div>
              <h1 className="text-2xl md:text-4xl font-extrabold text-slate-950">{post.title}</h1>
              {post.excerpt && <p className="text-base text-slate-600">{post.excerpt}</p>}
            </div>

            {post.post_type === 'recruitment' && post.job_post && (
              <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
                  <div className="text-[11px] text-slate-500 font-bold uppercase">Vị trí</div>
                  <div className="text-sm font-bold text-slate-900 mt-1">{post.job_post.job_title || post.title}</div>
                </div>
                <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
                  <div className="text-[11px] text-slate-500 font-bold uppercase">Lương</div>
                  <div className="text-sm font-bold text-slate-900 mt-1">{post.job_post.salary_text || 'Trao đổi khi phỏng vấn'}</div>
                </div>
                <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
                  <div className="text-[11px] text-slate-500 font-bold uppercase">Hạn ứng tuyển</div>
                  <div className="text-sm font-bold text-slate-900 mt-1">{post.job_post.application_deadline ? new Date(post.job_post.application_deadline).toLocaleDateString('vi-VN') : 'Đến khi đủ hồ sơ'}</div>
                </div>
                {jobBranches.length > 0 && (
                  <div className="md:col-span-3 rounded-lg border border-slate-200 p-4 bg-white">
                    <div className="text-[11px] text-slate-500 font-bold uppercase mb-2">Cơ sở tuyển dụng</div>
                    <div className="flex flex-wrap gap-2">
                      {jobBranches.map(branch => (
                        <span key={branch.branch_id} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                          <MapPin size={12} />{branch.branch_name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            <div className="prose prose-slate max-w-none">
              {contentToParagraphs(post.content).map((paragraph, index) => (
                <p key={index} className="whitespace-pre-line text-slate-700 leading-7">{paragraph}</p>
              ))}
            </div>
          </div>
        </article>

        {canApply && (
          <section className="mt-6 bg-white border border-slate-200 rounded-lg p-5 md:p-8">
            <h2 className="text-xl font-extrabold text-slate-900">Ứng tuyển vị trí này</h2>
            <p className="text-sm text-slate-500 mt-1">Thông tin của bạn chỉ dùng cho mục đích tuyển dụng Giặt Ký.</p>
            {message && (
              <div className={`mt-4 rounded-lg px-4 py-3 text-sm font-semibold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                {message.text}
              </div>
            )}
            <form onSubmit={submitApplication} className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <input required value={form.full_name} onChange={event => updateField('full_name', event.target.value)} placeholder="Họ và tên *" className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary" />
              <input required value={form.phone} onChange={event => updateField('phone', event.target.value)} placeholder="Số điện thoại *" className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary" />
              <input type="email" value={form.email} onChange={event => updateField('email', event.target.value)} placeholder="Email" className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary" />
              <input type="date" value={form.date_of_birth} onChange={event => updateField('date_of_birth', event.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary" />
              <select value={form.preferred_branch_id} onChange={event => updateField('preferred_branch_id', event.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary bg-white">
                <option value="">Cơ sở mong muốn</option>
                {(jobBranches.length ? jobBranches.map(item => ({ id: item.branch_id, name: item.branch_name || '' })) : branches).map(branch => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
              <input value={form.preferred_shift} onChange={event => updateField('preferred_shift', event.target.value)} placeholder="Ca làm mong muốn" className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary" />
              <input type="date" value={form.available_date} onChange={event => updateField('available_date', event.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary" />
              <input value={form.expected_salary} onChange={event => updateField('expected_salary', event.target.value)} placeholder="Mức lương mong muốn" className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary" />
              <input value={form.address} onChange={event => updateField('address', event.target.value)} placeholder="Địa chỉ" className="md:col-span-2 px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary" />
              <textarea value={form.experience} onChange={event => updateField('experience', event.target.value)} rows={3} placeholder="Kinh nghiệm làm việc" className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary" />
              <textarea value={form.education} onChange={event => updateField('education', event.target.value)} rows={3} placeholder="Trình độ học vấn" className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary" />
              <textarea value={form.introduction} onChange={event => updateField('introduction', event.target.value)} rows={4} placeholder="Giới thiệu thêm" className="md:col-span-2 px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary" />
              <label className="md:col-span-2 block text-sm text-slate-600">
                <span className="font-bold">CV đính kèm</span>
                <input type="file" accept=".pdf,.doc,.docx" onChange={event => handleCvChange(event.target.files?.[0])} className="mt-2 block w-full text-sm" />
                <span className="text-xs text-slate-400">{cv ? cv.name : 'PDF, DOC hoặc DOCX, tối đa 5MB.'}</span>
              </label>
              <label className="md:col-span-2 flex items-start gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={form.agreed_terms} onChange={event => updateField('agreed_terms', event.target.checked)} className="mt-1" required />
                <span>Tôi đồng ý để Giặt Ký lưu và xử lý thông tin ứng tuyển cho mục đích tuyển dụng.</span>
              </label>
              <div className="md:col-span-2 flex justify-end">
                <button disabled={submitting} type="submit" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-dark disabled:opacity-60">
                  <Send size={16} />{submitting ? 'Đang gửi...' : 'Gửi hồ sơ'}
                </button>
              </div>
            </form>
          </section>
        )}
      </main>
    </div>
  );
};

export default PublicPostDetail;
