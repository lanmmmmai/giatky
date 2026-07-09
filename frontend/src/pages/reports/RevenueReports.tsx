import React, { useEffect, useState } from 'react';
import { useAuthStore, User } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import {
  getMonthlyReports,
  createReport,
  updateManualFields,
  submitReport,
  approveReport,
  rejectReport,
  RevenueReport
} from '../../api/revenueReports';
import { getBranches, Branch } from '../../api/branches';
import { getUsers } from '../../api/users';
import {
  Download,
  Save,
  Send,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  AlertTriangle,
  RotateCcw,
  Plus
} from 'lucide-react';
import apiClient from '../../api/client';

const RevenueReports: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();

  const [reports, setReports] = useState<RevenueReport[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  // Local inline editing states
  // Keyed by report_date string
  const [editedData, setEditedData] = useState<Record<string, {
    opening_cash: number;
    expense_amount: number;
    expense_description: string;
    note: string;
  }>>({});
  
  const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});

  // Reject dialog
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReasonText, setRejectReasonText] = useState('');
  const [rejectModalOpen, setRejectModalOpen] = useState(false);

  useEffect(() => {
    loadBranches();
  }, [user]);

  useEffect(() => {
    if (user) {
      const activeBranchId = user.role === 'staff' ? user.branch_id : selectedBranchId;
      if (activeBranchId) {
        loadMonthlyReports(activeBranchId, selectedMonth, selectedYear);
      }
    }
  }, [selectedMonth, selectedYear, selectedBranchId, user]);

  const loadBranches = async () => {
    try {
      if (user?.role !== 'staff') {
        const branchesData = await getBranches();
        const safeBranches = Array.isArray(branchesData) ? branchesData : [];
        setBranches(safeBranches);
        if (safeBranches.length > 0) {
          setSelectedBranchId(safeBranches[0].id);
        }
      } else {
        setSelectedBranchId(user.branch_id || '');
      }
    } catch (_) {
      addToast('Không thể tải danh sách chi nhánh.', 'error');
    }
  };

  const loadMonthlyReports = async (branchId: string, month: number, year: number) => {
    setLoading(true);
    try {
      const data = await getMonthlyReports(branchId, month, year);
      setReports(Array.isArray(data) ? data : []);
      // Reset editing states on load
      setEditedData({});
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Không thể tải báo cáo doanh thu.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getBranchName = () => {
    if (user?.role === 'staff') {
      return 'Cơ sở của bạn';
    }
    const br = branches.find(b => b.id === selectedBranchId);
    return br ? br.name : 'Chi nhánh';
  };

  const handleCellChange = (reportDate: string, field: string, value: any) => {
    const dayReport = reports.find(r => r.report_date === reportDate);
    const currentEdit = editedData[reportDate] || {
      opening_cash: dayReport?.opening_cash || 0,
      expense_amount: dayReport?.expense_amount || 0,
      expense_description: dayReport?.expense_description || '',
      note: dayReport?.note || ''
    };

    const updated = {
      ...currentEdit,
      [field]: value
    };

    setEditedData({
      ...editedData,
      [reportDate]: updated
    });
  };

  const getCellValue = (rep: RevenueReport, field: 'opening_cash' | 'expense_amount' | 'expense_description' | 'note') => {
    if (editedData[rep.report_date] !== undefined && editedData[rep.report_date][field] !== undefined) {
      return editedData[rep.report_date][field];
    }
    return rep[field] ?? (field === 'opening_cash' || field === 'expense_amount' ? 0 : '');
  };

  const calculateRowOpeningCash = (rep: RevenueReport) => {
    let rolling = 0;
    for (let i = 0; i < reports.length; i++) {
      const r = reports[i];
      const day = i + 1;
      const cellOpening = day === 1 ? Number(getCellValue(r, 'opening_cash')) : rolling;
      const cellExpense = Number(getCellValue(r, 'expense_amount'));
      const closing = cellOpening + (r.order_cash || 0) + (r.debt_cash || 0) - cellExpense;
      
      if (r.report_date === rep.report_date) {
        return cellOpening;
      }
      rolling = closing;
    }
    return 0;
  };

  const isRowDirty = (rep: RevenueReport, day: number) => {
    const edit = editedData[rep.report_date];
    if (!edit) return false;
    if (day === 1) {
      return (
        edit.opening_cash !== (rep.opening_cash || 0) ||
        edit.expense_amount !== (rep.expense_amount || 0) ||
        edit.expense_description !== (rep.expense_description || '') ||
        edit.note !== (rep.note || '')
      );
    } else {
      return (
        edit.expense_amount !== (rep.expense_amount || 0) ||
        edit.expense_description !== (rep.expense_description || '') ||
        edit.note !== (rep.note || '')
      );
    }
  };

  const handleSaveRow = async (rep: RevenueReport) => {
    // Get existing edits or fallback to default object to allow saving calculated rows too
    const edit = editedData[rep.report_date] || {
      opening_cash: rep.opening_cash,
      expense_amount: rep.expense_amount,
      expense_description: rep.expense_description,
      note: rep.note
    };

    if (edit.expense_amount > 0 && !edit.expense_description.trim()) {
      addToast(`Vui lòng nhập diễn giải phát sinh cho ngày ${rep.report_date}`, 'warning');
      return;
    }

    setSavingRows(prev => ({ ...prev, [rep.report_date]: true }));
    try {
      const activeBranchId = user?.role === 'staff' ? user.branch_id : selectedBranchId;
      if (!activeBranchId) throw new Error('Chưa chọn chi nhánh.');

      const calculatedOpening = calculateRowOpeningCash(rep);

      if (rep.id) {
        // Update manual fields
        await updateManualFields(rep.id, {
          opening_cash: Number(calculatedOpening),
          expense_amount: Number(edit.expense_amount),
          expense_description: edit.expense_description,
          note: edit.note
        });
      } else {
        // Create new report
        await createReport({
          report_date: rep.report_date,
          branch_id: activeBranchId,
          opening_cash: Number(calculatedOpening),
          expense_amount: Number(edit.expense_amount),
          expense_description: edit.expense_description,
          note: edit.note
        });
      }

      addToast(`Đã lưu thành công dữ liệu ngày ${rep.report_date}`, 'success');
      
      // Clean up edited state
      const nextEdited = { ...editedData };
      delete nextEdited[rep.report_date];
      setEditedData(nextEdited);

      // Refresh
      loadMonthlyReports(activeBranchId, selectedMonth, selectedYear);
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Lưu dữ liệu thất bại.', 'error');
    } finally {
      setSavingRows(prev => ({ ...prev, [rep.report_date]: false }));
    }
  };

  const handleSubmitRow = async (id: string, reportDate: string) => {
    try {
      await submitReport(id);
      addToast(`Đã gửi duyệt báo cáo ngày ${reportDate}`, 'success');
      const activeBranchId = user?.role === 'staff' ? user.branch_id : selectedBranchId;
      if (activeBranchId) loadMonthlyReports(activeBranchId, selectedMonth, selectedYear);
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Không thể gửi duyệt.', 'error');
    }
  };

  const handleApproveRow = async (id: string, reportDate: string) => {
    try {
      await approveReport(id);
      addToast(`Đã duyệt báo cáo ngày ${reportDate}`, 'success');
      const activeBranchId = user?.role === 'staff' ? user.branch_id : selectedBranchId;
      if (activeBranchId) loadMonthlyReports(activeBranchId, selectedMonth, selectedYear);
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Duyệt báo cáo thất bại.', 'error');
    }
  };

  const openRejectDialog = (id: string) => {
    setRejectId(id);
    setRejectReasonText('');
    setRejectModalOpen(true);
  };

  const handleRejectRow = async () => {
    if (!rejectId) return;
    try {
      await rejectReport(rejectId, rejectReasonText);
      addToast('Đã từ chối báo cáo thành công.', 'success');
      setRejectModalOpen(false);
      const activeBranchId = user?.role === 'staff' ? user.branch_id : selectedBranchId;
      if (activeBranchId) loadMonthlyReports(activeBranchId, selectedMonth, selectedYear);
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Từ chối thất bại.', 'error');
    }
  };

  const handleExportExcel = () => {
    const activeBranchId = user?.role === 'staff' ? user.branch_id : selectedBranchId;
    if (!activeBranchId) return;

    const token = localStorage.getItem('lanh_sach_token');
    const downloadUrl = `${apiClient.defaults.baseURL}/revenue-reports/export-excel?branch_id=${activeBranchId}&month=${selectedMonth}&year=${selectedYear}&token=${token}`;
    window.open(downloadUrl, '_blank');
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  // Compute column aggregates for the bottom sum row
  const totals = reports.reduce((acc, r) => {
    // Determine opening cash & expense amount considering active edits
    const op = editedData[r.report_date]?.opening_cash !== undefined 
      ? Number(editedData[r.report_date].opening_cash) 
      : (r.opening_cash || 0);

    const exp = editedData[r.report_date]?.expense_amount !== undefined 
      ? Number(editedData[r.report_date].expense_amount) 
      : (r.expense_amount || 0);

    const closing = op + (r.order_cash || 0) + (r.debt_cash || 0) - exp;

    acc.opening_cash += op;
    acc.daily_revenue += r.daily_revenue || 0;
    acc.order_invoice_count += r.order_invoice_count || 0;
    acc.order_bank_transfer += r.order_bank_transfer || 0;
    acc.order_cash += r.order_cash || 0;
    acc.order_debt += r.order_debt || 0;
    acc.debt_collection_total += r.debt_collection_total || 0;
    acc.debt_invoice_count += r.debt_invoice_count || 0;
    acc.debt_bank_transfer += r.debt_bank_transfer || 0;
    acc.debt_cash += r.debt_cash || 0;
    acc.expense_amount += exp;
    acc.closing_cash += closing;
    return acc;
  }, {
    opening_cash: 0,
    daily_revenue: 0,
    order_invoice_count: 0,
    order_bank_transfer: 0,
    order_cash: 0,
    order_debt: 0,
    debt_collection_total: 0,
    debt_invoice_count: 0,
    debt_bank_transfer: 0,
    debt_cash: 0,
    expense_amount: 0,
    closing_cash: 0
  });

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">
            Báo cáo doanh thu tháng {selectedMonth}/{selectedYear}
          </h1>
          <p className="text-xs font-semibold text-slate-400 mt-1">
            {getBranchName()} • Hệ thống tự tổng hợp số liệu đơn hàng
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {reports.length > 0 && (
            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/10"
            >
              <Download size={14} />
              Xuất Excel
            </button>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap gap-4 items-center">
        {user?.role !== 'staff' && (
          <div className="flex flex-col gap-1 w-full sm:w-48">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cơ sở</label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-xl text-xs outline-none transition-all"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1 w-28">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tháng</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-xl text-xs outline-none transition-all"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>Tháng {m}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 w-28">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Năm</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-xl text-xs outline-none transition-all"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Spreadsheet Grid Container */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-20 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : reports.length === 0 ? (
          <div className="p-16">
            <EmptyState
              message="Không tìm thấy dữ liệu"
              subMessage="Vui lòng chọn cơ sở chi nhánh hợp lệ để hiển thị báo cáo doanh thu."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed min-w-[1400px]">
              <colgroup>
                <col style={{ width: '48px' }} /> {/* STT */}
                <col style={{ width: '80px' }} /> {/* Ngày */}
                <col style={{ width: '100px' }} /> {/* Đầu kỳ */}
                <col style={{ width: '130px' }} /> {/* Doanh thu lũy kế */}
                <col style={{ width: '130px' }} /> {/* Doanh thu ngày */}
                <col style={{ width: '60px' }} /> {/* Nhận đơn: Số HD */}
                <col style={{ width: '110px' }} /> {/* Nhận đơn: CK */}
                <col style={{ width: '110px' }} /> {/* Nhận đơn: TM */}
                <col style={{ width: '110px' }} /> {/* Nhận đơn: Nợ */}
                <col style={{ width: '130px' }} /> {/* Thu nợ: Tổng thu nợ */}
                <col style={{ width: '60px' }} /> {/* Thu nợ: Số HD */}
                <col style={{ width: '110px' }} /> {/* Thu nợ: CK */}
                <col style={{ width: '110px' }} /> {/* Thu nợ: TM */}
                <col style={{ width: '110px' }} /> {/* Phát sinh: Số tiền */}
                <col style={{ width: '180px' }} /> {/* Phát sinh: Diễn giải */}
                <col style={{ width: '140px' }} /> {/* Tổng tiền tại CH */}
                <col style={{ width: '160px' }} /> {/* Ghi chú */}
                <col style={{ width: '150px' }} /> {/* Trạng thái / Tác vụ */}
              </colgroup>
              <thead>
                <tr className="bg-emerald-500/10 text-emerald-950 border-b border-slate-200">
                  <th rowSpan={2} className="w-12 text-center text-[10px] font-bold p-2 border-r border-slate-200">STT</th>
                  <th rowSpan={2} className="w-20 text-center text-[10px] font-bold p-2 border-r border-slate-200">Ngày</th>
                  <th rowSpan={2} className="w-28 text-right text-[10px] font-bold p-2 border-r border-slate-200">Đầu kỳ</th>
                  <th rowSpan={2} className="w-32 text-right text-[10px] font-bold p-2 border-r border-slate-200">Doanh thu lũy kế</th>
                  <th rowSpan={2} className="w-32 text-right text-[10px] font-bold p-2 border-r border-slate-200">Doanh thu ngày</th>
                  <th colSpan={4} className="text-center text-[10px] font-bold p-1 border-r border-slate-200 border-b border-slate-200/50">Nhận đơn: xHD</th>
                  <th colSpan={4} className="text-center text-[10px] font-bold p-1 border-r border-slate-200 border-b border-slate-200/50">Thu nợ: xHD</th>
                  <th colSpan={2} className="text-center text-[10px] font-bold p-1 border-r border-slate-200 border-b border-slate-200/50">Phát sinh</th>
                  <th rowSpan={2} className="w-32 text-right text-[10px] font-bold p-2 border-r border-slate-200">Tổng tiền tại CH</th>
                  <th rowSpan={2} className="w-40 text-left text-[10px] font-bold p-2 border-r border-slate-200">Ghi chú</th>
                  <th rowSpan={2} className="w-36 text-center text-[10px] font-bold p-2">Trạng thái / Tác vụ</th>
                </tr>
                <tr className="bg-emerald-500/5 text-emerald-800 border-b border-slate-200">
                  <th className="w-16 text-center text-[9px] font-bold p-1 border-r border-slate-200">Số HD</th>
                  <th className="w-28 text-right text-[9px] font-bold p-1 border-r border-slate-200">CK</th>
                  <th className="w-28 text-right text-[9px] font-bold p-1 border-r border-slate-200">TM</th>
                  <th className="w-28 text-right text-[9px] font-bold p-1 border-r border-slate-200">Nợ</th>
                  <th className="w-32 text-right text-[9px] font-bold p-1 border-r border-slate-200">Tổng thu nợ</th>
                  <th className="w-16 text-center text-[9px] font-bold p-1 border-r border-slate-200">Số HD</th>
                  <th className="w-28 text-right text-[9px] font-bold p-1 border-r border-slate-200">CK</th>
                  <th className="w-28 text-right text-[9px] font-bold p-1 border-r border-slate-200">TM</th>
                  <th className="w-28 text-right text-[9px] font-bold p-1 border-r border-slate-200">Số tiền</th>
                  <th className="w-48 text-left text-[9px] font-bold p-1 border-r border-slate-200">Diễn giải</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let rollingClosingCash = 0;
                  return reports.map((rep, idx) => {
                    const day = idx + 1;
                    const isDirty = isRowDirty(rep, day);
                    const isSaving = savingRows[rep.report_date] || false;
                    const isReadOnly = rep.status === 'approved' && user?.role !== 'admin';

                    const cellOpening = day === 1 ? Number(getCellValue(rep, 'opening_cash')) : rollingClosingCash;
                    const cellExpense = Number(getCellValue(rep, 'expense_amount'));
                    const currentClosingCash = cellOpening + (rep.order_cash || 0) + (rep.debt_cash || 0) - cellExpense;

                    // Update rolling cash for next day
                    rollingClosingCash = currentClosingCash;

                    return (
                      <tr
                        key={rep.report_date}
                        className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors text-xs text-slate-700"
                      >
                        <td className="text-center p-2 border-r border-slate-150 bg-slate-50/30">{day}</td>
                        <td className="text-center p-2 border-r border-slate-150 font-medium">{String(day).padStart(2, '0')}/{String(selectedMonth).padStart(2, '0')}</td>
                        <td className="p-1 border-r border-slate-150">
                          <input
                            type="number"
                            value={day === 1 ? getCellValue(rep, 'opening_cash') : cellOpening}
                            onChange={(e) => handleCellChange(rep.report_date, 'opening_cash', e.target.value)}
                            disabled={day > 1 || isReadOnly || isSaving}
                            className={`w-full px-2 py-1 text-right bg-transparent rounded border focus:bg-white focus:border-blue-500 outline-none transition-all ${
                              day > 1 || isReadOnly ? 'border-transparent font-semibold bg-amber-50/20' : 'border-slate-200'
                            }`}
                          />
                        </td>

                      <td className="p-2 border-r border-slate-150 text-right bg-amber-50/50 font-semibold text-slate-800">
                        {formatCurrency(rep.cumulative_revenue)}
                      </td>

                      <td className="p-2 border-r border-slate-150 text-right bg-amber-50/50 font-bold text-slate-900">
                        {formatCurrency(rep.daily_revenue)}
                      </td>

                      <td className="p-2 border-r border-slate-150 text-center text-slate-500">{rep.order_invoice_count}</td>
                      <td className="p-2 border-r border-slate-150 text-right text-slate-600">{formatCurrency(rep.order_bank_transfer)}</td>
                      <td className="p-2 border-r border-slate-150 text-right text-slate-600">{formatCurrency(rep.order_cash)}</td>
                      <td className="p-2 border-r border-slate-150 text-right text-rose-600 font-medium">{formatCurrency(rep.order_debt)}</td>

                      <td className="p-2 border-r border-slate-150 text-right bg-amber-50/30 font-semibold text-slate-800">
                        {formatCurrency(rep.debt_collection_total)}
                      </td>
                      <td className="p-2 border-r border-slate-150 text-center text-slate-500">{rep.debt_invoice_count}</td>
                      <td className="p-2 border-r border-slate-150 text-right text-slate-600">{formatCurrency(rep.debt_bank_transfer)}</td>
                      <td className="p-2 border-r border-slate-150 text-right text-slate-600">{formatCurrency(rep.debt_cash)}</td>

                      <td className="p-1 border-r border-slate-150">
                        <input
                          type="number"
                          value={getCellValue(rep, 'expense_amount')}
                          onChange={(e) => handleCellChange(rep.report_date, 'expense_amount', e.target.value)}
                          disabled={isReadOnly || isSaving}
                          className={`w-full px-2 py-1 text-right bg-transparent rounded border focus:bg-white focus:border-blue-500 outline-none transition-all ${
                            isReadOnly ? 'border-transparent' : 'border-slate-200'
                          }`}
                        />
                      </td>

                      <td className="p-1 border-r border-slate-150">
                        <input
                          type="text"
                          value={getCellValue(rep, 'expense_description')}
                          onChange={(e) => handleCellChange(rep.report_date, 'expense_description', e.target.value)}
                          placeholder={cellExpense > 0 ? "Nhập lý do chi..." : "Lý do chi..."}
                          disabled={isReadOnly || isSaving}
                          className={`w-full px-2 py-1 bg-transparent rounded border focus:bg-white focus:border-blue-500 outline-none transition-all ${
                            isReadOnly ? 'border-transparent' : 'border-slate-200'
                          }`}
                        />
                      </td>

                      <td className="p-2 border-r border-slate-150 text-right bg-amber-50/50 font-bold text-slate-900">
                        {formatCurrency(currentClosingCash)}
                      </td>

                      <td className="p-1 border-r border-slate-150">
                        <input
                          type="text"
                          value={getCellValue(rep, 'note')}
                          onChange={(e) => handleCellChange(rep.report_date, 'note', e.target.value)}
                          placeholder="Ghi chú ngày..."
                          disabled={isReadOnly || isSaving}
                          className={`w-full px-2 py-1 bg-transparent rounded border focus:bg-white focus:border-blue-500 outline-none transition-all ${
                            isReadOnly ? 'border-transparent' : 'border-slate-200'
                          }`}
                        />
                      </td>

                      <td className="p-2 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1 justify-center">
                          {rep.id ? (
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                              rep.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                              rep.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                              rep.status === 'rejected' ? 'bg-rose-100 text-rose-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {rep.status === 'approved' ? 'Đã duyệt' :
                               rep.status === 'submitted' ? 'Chờ duyệt' :
                               rep.status === 'rejected' ? 'Bị từ chối' :
                               'Bản nháp'}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-400">
                              Chưa tạo
                            </span>
                          )}

                          <div className="flex items-center gap-1">
                            {isDirty && (
                              <button
                                onClick={() => handleSaveRow(rep)}
                                disabled={isSaving}
                                title="Lưu thông tin"
                                className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all flex items-center justify-center"
                              >
                                <Save size={11} />
                              </button>
                            )}

                            {rep.id && rep.status === 'draft' && user?.role === 'staff' && (
                              <button
                                onClick={() => handleSubmitRow(rep.id!, rep.report_date)}
                                title="Gửi duyệt báo cáo"
                                className="p-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all flex items-center justify-center"
                              >
                                <Send size={11} />
                              </button>
                            )}

                            {rep.id && rep.status === 'submitted' && (user?.role === 'manager' || user?.role === 'admin') && (
                              <>
                                <button
                                  onClick={() => handleApproveRow(rep.id!, rep.report_date)}
                                  title="Duyệt báo cáo"
                                  className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all flex items-center justify-center"
                                >
                                  <CheckCircle size={11} />
                                </button>
                                <button
                                  onClick={() => openRejectDialog(rep.id!)}
                                  title="Từ chối báo cáo"
                                  className="p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-all flex items-center justify-center"
                                >
                                  <XCircle size={11} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                    );
                  });
                })()}

                <tr className="bg-slate-50 border-t-2 border-slate-300 text-slate-800 font-bold border-b-4 border-double border-slate-300">
                  <td colSpan={2} className="text-center p-3 border-r border-slate-200">TỔNG CỘNG</td>
                  <td className="p-3 text-right border-r border-slate-200">{formatCurrency(totals.opening_cash)}</td>
                  <td className="p-3 text-right border-r border-slate-200 bg-amber-50/50">-</td>
                  <td className="p-3 text-right border-r border-slate-200 bg-amber-50/50">{formatCurrency(totals.daily_revenue)}</td>
                  
                  <td className="p-3 text-center border-r border-slate-200">{totals.order_invoice_count}</td>
                  <td className="p-3 text-right border-r border-slate-200">{formatCurrency(totals.order_bank_transfer)}</td>
                  <td className="p-3 text-right border-r border-slate-200">{formatCurrency(totals.order_cash)}</td>
                  <td className="p-3 text-right border-r border-slate-200 text-rose-600">{formatCurrency(totals.order_debt)}</td>

                  <td className="p-3 text-right border-r border-slate-200 bg-amber-50/30">{formatCurrency(totals.debt_collection_total)}</td>
                  <td className="p-3 text-center border-r border-slate-200">{totals.debt_invoice_count}</td>
                  <td className="p-3 text-right border-r border-slate-200">{formatCurrency(totals.debt_bank_transfer)}</td>
                  <td className="p-3 text-right border-r border-slate-200">{formatCurrency(totals.debt_cash)}</td>

                  <td className="p-3 text-right border-r border-slate-200">{formatCurrency(totals.expense_amount)}</td>
                  <td className="p-3 border-r border-slate-200">-</td>

                  <td className="p-3 text-right border-r border-slate-200 bg-amber-50/50">{formatCurrency(totals.closing_cash)}</td>
                  <td className="p-3 border-r border-slate-200">-</td>
                  <td className="p-3">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rejectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Từ chối duyệt báo cáo</h3>
            <p className="text-xs text-slate-400">
              Vui lòng nhập lý do từ chối báo cáo này.
            </p>
            <textarea
              value={rejectReasonText}
              onChange={(e) => setRejectReasonText(e.target.value)}
              placeholder="Nhập lý do từ chối..."
              rows={3}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 rounded-xl text-xs outline-none transition-all resize-none font-medium"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectModalOpen(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold transition-all"
              >
                Hủy
              </button>
              <button
                onClick={handleRejectRow}
                disabled={!rejectReasonText.trim()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-450 text-white rounded-xl text-xs font-semibold transition-all"
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RevenueReports;
