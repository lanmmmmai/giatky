import apiClient from './client';

export type PostType = 'news' | 'recruitment' | 'announcement' | 'guide' | 'other';
export type PostStatus = 'draft' | 'pending' | 'published' | 'hidden' | 'expired';

export interface JobPost {
  id?: string;
  job_title?: string;
  department?: string;
  employment_type?: 'full_time' | 'part_time' | 'shift' | 'seasonal' | 'internship' | '';
  shift_name?: string;
  salary_text?: string;
  quantity?: number;
  experience?: string;
  gender?: string;
  age_range?: string;
  application_deadline?: string;
  recruiter_id?: string;
  receiving_email?: string;
  contact_phone?: string;
  benefits?: string;
  requirements?: string;
  responsibilities?: string;
  allow_online_application?: boolean;
  branches?: { branch_id: string; branch_name: string }[];
  branch_ids?: string[];
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  post_type: PostType;
  status: PostStatus;
  featured_image?: string;
  author_id?: string;
  author_name?: string;
  category?: string;
  tags?: string[];
  published_at?: string;
  expired_at?: string;
  is_featured?: boolean;
  sort_order?: number;
  meta_title?: string;
  meta_description?: string;
  keywords?: string;
  canonical_url?: string;
  og_image?: string;
  allow_application_form?: boolean;
  allow_comments?: boolean;
  created_at?: string;
  updated_at?: string;
  job_post?: JobPost | null;
}

export interface PostPayload extends Omit<Post, 'id' | 'author_id' | 'author_name' | 'created_at' | 'updated_at' | 'job_post'> {
  job_post?: JobPost | null;
}

export interface JobApplication {
  id: string;
  application_code: string;
  full_name: string;
  phone: string;
  email?: string;
  job_title?: string;
  post_title?: string;
  branch_name?: string;
  preferred_shift?: string;
  status: string;
  submitted_at: string;
  internal_note?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  cv_path?: string;
  address?: string;
  experience?: string;
  education?: string;
  expected_salary?: string;
  introduction?: string;
}

export const getAdminPosts = (params?: { search?: string; post_type?: string; status_filter?: string }) =>
  apiClient.get<Post[]>('/admin/posts', { params }).then(res => res.data);
export const createPost = (data: PostPayload) => apiClient.post<Post>('/admin/posts', data).then(res => res.data);
export const updatePost = (id: string, data: PostPayload) => apiClient.put<Post>(`/admin/posts/${id}`, data).then(res => res.data);
export const deletePost = (id: string) => apiClient.delete(`/admin/posts/${id}`).then(res => res.data);
export const publishPost = (id: string) => apiClient.post(`/admin/posts/${id}/publish`).then(res => res.data);
export const unpublishPost = (id: string) => apiClient.post(`/admin/posts/${id}/unpublish`).then(res => res.data);
export const duplicatePost = (id: string) => apiClient.post(`/admin/posts/${id}/duplicate`).then(res => res.data);

export const getPublicPosts = (params?: { search?: string; post_type?: string }) =>
  apiClient.get<Post[]>('/posts', { params }).then(res => res.data);
export const getPublicPost = (slug: string) => apiClient.get<Post>(`/posts/${slug}`).then(res => res.data);
export const submitJobApplication = (postId: string, data: FormData) =>
  apiClient.post(`/jobs/${postId}/applications`, data, { headers: { 'Content-Type': 'multipart/form-data' } }).then(res => res.data);

export const getJobApplications = (params?: { search?: string; status_filter?: string }) =>
  apiClient.get<JobApplication[]>('/admin/job-applications', { params }).then(res => res.data);
export const getJobApplication = (id: string) =>
  apiClient.get<JobApplication>(`/admin/job-applications/${id}`).then(res => res.data);
export const updateJobApplicationStatus = (id: string, data: { status?: string; internal_note?: string; assigned_to?: string }) =>
  apiClient.put<JobApplication>(`/admin/job-applications/${id}/status`, data).then(res => res.data);
export const getJobApplicationLogs = (id: string) =>
  apiClient.get(`/admin/job-applications/${id}/logs`).then(res => res.data);
