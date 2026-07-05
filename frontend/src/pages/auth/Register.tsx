import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../../api/client';
import { useToastStore } from '../../stores/toastStore';
import { User, Mail, Lock, Phone, ArrowLeft, Building2 } from 'lucide-react';

interface BranchOption {
  id: string;
  name: string;
}

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToastStore();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [branchId, setBranchId] = useState('');
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch branches for public dropdown selection
    apiClient.get('/branches')
      .then(res => setBranches(res.data || []))
      .catch(() => {
        // Fallback static branches if API requires auth
        setBranches([
          { id: 'b1111111-1111-1111-1111-111111111111', name: 'Chi nhánh Quận 1' },
          { id: 'b2222222-2222-2222-2222-222222222222', name: 'Chi nhánh Bình Thạnh' }
        ]);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !email.trim() || !username.trim() || !password.trim() || !branchId) {
      addToast('Vui lòng điền đầy đủ các thông tin bắt buộc.', 'warning');
      return;
    }

    setLoading(true);
    try {
      // Register staff (which goes to backend users/staff endpoint but bypasses auth if public register is enabled,
      // or we can invoke a registration endpoint in auth: POST /auth/register-staff)
      // Let's call the public register endpoint which registers the staff as pending verification
      const payload = {
        full_name: fullName,
        email: email,
        username: username,
        password: password,
        phone: phone,
        branch_id: branchId,
        hourly_rate: 0 // Default, admin will set this later
      };
      
      // Let's create a public registration route POST /auth/register-staff
      await apiClient.post('/auth/register-staff', payload);
      
      addToast('Yêu cầu đăng ký đã được gửi! Vui lòng kiểm tra email để xác thực tài khoản.', 'success');
      navigate('/login');
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Đăng ký tài khoản thất bại.', 'error');
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
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Đăng Ký Tài Khoản Staff</h2>
        <p className="text-xs text-slate-500 font-medium">Gửi yêu cầu đăng ký tài khoản nhân viên tiệm giặt</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Họ và tên *</label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Nguyễn Văn A"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Tên đăng nhập *</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Số điện thoại</label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="0987654321"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Email thật *</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Mật khẩu *</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Cơ sở làm việc *</label>
          <div className="relative">
            <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none appearance-none"
              required
            >
              <option value="">Chọn cơ sở làm việc</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.99]"
          disabled={loading}
        >
          {loading ? 'Đang xử lý đăng ký...' : 'Đăng ký làm Staff'}
        </button>
      </form>
    </div>
  );
};

export default Register;
