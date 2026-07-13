import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, Search } from 'lucide-react';
import { getPublicPosts, Post, PostType } from '../../api/content';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';

const typeLabels: Record<PostType, string> = {
  news: 'Tin tức',
  recruitment: 'Tuyển dụng',
  announcement: 'Thông báo',
  guide: 'Hướng dẫn',
  other: 'Khác',
};

interface PublicPostsProps {
  defaultType?: PostType;
}

const PublicPosts: React.FC<PublicPostsProps> = ({ defaultType }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [type, setType] = useState<PostType | ''>((defaultType || searchParams.get('type') || '') as PostType | '');

  useEffect(() => {
    loadPosts();
  }, [defaultType]);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const activeType = defaultType || type || undefined;
      const data = await getPublicPosts({ search: search || undefined, post_type: activeType });
      setPosts(data);
      const nextParams: Record<string, string> = {};
      if (search) nextParams.search = search;
      if (!defaultType && type) nextParams.type = type;
      setSearchParams(nextParams, { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <Link to="/" className="text-xs font-bold text-primary uppercase tracking-wider">Giặt Ký</Link>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 mt-2">
              {defaultType === 'recruitment' ? 'Tuyển dụng' : 'Bài viết'}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {defaultType === 'recruitment' ? 'Cơ hội làm việc tại các cơ sở Giặt Ký' : 'Tin tức, thông báo và hướng dẫn từ Giặt Ký'}
            </p>
          </div>
          <form onSubmit={(event) => { event.preventDefault(); loadPosts(); }} className="flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Tìm kiếm..."
                className="w-full sm:w-64 pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary bg-white"
              />
            </div>
            {!defaultType && (
              <select
                value={type}
                onChange={event => setType(event.target.value as PostType | '')}
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white outline-none focus:border-primary"
              >
                <option value="">Tất cả loại bài</option>
                {Object.entries(typeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            )}
            <button type="submit" className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-dark">
              Lọc
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {loading ? <LoadingSpinner /> : posts.length === 0 ? <EmptyState message="Chưa có nội dung phù hợp." /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {posts.map(post => (
              <Link key={post.id} to={`/bai-viet/${post.slug}`} className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:border-primary/50 hover:shadow-md transition-all">
                {post.featured_image ? (
                  <img src={post.featured_image} alt={post.title} className="w-full h-44 object-cover" />
                ) : (
                  <div className="w-full h-44 bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-bold">
                    {typeLabels[post.post_type]}
                  </div>
                )}
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 text-[11px] text-slate-500">
                    <span className="px-2 py-1 rounded-md bg-slate-100 font-bold">{typeLabels[post.post_type]}</span>
                    <span className="flex items-center gap-1"><Calendar size={12} />{post.published_at ? new Date(post.published_at).toLocaleDateString('vi-VN') : '-'}</span>
                  </div>
                  <h2 className="text-base font-extrabold text-slate-900 line-clamp-2">{post.title}</h2>
                  <p className="text-sm text-slate-500 line-clamp-3">{post.excerpt || 'Xem chi tiết bài viết.'}</p>
                  {post.post_type === 'recruitment' && (
                    <div className="text-xs text-primary font-bold">
                      {post.job_post?.salary_text || 'Ứng tuyển online'}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default PublicPosts;
