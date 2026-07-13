import React, { useEffect, useRef, useState } from 'react';
import {
  EmailTemplate, EmailTrigger, EmailPreviewResult,
  getEmailTemplates, createEmailTemplate, updateEmailTemplate, deleteEmailTemplate,
  duplicateEmailTemplate, previewEmailTemplate, sendTestEmail,
  getEmailTriggers, createEmailTrigger,
} from '../../api/email';
import { EMAIL_PLACEHOLDERS } from './placeholders';
import { sanitizeHtml, generateHtmlFromText } from './emailUtils';
import { useToastStore } from '../../stores/toastStore';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { useConfirm } from '../../components/ConfirmDialog';
import {
  Mail, Eye, Edit3, Trash2, Copy, Send, Plus, Save, X, Monitor, Smartphone,
  Bold, Italic, Underline, Palette, Type, Link2, Image as ImageIcon, Table2,
  SquareMousePointer, ClipboardList, Globe, CheckCircle, XCircle, HelpCircle,
} from 'lucide-react';

/* ─────────────── Toolbar soạn thảo HTML ───────────────
   Chèn/bọc thẻ HTML tại vị trí con trỏ của textarea HTML. */
interface ToolbarAction {
  icon: React.ReactNode;
  title: string;
  /** wrap: [before, after] bọc selection; insert: chèn đoạn HTML */
  wrap?: [string, string];
  insert?: string;
  prompt?: { message: string; build: (value: string, selection: string) => [string, string] | string };
}

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { icon: <Bold size={13} />, title: 'Bold', wrap: ['<strong>', '</strong>'] },
  { icon: <Italic size={13} />, title: 'Italic', wrap: ['<em>', '</em>'] },
  { icon: <Underline size={13} />, title: 'Underline', wrap: ['<u>', '</u>'] },
  {
    icon: <Palette size={13} />, title: 'Color',
    prompt: { message: 'Mã màu (VD: #171717 hoặc red):', build: (v) => [`<span style="color: ${v};">`, '</span>'] },
  },
  {
    icon: <Type size={13} />, title: 'Font Size',
    prompt: { message: 'Cỡ chữ (px, VD: 18):', build: (v) => [`<span style="font-size: ${v}px;">`, '</span>'] },
  },
  {
    icon: <Link2 size={13} />, title: 'Link',
    prompt: { message: 'URL liên kết:', build: (v, sel) => `<a href="${v}" style="color: #171717;">${sel || 'liên kết'}</a>` },
  },
  {
    icon: <ImageIcon size={13} />, title: 'Image',
    prompt: { message: 'URL ảnh:', build: (v) => `<img src="${v}" alt="" style="max-width: 100%; border-radius: 8px;" />` },
  },
  {
    icon: <Table2 size={13} />, title: 'Table',
    insert: `<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
  <tr>
    <th style="border: 1px solid #e2e8f0; padding: 8px; background: #f8fafc; text-align: left;">Cột 1</th>
    <th style="border: 1px solid #e2e8f0; padding: 8px; background: #f8fafc; text-align: left;">Cột 2</th>
  </tr>
  <tr>
    <td style="border: 1px solid #e2e8f0; padding: 8px;">Nội dung</td>
    <td style="border: 1px solid #e2e8f0; padding: 8px;">Nội dung</td>
  </tr>
</table>`,
  },
  {
    icon: <SquareMousePointer size={13} />, title: 'Button',
    prompt: {
      message: 'URL khi bấm nút:',
      build: (v, sel) =>
        `<a href="${v}" style="display: inline-block; background: #171717; color: #ffffff; padding: 12px 28px; border-radius: 12px; text-decoration: none; font-weight: bold;">${sel || 'Xem chi tiết'}</a>`,
    },
  },
];

const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary';

