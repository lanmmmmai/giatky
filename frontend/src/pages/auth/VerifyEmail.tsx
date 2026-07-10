import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import apiClient from '../../api/client';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Đang tiến hành xác thực tài khoản...');

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Mã xác thực không hợp lệ hoặc đã hết hạn.');
      return;
    }

    apiClient.get(`/auth/verify-email?token=${token}`)
      .then(res => {
        setStatus('success');
        setMessage(res.data?.message || 'Xác thực tài khoản thành công!');
      })
      .catch(err => {
        setStatus('error');
        setMessage(err.response?.data?.detail || 'Xác thực tài khoản thất bại.');
      });
  }, [token]);

  return (
    <div className="text-center space-y-6">
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center font-bold text-white text-xl shadow-md mx-auto mb-4">
          GK
        </div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Xác Thực Tài Khoản</h2>
      </div>

      <div className="py-4 flex flex-col items-center justify-center">
        {status === 'loading' && (
          <div className="space-y-4">
            <Loader2 className="animate-spin text-primary mx-auto" size={48} />
            <p className="text-sm text-slate-500 font-medium">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <CheckCircle2 className="text-emerald-500 mx-auto animate-bounce" size={54} />
            <p className="text-sm text-slate-600 font-semibold">{message}</p>
            <p className="text-xs text-slate-500">Bây giờ bạn đã có thể đăng nhập vào hệ thống để bắt đầu làm việc.</p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <XCircle className="text-rose-500 mx-auto" size={54} />
            <p className="text-sm text-rose-600 font-semibold">{message}</p>
            <p className="text-xs text-slate-500">Mã kích hoạt có thể đã hết hạn hoặc không tồn tại. Vui lòng liên hệ Admin.</p>
          </div>
        )}
      </div>

      {status !== 'loading' && (
        <Link
          to="/login"
          className="w-full py-3 bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold text-sm inline-block shadow-md transition-all active:scale-[0.99]"
        >
          Quay lại Đăng nhập
        </Link>
      )}
    </div>
  );
};

export default VerifyEmail;
