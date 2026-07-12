import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import { useToastStore } from '../../stores/toastStore';
import { Mail, ArrowLeft, Send } from 'lucide-react';

const ForgotPassword: React.FC = () => {
  const { addToast } = useToastStore();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      addToast('Vui lòng nhập email.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post('/auth/forgot-password', { email });
      setSubmitted(true);
      if (res.data?.email_status === 'failed') {
        addToast(res.data.message, 'warning');
      } else {
        addToast('Yêu cầu đã được gửi! Vui lòng kiểm tra email của bạn.', 'success');
      }
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Gửi yêu cầu thất bại.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/login" className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <span className="text-sm font-semibold text-slate-500">Quay lại Đăng nhập</span>
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Quên Mật Khẩu?</h2>
        <p className="text-xs text-slate-500 font-medium">Chúng tôi sẽ gửi đường dẫn khôi phục mật khẩu qua email của bạn.</p>
      </div>

      {!submitted ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Email đăng ký tài khoản</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-primary hover:bg-primary-dark disabled:bg-secondary text-white rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.99]"
            disabled={loading}
          >
            <Send size={16} />
            {loading ? 'Đang gửi...' : 'Gửi yêu cầu khôi phục'}
          </button>
        </form>
      ) : (
        <div className="bg-primary/10 border border-primary/20 text-primary-dark p-4 rounded-2xl text-center text-sm leading-relaxed">
          Đường dẫn khôi phục mật khẩu đã được gửi đến email <strong>{email}</strong>. Vui lòng kiểm tra hộp thư đến (và thư rác) để hoàn tất.
        </div>
      )}
    </div>
  );
};

export default ForgotPassword;
