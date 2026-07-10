import React, { useEffect, useState } from 'react';
import { getRevenueReport, RevenueReport } from '../../api/reports';
import { getBranches, Branch } from '../../api/branches';
import { getUsers } from '../../api/users';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import * as XLSX from 'xlsx';
import { Calendar, Filter, CircleDollarSign, BarChart3, TrendingUp, Download, Users, Briefcase } from 'lucide-react';

const COLORS = ['#2563EB', '#06B6D4', '#6366F1', '#10B981', '#F59E0B', '#EC4899'];

const Reports: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();

  const [report, setReport] = useState<RevenueReport | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [staffUsers, setStaffUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [branchId, setBranchId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');

  useEffect(() => {
    loadFilterOptions();
    loadReportData();
  }, [branchId, staffId, startDate, endDate, paymentStatus, paymentMethod]);

  const loadFilterOptions = async () => {
    try {
      if (user?.role !== 'staff') {
        const [branchesData, allUsers] = await Promise.all([
          getBranches(),
          getUsers()
        ]);
        const safeBranches = Array.isArray(branchesData) ? branchesData : [];
        const safeUsers = Array.isArray(allUsers) ? allUsers : [];
        setBranches(safeBranches);
        setStaffUsers(safeUsers.filter(u => u.role === 'staff'));
      }
    } catch (_) {}
  };

  const loadReportData = async () => {
    setLoading(true);
    try {
      const data = await getRevenueReport({
        branch_id: branchId || undefined,
        staff_id: staffId || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        payment_status: paymentStatus || undefined,
        payment_method: paymentMethod || undefined
      });
      setReport(data);
    } catch (_) {
      addToast('Không thể tải dữ liệu báo cáo.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (!report) return;

    try {
      // 1. Create a workbook
      const wb = XLSX.utils.book_new();

      // 2. Prepare summary tab data
      const summaryData = [
        { 'Chỉ số báo cáo': 'Tổng doanh thu phát sinh', 'Giá trị': formatCurrency(report.summary.total_revenue) },
        { 'Chỉ số báo cáo': 'Đã thu tiền', 'Giá trị': formatCurrency(report.summary.paid_revenue) },
        { 'Chỉ số báo cáo': 'Chưa thu tiền (Công nợ)', 'Giá trị': formatCurrency(report.summary.unpaid_revenue) },
        { 'Chỉ số báo cáo': 'Tổng số đơn hàng', 'Giá trị': report.summary.total_orders },
        { 'Chỉ số báo cáo': 'Giá trị trung bình đơn', 'Giá trị': formatCurrency(report.summary.average_order_value) }
      ];
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Tổng quan');

      // 3. Prepare branch tab data
      if (report.revenue_by_branch.length > 0) {
        const wsBranch = XLSX.utils.json_to_sheet(report.revenue_by_branch.map(b => ({
          'Cơ sở chi nhánh': b.branch_name,
          'Doanh thu': b.revenue
        })));
        XLSX.utils.book_append_sheet(wb, wsBranch, 'Doanh thu theo cơ sở');
      }

      // 4. Prepare services tab data
      if (report.revenue_by_service.length > 0) {
        const wsService = XLSX.utils.json_to_sheet(report.revenue_by_service.map(s => ({
          'Dịch vụ giặt': s.service_name,
          'Doanh thu': s.revenue
        })));
        XLSX.utils.book_append_sheet(wb, wsService, 'Doanh thu theo dịch vụ');
      }

      // Download
      XLSX.writeFile(wb, `Bao_cao_doanh_thu_Lanh_Sach_${new Date().toISOString().slice(0, 10)}.xlsx`);
      addToast('Tải báo cáo Excel thành công.', 'success');
    } catch (_) {
      addToast('Xuất báo cáo Excel thất bại.', 'error');
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Báo cáo thống kê</h2>
          <p className="text-xs text-slate-500">Phân tích chuyên sâu doanh thu, công nợ, hiệu suất chi nhánh và dịch vụ</p>
        </div>
        <button
          onClick={handleExportExcel}
          disabled={!report}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-1.5"
        >
          <Download size={16} />
          Xuất báo cáo Excel
        </button>
      </div>

      {/* Filter panel */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-1.5 text-slate-600 text-xs font-bold border-b border-slate-100 pb-2">
          <Filter size={16} className="text-primary" />
          Bộ lọc nâng cao
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
          {/* Branch */}
          {user?.role !== 'staff' && (
            <div className="space-y-1">
              <label className="font-semibold text-slate-600">Cơ sở chi nhánh</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:bg-white transition-all"
              >
                <option value="">Tất cả</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Staff */}
          {user?.role !== 'staff' && (
            <div className="space-y-1">
              <label className="font-semibold text-slate-600">Nhân viên tiếp nhận</label>
              <select
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:bg-white transition-all"
              >
                <option value="">Tất cả</option>
                {staffUsers.map(st => (
                  <option key={st.id} value={st.id}>{st.full_name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Start Date */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-600">Từ ngày</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:bg-white transition-all"
            />
          </div>

          {/* End Date */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-600">Đến ngày</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:bg-white transition-all"
            />
          </div>

          {/* Payment Status */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-600">Thanh toán</label>
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:bg-white transition-all"
            >
              <option value="">Tất cả</option>
              <option value="unpaid">Chưa thanh toán</option>
              <option value="paid">Đã thanh toán</option>
              <option value="partial">Thanh toán một phần</option>
            </select>
          </div>

          {/* Payment Method */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-600">Phương thức</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:bg-white transition-all"
            >
              <option value="">Tất cả</option>
              <option value="cash">Tiền mặt</option>
              <option value="bank_transfer">Chuyển khoản</option>
              <option value="e_wallet">Ví điện tử</option>
              <option value="none">Chưa nộp tiền</option>
            </select>
          </div>
        </div>
      </div>

      {loading && !report ? (
        <LoadingSpinner />
      ) : !report ? (
        <EmptyState message="Không có dữ liệu báo cáo." />
      ) : (
        <div className="space-y-6">
          {/* Summary metrics widgets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Doanh thu phát sinh</p>
                <h4 className="text-sm font-bold text-slate-800 mt-1">{formatCurrency(report.summary.total_revenue)}</h4>
              </div>
              <CircleDollarSign size={20} className="text-primary" />
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Đã thanh toán</p>
                <h4 className="text-sm font-bold text-slate-800 mt-1">{formatCurrency(report.summary.paid_revenue)}</h4>
              </div>
              <CircleDollarSign size={20} className="text-emerald-500" />
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Công nợ/Chưa thu</p>
                <h4 className="text-sm font-bold text-slate-800 mt-1">{formatCurrency(report.summary.unpaid_revenue)}</h4>
              </div>
              <CircleDollarSign size={20} className="text-rose-500" />
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tổng đơn tiếp nhận</p>
                <h4 className="text-sm font-bold text-slate-800 mt-1">{report.summary.total_orders} đơn</h4>
              </div>
              <BarChart3 size={20} className="text-indigo-500" />
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Giá trị trung bình đơn</p>
                <h4 className="text-sm font-bold text-slate-800 mt-1">{formatCurrency(report.summary.average_order_value)}</h4>
              </div>
              <TrendingUp size={20} className="text-secondary" />
            </div>
            
          </div>

          {/* Charts section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Service Sales Performance Chart */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <Briefcase size={14} className="text-primary" /> Doanh thu theo dịch vụ giặt sấy
              </h3>
              {report.revenue_by_service.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.revenue_by_service} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                      <XAxis type="number" stroke="#94A3B8" fontSize={10} tickFormatter={(v) => `${v/1000}k`} />
                      <YAxis dataKey="service_name" type="category" stroke="#94A3B8" fontSize={9} tickLine={false} width={100} />
                      <Tooltip formatter={(value: any) => [formatCurrency(value), 'Doanh thu']} />
                      <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                        {report.revenue_by_service.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-xs text-slate-400">Không có dữ liệu doanh số dịch vụ.</div>
              )}
            </div>

            {/* Staff efficiency chart */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <Users size={14} className="text-primary" /> Hiệu suất doanh thu theo nhân viên
              </h3>
              {report.revenue_by_staff.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.revenue_by_staff} margin={{ bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="staff_name" stroke="#94A3B8" fontSize={10} tickLine={false} />
                      <YAxis stroke="#94A3B8" fontSize={10} tickFormatter={(v) => `${v/1000}k`} />
                      <Tooltip formatter={(value: any) => [formatCurrency(value), 'Doanh thu']} />
                      <Bar dataKey="revenue" fill="#6366F1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-xs text-slate-400">Không có dữ liệu hiệu suất nhân sự.</div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
