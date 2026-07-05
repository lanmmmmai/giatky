import React, { useEffect, useState } from 'react';
import { getSeoSettings, updateSeoSettings, createSeoSettings, SeoSettings } from '../../api/seo';
import { getEmailTemplates, updateEmailTemplate, getEmailLogs, EmailTemplate, EmailLog } from '../../api/email';
import { useToastStore } from '../../stores/toastStore';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { Globe, Mail, Eye, Edit3, ClipboardList, CheckCircle, XCircle, Search, Save, Settings } from 'lucide-react';

const Cms: React.FC = () => {
  const { addToast } = useToastStore();
  const [activeTab, setActiveTab] = useState<'seo' | 'templates' | 'logs'>('seo');
  const [loading, setLoading] = useState(true);

  // Data states
  const [seoList, setSeoList] = useState<SeoSettings[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);

  // Editing state - SEO
  const [editingSeoId, setEditingSeoId] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDesc, setSeoDesc] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');
  const [seoCanonical, setSeoCanonical] = useState('');
  const [seoDomain, setSeoDomain] = useState('');

  // Editing state - Template
  const [editingTemplateId, setEditingTemplateId] = useState('');
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateBody, setTemplateBody] = useState('');

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

  const handleEditSeo = (seo: SeoSettings) => {
    setEditingSeoId(seo.id);
    setSeoTitle(seo.meta_title || '');
    setSeoDesc(seo.meta_description || '');
    setSeoKeywords(seo.keywords || '');
    setSeoCanonical(seo.canonical_url || '');
    setSeoDomain(seo.domain);
  };

  const handleSaveSeo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSeoSettings(editingSeoId, {
        domain: seoDomain,
        meta_title: seoTitle,
        meta_description: seoDesc,
        keywords: seoKeywords,
        canonical_url: seoCanonical
      });
      addToast('Cấu hình SEO đã được lưu thành công.', 'success');
      setEditingSeoId('');
      loadData();
    } catch (err: any) {
      addToast('Lưu cấu hình SEO thất bại.', 'error');
    }
  };

  const handleEditTemplate = (tmpl: EmailTemplate) => {
    setEditingTemplateId(tmpl.id);
    setTemplateSubject(tmpl.subject);
    setTemplateBody(tmpl.body_html);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateEmailTemplate(editingTemplateId, {
        subject: templateSubject,
        body_html: templateBody
      });
      addToast('Đã lưu mẫu email cập nhật.', 'success');
      setEditingTemplateId('');
      loadData();
    } catch (_) {
      addToast('Cập nhật mẫu email thất bại.', 'error');
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
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('seo')}
          className={`flex items-center gap-1.5 px-6 py-3 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'seo' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Globe size={16} /> Tối ưu SEO Domain
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex items-center gap-1.5 px-6 py-3 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'templates' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Mail size={16} /> Mẫu email tự động
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-1.5 px-6 py-3 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'logs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
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
          
          {/* TAB 1: SEO SETTINGS */}
          {activeTab === 'seo' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Lists */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cấu hình các trang</h3>
                {seoList.length === 0 ? (
                  <EmptyState message="Chưa cấu hình SEO cho trang nào." />
                ) : (
                  <div className="space-y-4">
                    {seoList.map(s => (
                      <div key={s.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                        <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                          <div>
                            <h4 className="font-bold text-slate-800 text-xs uppercase font-mono">{s.page_key}</h4>
                            <span className="text-[10px] text-slate-400 font-medium">{s.domain}</span>
                          </div>
                          <button
                            onClick={() => handleEditSeo(s)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit3 size={14} />
                          </button>
                        </div>
                        <div className="text-xs space-y-2">
                          <p className="text-slate-800 font-bold">Meta Title: <span className="font-medium text-slate-600">{s.meta_title || 'Chưa đặt'}</span></p>
                          <p className="text-slate-800 font-bold">Meta Description: <span className="font-medium text-slate-500">{s.meta_description || 'Chưa đặt'}</span></p>
                          <p className="text-slate-800 font-bold">Keywords: <span className="font-medium text-slate-500">{s.keywords || 'Chưa đặt'}</span></p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Editing Form */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-fit">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                  Biên tập cấu hình SEO
                </h3>
                {editingSeoId ? (
                  <form onSubmit={handleSaveSeo} className="space-y-4 pt-3 text-xs">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600">Domain *</label>
                      <input
                        type="text"
                        value={seoDomain}
                        onChange={(e) => setSeoDomain(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600">Meta Title</label>
                      <input
                        type="text"
                        value={seoTitle}
                        onChange={(e) => setSeoTitle(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600">Meta Description</label>
                      <textarea
                        value={seoDesc}
                        onChange={(e) => setSeoDesc(e.target.value)}
                        className="w-full p-3 border border-slate-200 rounded-xl outline-none min-h-16"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600">Keywords (Ngăn cách bằng dấu phẩy)</label>
                      <input
                        type="text"
                        value={seoKeywords}
                        onChange={(e) => setSeoKeywords(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600">Canonical URL</label>
                      <input
                        type="text"
                        value={seoCanonical}
                        onChange={(e) => setSeoCanonical(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-[0.99] transition-all"
                    >
                      <Save size={14} /> Lưu cấu hình
                    </button>
                  </form>
                ) : (
                  <div className="py-12 text-center text-xs text-slate-400 font-medium">Bấm vào biểu tượng sửa bên cạnh danh sách trang để chỉnh sửa.</div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: EMAIL TEMPLATES */}
          {activeTab === 'templates' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left list */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Danh sách các loại mẫu</h3>
                {templates.map(tmpl => (
                  <div key={tmpl.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <div>
                        <h4 className="font-bold text-slate-800 text-xs">{tmpl.name}</h4>
                        <span className="text-[10px] font-mono text-slate-400">Loại: {tmpl.type}</span>
                      </div>
                      <button
                        onClick={() => handleEditTemplate(tmpl)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit3 size={14} />
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 font-bold">Tiêu đề gửi: <span className="font-medium text-slate-500">{tmpl.subject}</span></p>
                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-2">Biến hỗ trợ:</div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {(tmpl.variables || []).map(v => (
                        <span key={v} className="bg-slate-100 px-2 py-0.5 rounded text-[9px] font-mono font-bold text-slate-600">
                          {`{{${v}}}`}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Right editing */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-fit">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                  Biên tập nội dung email
                </h3>
                {editingTemplateId ? (
                  <form onSubmit={handleSaveTemplate} className="space-y-4 pt-3 text-xs">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600">Tiêu đề thư (Subject)</label>
                      <input
                        type="text"
                        value={templateSubject}
                        onChange={(e) => setTemplateSubject(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600">Nội dung thư (HTML Format)</label>
                      <textarea
                        value={templateBody}
                        onChange={(e) => setTemplateBody(e.target.value)}
                        className="w-full p-3 border border-slate-200 rounded-xl outline-none min-h-60 font-mono text-[10px]"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-[0.99] transition-all"
                    >
                      <Save size={14} /> Lưu mẫu email
                    </button>
                  </form>
                ) : (
                  <div className="py-12 text-center text-xs text-slate-400 font-medium">Bấm vào biểu tượng sửa bên cạnh danh sách mẫu để chỉnh sửa.</div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: EMAIL LOGS */}
          {activeTab === 'logs' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
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
                        <tr key={log.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50">
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
