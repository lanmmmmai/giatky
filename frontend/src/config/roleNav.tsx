import React from 'react';
import {
  LayoutDashboard,
  FileText,
  TrendingUp,
  Users,
  DollarSign,
  Briefcase,
  Globe,
  MessageSquare,
  Settings,
  MapPin,
  Clock,
} from 'lucide-react';
import type { User } from '../stores/authStore';

export type Role = User['role'];

export interface NavItem {
  path: string; // relative to the role's base path, e.g. 'dashboard'
  name: string;
  icon: React.ReactNode;
}

// Sidebar items per role. Order here defines render order.
export const ROLE_NAV: Record<Role, NavItem[]> = {
  admin: [
    { path: 'dashboard', name: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { path: 'orders', name: 'Đơn hàng', icon: <FileText size={20} /> },
    { path: 'reports', name: 'Báo cáo doanh thu', icon: <TrendingUp size={20} /> },
    { path: 'users', name: 'Quản lý tài khoản', icon: <Users size={20} /> },
    { path: 'payroll', name: 'Tính lương', icon: <DollarSign size={20} /> },
    { path: 'services', name: 'Dịch vụ', icon: <Briefcase size={20} /> },
    { path: 'cms', name: 'CMS SEO', icon: <Globe size={20} /> },
    { path: 'chat', name: 'Chat', icon: <MessageSquare size={20} /> },
    { path: 'settings', name: 'Cài đặt', icon: <Settings size={20} /> },
  ],
  manager: [
    { path: 'dashboard', name: 'Dashboard cơ sở', icon: <LayoutDashboard size={20} /> },
    { path: 'branches', name: 'Quản lý cơ sở', icon: <MapPin size={20} /> },
    { path: 'orders', name: 'Đơn hàng', icon: <FileText size={20} /> },
    { path: 'staff', name: 'Quản lý staff', icon: <Users size={20} /> },
    { path: 'services', name: 'Dịch vụ', icon: <Briefcase size={20} /> },
    { path: 'cms', name: 'CMS SEO', icon: <Globe size={20} /> },
    { path: 'chat', name: 'Chat', icon: <MessageSquare size={20} /> },
    { path: 'settings', name: 'Cài đặt', icon: <Settings size={20} /> },
  ],
  staff: [
    { path: 'dashboard', name: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { path: 'orders', name: 'Đơn hàng', icon: <FileText size={20} /> },
    { path: 'attendance', name: 'Chấm công', icon: <Clock size={20} /> },
    { path: 'payroll', name: 'Tính lương', icon: <DollarSign size={20} /> },
    { path: 'reports', name: 'Báo cáo doanh thu', icon: <TrendingUp size={20} /> },
    { path: 'chat', name: 'Chat', icon: <MessageSquare size={20} /> },
    { path: 'settings', name: 'Cài đặt', icon: <Settings size={20} /> },
  ],
};

export const DASHBOARD_PATH: Record<Role, string> = {
  admin: '/admin/dashboard',
  manager: '/manager/dashboard',
  staff: '/staff/dashboard',
};
