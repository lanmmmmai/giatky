import React, { useEffect, useState } from 'react';
import { EmailSettings, getEmailSettings, updateEmailSettings, testEmailSettings } from '../../api/email';
import { useToastStore } from '../../stores/toastStore';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Save, Send, Server, ShieldCheck, XCircle, AlertTriangle } from 'lucide-react';

const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary';

const EmailSettingsTab: React.FC = () => {
  const { addToast } = useToastStore();
  const [loading, setLoading] = useState(true);
  const [migrationNeeded, setMigrationNeeded] = useState('');
  const [hasPassword, setHasPassword] = useState(false);
  const [form, setForm] = useState({
    smtp_host: '', smtp_port: 587, smtp_user: '', smtp_password: '',
    encryption: 'tls' as EmailSettings['encryption'],
    sender_name: '', sender_email: '', is_active: false,
  });
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const s = await getEmailSettings();
        setForm({
          smtp_host: s.smtp_host || '', smtp_port: s.smtp_port || 587,
          smtp_user: s.smtp_user || '', smtp_password: '',
          encryption: s.encryption || 'tls',
          sender_name: s.sender_name || '', sender_email: s.sender_email || '',
          is_active: !!s.is_active,
        });
        setHasPassword(!!s.has_password);
      } catch (err: any) {
        const detail = err.response?.data?.detail || '';
        if (String(detail).includes('migration')) setMigrationNeeded(detail);
        else addToast('Không thể tải cấu hình email.', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = { ...form };
      if (!payload.smtp_password) delete payload.smtp_password; // giữ mật khẩu cũ
      const s = await updateEmailSettings(payload);
      setHasPassword(!!s.has_password);
      setForm(p => ({ ...p, smtp_password: '' }));
      addToast('Đã lưu cấu hình email.', 'success');
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Lưu cấu hình thất bại.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testTo.trim())) {
      setTestError('Email nhận không hợp lệ.');
      return;
    }
    setTesting(true);
    setTestError('');
    try {
      await testEmailSettings(testTo.trim());
      addToast('Email gửi thành công', 'success');
    } catch (err: any) {
      setTestError(err.response?.data?.detail || 'Test SMTP thất bại.');
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  if (migrationNeeded) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-[20px] p-6 flex items-start gap-3">
        <AlertTriangle className="text-amber-500 shrink-0" size={20} />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-amber-700">Cần chạy migration database</h4>
          <p className="text-xs text-amber-700/80 leading-relaxed">{migrationNeeded}</p>
          <p className="text-[10px] text-amber-600">File: <span className="font-mono font-bold">supabase/seo_email_module_migration.sql</span> — chạy trong Supabase SQL Editor rồi tải lại trang.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      <form onSubmit={handleSave} className="lg:col-span-2 bg-white p-6 rounded-[20px] border border-[#ECECEC] shadow-card space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <span className="p-1.5 bg-primary/10 text-primary rounded-lg"><Server size={16} /></span>
          <h4 className="font-bold text-slate-800 text-xs">Email Settings (SMTP)</h4>
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed">
          Khi bật "Gửi qua SMTP", mọi email của hệ thống sẽ đi qua SMTP bên dưới.
          Khi tắt, hệ thống dùng Brevo API như hiện tại.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">SMTP Host</label>
            <input type="text" value={form.smtp_host} onChange={e => setForm(p => ({ ...p, smtp_host: e.target.value }))} placeholder="smtp.gmail.com" className={`${inputCls} font-mono`} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">SMTP Port</label>
            <input type="number" value={form.smtp_port} onChange={e => setForm(p => ({ ...p, smtp_port: Number(e.target.value) || 587 }))} className={`${inputCls} font-mono`} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">SMTP User</label>
            <input type="text" value={form.smtp_user} onChange={e => setForm(p => ({ ...p, smtp_user: e.target.value }))} placeholder="tai-khoan@gmail.com" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">SMTP Password</label>
            <input
              type="password"
              value={form.smtp_password}
              onChange={e => setForm(p => ({ ...p, smtp_password: e.target.value }))}
              placeholder={hasPassword ? '•••••••• (bỏ trống = giữ mật khẩu cũ)' : 'Nhập mật khẩu / app password'}
              className={inputCls}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">Encryption</label>
            <select value={form.encryption} onChange={e => setForm(p => ({ ...p, encryption: e.target.value as EmailSettings['encryption'] }))} className={inputCls}>
              <option value="tls">TLS (STARTTLS — cổng 587)</option>
              <option value="ssl">SSL (cổng 465)</option>
              <option value="none">Không mã hóa</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">Sender Name</label>
            <input type="text" value={form.sender_name} onChange={e => setForm(p => ({ ...p, sender_name: e.target.value }))} placeholder="Giặt Ký" className={inputCls} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-slate-600">Sender Email</label>
            <input type="email" value={form.sender_email} onChange={e => setForm(p => ({ ...p, sender_email: e.target.value }))} placeholder="noreply@giatky.site" className={inputCls} />
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
          <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} className="accent-[#171717] w-4 h-4" />
          <span className="text-xs font-semibold text-slate-600">Gửi email qua SMTP (tắt = dùng Brevo API)</span>
        </label>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 bg-primary hover:bg-primary-dark disabled:bg-secondary text-white rounded-2xl font-bold text-xs shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-1.5"
        >
          <Save size={14} /> {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
        </button>
      </form>

      <div className="bg-white p-6 rounded-[20px] border border-[#ECECEC] shadow-card space-y-4 lg:sticky lg:top-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><ShieldCheck size={16} /></span>
          <h4 className="font-bold text-slate-800 text-xs">Test SMTP</h4>
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed">
          Gửi một email kiểm tra qua cấu hình SMTP <b>đã lưu</b> (kể cả khi chưa bật).
          Hãy bấm "Lưu cấu hình" trước khi test.
        </p>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600">Email nhận</label>
          <input type="email" value={testTo} onChange={e => { setTestTo(e.target.value); setTestError(''); }} placeholder="ban@example.com" className={inputCls} />
        </div>
        {testError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-600 font-semibold flex items-start gap-1.5">
            <XCircle size={14} className="shrink-0 mt-0.5" /> {testError}
          </div>
        )}
        <button
          onClick={handleTest}
          disabled={testing}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-secondary text-white rounded-2xl font-bold text-xs shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-1.5"
        >
          <Send size={13} /> {testing ? 'Đang gửi...' : 'Test SMTP'}
        </button>
      </div>
    </div>
  );
};

export default EmailSettingsTab;