const EmailTemplatesTab: React.FC = () => {
  const { addToast } = useToastStore();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [triggers, setTriggers] = useState<EmailTrigger[]>([]);

  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState({ name: '', type: '', subject: '', body_html: '', body_text: '', is_active: true });
  const [formErrors, setFormErrors] = useState<{ name?: string; type?: string; subject?: string; content?: string }>({});
  const [saving, setSaving] = useState(false);
  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [activeEditor, setActiveEditor] = useState<'html' | 'text'>('html');
  const [showPlaceholderGuide, setShowPlaceholderGuide] = useState(false);

  // Preview (form + modal): render qua backend để thay {{placeholder}} như gửi thật
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [formPreview, setFormPreview] = useState<EmailPreviewResult | null>(null);
  const [previewModal, setPreviewModal] = useState<{ template: EmailTemplate; rendered: EmailPreviewResult } | null>(null);

  // Popup gửi thử
  const [testModal, setTestModal] = useState<{ template: EmailTemplate; rendered: EmailPreviewResult | null } | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testSubject, setTestSubject] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testError, setTestError] = useState('');

  // Thêm trigger mới
  const [showTriggerForm, setShowTriggerForm] = useState(false);
  const [newTrigger, setNewTrigger] = useState({ code: '', name: '' });
  const [creatingTrigger, setCreatingTrigger] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tpls, trgs] = await Promise.all([getEmailTemplates(), getEmailTriggers()]);
      setTemplates(tpls);
      setTriggers(trgs);
    } catch (_) {
      addToast('Không thể tải danh sách mẫu email.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const triggerName = (code: string) => triggers.find(t => t.code === code)?.name || code;

  /* ─────────────── Form helpers ─────────────── */

  const openCreate = () => {
    setEditingId('');
    setForm({ name: '', type: '', subject: '', body_html: '', body_text: '', is_active: true });
    setFormErrors({});
    setFormPreview(null);
    setMode('form');
  };

  const openEdit = (tmpl: EmailTemplate) => {
    setEditingId(tmpl.id);
    setForm({
      name: tmpl.name, type: tmpl.type, subject: tmpl.subject,
      body_html: tmpl.body_html, body_text: tmpl.body_text || '', is_active: tmpl.is_active,
    });
    setFormErrors({});
    setFormPreview(null);
    setMode('form');
  };

  const applyToolbar = (action: ToolbarAction) => {
    const ref = htmlRef.current;
    const value = form.body_html;
    const start = ref?.selectionStart ?? value.length;
    const end = ref?.selectionEnd ?? value.length;
    const selection = value.slice(start, end);

    let snippet = '';
    if (action.wrap) {
      snippet = action.wrap[0] + (selection || '') + action.wrap[1];
    } else if (action.insert) {
      snippet = action.insert;
    } else if (action.prompt) {
      const v = window.prompt(action.prompt.message);
      if (!v) return;
      const built = action.prompt.build(v.trim(), selection);
      snippet = Array.isArray(built) ? built[0] + (selection || '') + built[1] : built;
    }
    const next = value.slice(0, start) + snippet + value.slice(end);
    setForm(p => ({ ...p, body_html: next }));
    requestAnimationFrame(() => {
      if (ref) {
        ref.focus();
        ref.selectionStart = ref.selectionEnd = start + snippet.length;
      }
    });
  };

  const insertPlaceholder = (key: string) => {
    const tag = `{{${key}}}`;
    const isHtml = activeEditor === 'html';
    const ref = isHtml ? htmlRef.current : textRef.current;
    const field = isHtml ? 'body_html' : 'body_text';
    const value = isHtml ? form.body_html : form.body_text;
    const start = ref?.selectionStart ?? value.length;
    const end = ref?.selectionEnd ?? value.length;
    setForm(p => ({ ...p, [field]: value.slice(0, start) + tag + value.slice(end) }));
    requestAnimationFrame(() => {
      if (ref) {
        ref.focus();
        ref.selectionStart = ref.selectionEnd = start + tag.length;
      }
    });
  };

  const refreshFormPreview = async () => {
    if (!form.body_html.trim() && !form.body_text.trim()) {
      addToast('Chưa có nội dung để xem trước.', 'warning');
      return;
    }
    try {
      const html = form.body_html.trim() || generateHtmlFromText(form.body_text);
      const rendered = await previewEmailTemplate({ subject: form.subject, body_html: html, body_text: form.body_text });
      setFormPreview(rendered);
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Xem trước thất bại.', 'error');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: typeof formErrors = {};
    if (!form.name.trim()) errors.name = 'Tên mẫu không được để trống.';
    if (!form.type) errors.type = 'Vui lòng chọn trigger.';
    if (!form.subject.trim()) errors.subject = 'Tiêu đề email không được để trống.';
    if (!form.body_html.trim() && !form.body_text.trim()) errors.content = 'Vui lòng nhập nội dung email.';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    let bodyHtml = form.body_html;
    if (!bodyHtml.trim() && form.body_text.trim()) {
      bodyHtml = generateHtmlFromText(form.body_text);
      addToast('Đã tự động tạo HTML từ nội dung văn bản để lưu.', 'info');
    }

    const usedVariables = EMAIL_PLACEHOLDERS.filter(p =>
      bodyHtml.includes(`{{${p.key}}}`) || form.subject.includes(`{{${p.key}}}`) || form.body_text.includes(`{{${p.key}}}`)
    ).map(p => p.key);

    setSaving(true);
    try {
      if (editingId) {
        await updateEmailTemplate(editingId, {
          name: form.name, type: form.type, subject: form.subject,
          body_html: bodyHtml, body_text: form.body_text,
          variables: usedVariables, is_active: form.is_active,
        });
        addToast('Đã lưu mẫu email cập nhật.', 'success');
      } else {
        await createEmailTemplate({
          name: form.name, type: form.type, subject: form.subject,
          body_html: bodyHtml, body_text: form.body_text,
          variables: usedVariables, is_active: form.is_active,
        });
        addToast('Đã tạo mẫu email mới.', 'success');
      }
      setMode('list');
      loadData();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Lưu mẫu email thất bại.', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ─────────────── Row actions ─────────────── */

  const handleDelete = async (tmpl: EmailTemplate) => {
    await confirm({
      title: 'Xóa mẫu email?',
      description: 'Mẫu email này sẽ bị xóa khỏi hệ thống và không thể hoàn tác.',
      objectName: tmpl.name,
      confirmText: 'Xóa mẫu email',
      variant: 'danger',
      disableBackdropClose: true,
      onConfirm: async () => {
        try {
          await deleteEmailTemplate(tmpl.id);
          addToast('Đã xóa mẫu email.', 'success');
          await loadData();
        } catch (err: any) {
          addToast(err.response?.data?.detail || 'Xóa mẫu email thất bại.', 'error');
          throw err;
        }
      },
    });
  };

  const handleDuplicate = async (tmpl: EmailTemplate) => {
    try {
      await duplicateEmailTemplate(tmpl.id);
      addToast('Đã nhân bản mẫu email (bản sao đang tắt).', 'success');
      loadData();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Nhân bản mẫu thất bại.', 'error');
    }
  };

  const handleGenerateHtmlFromText = async () => {
    if (!form.body_text.trim()) {
      addToast('Vui lòng nhập nội dung văn bản thường trước.', 'warning');
      return;
    }

    const applyGeneratedHtml = () => {
      setForm(p => ({ ...p, body_html: generateHtmlFromText(p.body_text) }));
      addToast('Đã sinh mã HTML từ nội dung văn bản.', 'success');
    };

    if (!form.body_html.trim()) {
      applyGeneratedHtml();
      return;
    }

    await confirm({
      title: 'Thay thế nội dung HTML?',
      description: 'Nội dung HTML hiện tại sẽ được thay bằng phiên bản sinh từ văn bản thường.',
      confirmText: 'Tạo HTML',
      variant: 'warning',
      onConfirm: async () => {
        applyGeneratedHtml();
      },
    });
  };

  const openPreviewModal = async (tmpl: EmailTemplate) => {
    try {
      const rendered = await previewEmailTemplate({ subject: tmpl.subject, body_html: tmpl.body_html, body_text: tmpl.body_text });
      setPreviewDevice('desktop');
      setPreviewModal({ template: tmpl, rendered });
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Xem trước thất bại.', 'error');
    }
  };

  const openTestModal = async (tmpl: EmailTemplate) => {
    setTestEmail('');
    setTestSubject(tmpl.subject);
    setTestError('');
    let rendered: EmailPreviewResult | null = null;
    try {
      rendered = await previewEmailTemplate({ subject: tmpl.subject, body_html: tmpl.body_html, body_text: tmpl.body_text });
    } catch (_) { /* preview lỗi vẫn cho gửi thử */ }
    setTestModal({ template: tmpl, rendered });
  };

  const handleSendTest = async () => {
    if (!testModal) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail.trim())) {
      setTestError('Email nhận không hợp lệ.');
      return;
    }
    setTestSending(true);
    setTestError('');
    try {
      await sendTestEmail(testModal.template.id, { to_email: testEmail.trim(), subject_override: testSubject });
      addToast('Email gửi thành công', 'success');
      setTestModal(null);
    } catch (err: any) {
      setTestError(err.response?.data?.detail || 'Gửi email thất bại. Vui lòng thử lại.');
    } finally {
      setTestSending(false);
    }
  };

  const handleCreateTrigger = async () => {
    if (!newTrigger.code.trim() || !newTrigger.name.trim()) {
      addToast('Nhập đủ mã và tên trigger.', 'warning');
      return;
    }
    setCreatingTrigger(true);
    try {
      const created = await createEmailTrigger({ code: newTrigger.code.trim(), name: newTrigger.name.trim() });
      addToast(`Đã thêm trigger ${created.code}.`, 'success');
      setNewTrigger({ code: '', name: '' });
      setShowTriggerForm(false);
      const trgs = await getEmailTriggers();
      setTriggers(trgs);
      setForm(p => ({ ...p, type: created.code }));
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Thêm trigger thất bại.', 'error');
    } finally {
      setCreatingTrigger(false);
    }
  };

  /* ─────────────── Render ─────────────── */

  if (loading) return <LoadingSpinner />;

  const previewFrame = (rendered: EmailPreviewResult | null, minH = 'min-h-96') => (
    <div className={`mx-auto transition-all ${previewDevice === 'mobile' ? 'w-[375px] max-w-full' : 'w-full'}`}>
      <div className={`border border-slate-200 rounded-2xl overflow-hidden bg-white ${minH}`}>
        {rendered?.body_html ? (
          <iframe
            title="Email Preview"
            srcDoc={sanitizeHtml(rendered.body_html)}
            className={`w-full border-none bg-white ${minH}`}
            sandbox=""
          />
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs font-medium py-24">Chưa có nội dung xem trước</div>
        )}
      </div>
    </div>
  );

  const deviceToggle = (
    <div className="flex items-center gap-1 bg-slate-100 rounded-2xl p-1">
      <button
        type="button"
        onClick={() => setPreviewDevice('desktop')}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all ${previewDevice === 'desktop' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}
      >
        <Monitor size={12} /> Desktop
      </button>
      <button
        type="button"
        onClick={() => setPreviewDevice('mobile')}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all ${previewDevice === 'mobile' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}
      >
        <Smartphone size={12} /> Mobile
      </button>
    </div>
  );

  /* ── LIST ── */
  if (mode === 'list') {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Templates</h3>
          <button onClick={openCreate} className="primary-action">
            <Plus size={15} strokeWidth={1.5} /> Thêm mẫu Email
          </button>
        </div>

        {templates.length === 0 ? (
          <EmptyState message="Chưa có mẫu email nào." subMessage='Bấm "Thêm mẫu Email" để tạo mẫu đầu tiên.' />
        ) : (
          <div className="bg-white rounded-[20px] border border-[#ECECEC] shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-primary/5 text-slate-400 border-b border-slate-100 uppercase tracking-wider text-[9px] font-bold">
                    <th className="p-4 pl-6">Template Name</th>
                    <th className="p-4">Subject</th>
                    <th className="p-4">Trigger</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Updated At</th>
                    <th className="p-4">Updated By</th>
                    <th className="p-4 pr-6 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map(tmpl => (
                    <tr key={tmpl.id} className="border-b border-slate-100 last:border-b-0 hover:bg-primary/5 transition-colors">
                      <td className="p-4 pl-6 font-bold text-slate-900">{tmpl.name}</td>
                      <td className="p-4 text-slate-600 font-medium max-w-[220px] truncate">{tmpl.subject}</td>
                      <td className="p-4">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[9px] font-mono font-bold text-slate-600" title={triggerName(tmpl.type)}>
                          {tmpl.type}
                        </span>
                      </td>
                      <td className="p-4">
                        {tmpl.is_active ? (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-0.5 w-fit">
                            <CheckCircle size={10} /> Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-50 text-slate-500 border border-slate-200 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-0.5 w-fit">
                            <XCircle size={10} /> Tắt
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-slate-500 whitespace-nowrap">{new Date(tmpl.updated_at || tmpl.created_at).toLocaleString('vi-VN')}</td>
                      <td className="p-4 text-slate-500 font-medium">{tmpl.updated_by_name || '—'}</td>
                      <td className="p-4 pr-6">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(tmpl)} title="Sửa" className="p-2 text-primary hover:bg-primary/10 border border-transparent hover:border-primary/20 rounded-2xl transition-all btn-press">
                            <Edit3 size={13} strokeWidth={1.5} />
                          </button>
                          <button onClick={() => handleDuplicate(tmpl)} title="Nhân bản" className="p-2 text-slate-500 hover:bg-slate-100 border border-transparent hover:border-slate-200 rounded-2xl transition-all btn-press">
                            <Copy size={13} strokeWidth={1.5} />
                          </button>
                          <button onClick={() => openPreviewModal(tmpl)} title="Preview" className="p-2 text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 rounded-2xl transition-all btn-press">
                            <Eye size={13} strokeWidth={1.5} />
                          </button>
                          <button onClick={() => openTestModal(tmpl)} title="Gửi thử" className="p-2 text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 rounded-2xl transition-all btn-press">
                            <Send size={13} strokeWidth={1.5} />
                          </button>
                          <button onClick={() => handleDelete(tmpl)} title="Xóa" className="p-2 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-2xl transition-all btn-press">
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

        {/* Preview modal */}
        {previewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setPreviewModal(null)}>
            <div className="bg-white rounded-[20px] shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5"><Eye size={15} /> Preview: {previewModal.template.name}</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Subject: <span className="font-semibold text-slate-600">{previewModal.rendered.subject}</span></p>
                </div>
                <div className="flex items-center gap-2">
                  {deviceToggle}
                  <button onClick={() => setPreviewModal(null)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-2xl"><X size={16} /></button>
                </div>
              </div>
              {previewFrame(previewModal.rendered, 'min-h-[480px]')}
            </div>
          </div>
        )}

        {/* Send test modal */}
        {testModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => !testSending && setTestModal(null)}>
            <div className="bg-white rounded-[20px] shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5"><Send size={15} /> Send Test Email</h4>
                <button onClick={() => setTestModal(null)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-2xl"><X size={16} /></button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Email nhận *</label>
                  <input type="email" value={testEmail} onChange={e => { setTestEmail(e.target.value); setTestError(''); }} placeholder="ban@example.com" className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Subject</label>
                  <input type="text" value={testSubject} onChange={e => setTestSubject(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Template</label>
                <input type="text" value={`${testModal.template.name} (${testModal.template.type})`} disabled className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500 outline-none" />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-600">Preview (đã thay dữ liệu mẫu)</label>
                  {deviceToggle}
                </div>
                {previewFrame(testModal.rendered, 'min-h-64')}
              </div>

              {testError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-600 font-semibold flex items-start gap-1.5">
                  <XCircle size={14} className="shrink-0 mt-0.5" /> {testError}
                </div>
              )}

              <button
                onClick={handleSendTest}
                disabled={testSending}
                className="w-full py-3 bg-primary hover:bg-primary-dark disabled:bg-secondary text-white rounded-2xl font-bold text-xs shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-1.5"
              >
                <Send size={14} /> {testSending ? 'Đang gửi...' : 'Send'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── FORM ── */
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-slate-50 p-4 rounded-[20px] border border-slate-200">
        <div>
          <h3 className="text-sm font-bold text-slate-800">{editingId ? `Biên tập: ${form.name}` : 'Thêm mẫu Email mới'}</h3>
          <span className="text-[10px] text-slate-400">Nội dung email lấy hoàn toàn từ mẫu — không hard-code trong hệ thống</span>
        </div>
        <button type="button" onClick={() => setMode('list')} className="px-3.5 py-1.5 text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-2xl transition-all">
          Quay lại danh sách
        </button>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          {/* Thông tin mẫu */}
          <div className="bg-white p-5 rounded-[20px] border border-[#ECECEC] shadow-card space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="p-1.5 bg-primary/10 text-primary rounded-lg"><Mail size={16} /></span>
              <h4 className="font-bold text-slate-800 text-xs">Thông tin mẫu email</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Tên mẫu (Template Name) *</label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputCls} placeholder="VD: Email chào mừng khách mới" />
                {formErrors.name && <p className="text-[10px] text-rose-600 font-semibold">{formErrors.name}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Trigger (sự kiện gửi) *</label>
                <div className="flex gap-1.5">
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className={inputCls}>
                    <option value="">— Chọn trigger —</option>
                    {triggers.map(t => (
                      <option key={t.code} value={t.code}>{t.name} ({t.code})</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowTriggerForm(s => !s)}
                    title="Thêm trigger mới"
                    className="px-2.5 shrink-0 bg-primary/10 hover:bg-primary/15 text-primary rounded-2xl transition-all btn-press"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {formErrors.type && <p className="text-[10px] text-rose-600 font-semibold">{formErrors.type}</p>}
              </div>
            </div>

            {showTriggerForm && (
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-2xl grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500">Mã trigger (VD: ORDER_FEEDBACK)</label>
                  <input type="text" value={newTrigger.code} onChange={e => setNewTrigger(p => ({ ...p, code: e.target.value.toUpperCase().replace(/\s/g, '_') }))} className={`${inputCls} font-mono`} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500">Tên hiển thị</label>
                  <input type="text" value={newTrigger.name} onChange={e => setNewTrigger(p => ({ ...p, name: e.target.value }))} className={inputCls} />
                </div>
                <button type="button" onClick={handleCreateTrigger} disabled={creatingTrigger} className="px-4 py-2 bg-primary hover:bg-primary-dark disabled:bg-secondary text-white rounded-2xl text-xs font-bold transition-all">
                  {creatingTrigger ? 'Đang thêm...' : 'Thêm trigger'}
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Tiêu đề thư (Subject) *</label>
                <input type="text" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} className={inputCls} placeholder="VD: Đơn hàng {{order_code}} đã được tạo" />
                {formErrors.subject && <p className="text-[10px] text-rose-600 font-semibold">{formErrors.subject}</p>}
              </div>
              <label className="flex items-center gap-2 pb-2 cursor-pointer select-none">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} className="accent-[#171717] w-4 h-4" />
                <span className="text-xs font-semibold text-slate-600">Kích hoạt (Active)</span>
              </label>
            </div>
          </div>

          {/* Editor HTML với toolbar */}
          <div className="bg-white p-5 rounded-[20px] border border-[#ECECEC] shadow-card space-y-3">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-neutral-100 text-neutral-700 rounded-lg"><Globe size={16} /></span>
                <h4 className="font-bold text-slate-800 text-xs">Trình soạn email (HTML)</h4>
              </div>
              <button
                type="button"
                onClick={handleGenerateHtmlFromText}
                className="px-3 py-1.5 bg-primary/10 hover:bg-primary/15 text-primary text-[11px] font-bold rounded-2xl transition-all"
              >
                Tạo HTML từ text
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1 p-1.5 bg-slate-50 border border-slate-200 rounded-2xl">
              {TOOLBAR_ACTIONS.map(action => (
                <button
                  key={action.title}
                  type="button"
                  title={action.title}
                  onClick={() => applyToolbar(action)}
                  className="p-2 text-slate-600 hover:text-primary hover:bg-primary/10 rounded-xl transition-all btn-press"
                >
                  {action.icon}
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-slate-200" />
              <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide pr-2">Chèn biến ở bảng bên phải →</span>
            </div>

            <textarea
              ref={htmlRef}
              value={form.body_html}
              onFocus={() => setActiveEditor('html')}
              onChange={e => setForm(p => ({ ...p, body_html: e.target.value }))}
              className="w-full p-3 border border-slate-200 rounded-2xl outline-none focus:border-primary min-h-64 font-mono text-[10px]"
              placeholder={'<html>\n  <body>\n    Xin chào {{customer_name}}, đơn hàng {{order_code}} của bạn...\n  </body>\n</html>'}
            />
            {formErrors.content && <p className="text-[10px] text-rose-600 font-semibold">{formErrors.content}</p>}

            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-semibold text-slate-600">Nội dung văn bản dự phòng (text fallback)</label>
              <textarea
                ref={textRef}
                value={form.body_text}
                onFocus={() => setActiveEditor('text')}
                onChange={e => setForm(p => ({ ...p, body_text: e.target.value }))}
                className="w-full p-3 border border-slate-200 rounded-2xl outline-none focus:border-primary min-h-28 text-xs text-slate-700"
                placeholder={'Xin chào {{customer_name}},\nĐơn hàng {{order_code}} của bạn đã được tạo thành công.'}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-primary hover:bg-primary-dark disabled:bg-secondary text-white rounded-[20px] font-bold flex items-center justify-center gap-2 shadow-lg active:scale-[0.99] transition-all"
          >
            <Save size={16} /> {saving ? 'Đang lưu...' : 'Lưu mẫu email'}
          </button>
        </div>

        {/* Cột phải: biến động + preview */}
        <div className="space-y-4 lg:sticky lg:top-4">
          <div className="bg-white p-5 rounded-[20px] border border-[#ECECEC] shadow-card space-y-3">
            <button type="button" onClick={() => setShowPlaceholderGuide(s => !s)} className="w-full flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="flex items-center gap-2">
                <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg"><HelpCircle size={16} /></span>
                <h4 className="font-bold text-slate-800 text-xs">Biến động (placeholder)</h4>
              </span>
              <span className="text-[10px] text-primary font-bold">{showPlaceholderGuide ? 'Thu gọn' : 'Bảng hướng dẫn'}</span>
            </button>
            <p className="text-[10px] text-slate-400">Bấm để chèn vào ô soạn thảo đang chọn. Khi gửi thật, hệ thống thay bằng dữ liệu đơn hàng/khách hàng.</p>
            <div className="flex flex-wrap gap-1.5">
              {EMAIL_PLACEHOLDERS.map(p => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => insertPlaceholder(p.key)}
                  title={`${p.label} — VD: ${p.sample}`}
                  className="bg-slate-100 hover:bg-primary/10 hover:text-primary px-2 py-0.5 rounded text-[9px] font-mono font-bold text-slate-600 transition-all"
                >
                  {`{{${p.key}}}`}
                </button>
              ))}
            </div>
            {showPlaceholderGuide && (
              <div className="border border-slate-100 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-[10px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 uppercase tracking-wider text-[8px] font-bold">
                      <th className="p-2 pl-3">Biến</th>
                      <th className="p-2">Ý nghĩa</th>
                      <th className="p-2">Dữ liệu mẫu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {EMAIL_PLACEHOLDERS.map(p => (
                      <tr key={p.key} className="border-t border-slate-100">
                        <td className="p-2 pl-3 font-mono font-bold text-slate-700">{`{{${p.key}}}`}</td>
                        <td className="p-2 text-slate-600">{p.label}</td>
                        <td className="p-2 text-slate-400">{p.sample}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white p-5 rounded-[20px] border border-[#ECECEC] shadow-card space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="flex items-center gap-2">
                <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><Eye size={16} /></span>
                <h4 className="font-bold text-slate-800 text-xs">Xem trước email</h4>
              </span>
              {deviceToggle}
            </div>
            <button type="button" onClick={refreshFormPreview} className="w-full py-2 bg-primary/10 hover:bg-primary/15 text-primary rounded-2xl text-xs font-bold transition-all btn-press">
              Làm mới preview (thay dữ liệu mẫu)
            </button>
            {formPreview && (
              <p className="text-[10px] text-slate-500">Subject: <span className="font-semibold text-slate-700">{formPreview.subject}</span></p>
            )}
            {formPreview ? previewFrame(formPreview) : (
              <div className="border border-slate-100 rounded-2xl bg-slate-50 p-8 text-center text-slate-400 text-xs font-medium py-24 flex flex-col items-center gap-2">
                <ClipboardList size={20} strokeWidth={1.5} />
                Bấm "Làm mới preview" để xem email với dữ liệu mẫu
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

export default EmailTemplatesTab;
