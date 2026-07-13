import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, HelpCircle, Mail, MapPin, Phone, ShieldCheck, Shirt, Users } from 'lucide-react';
import SEO, {
  SITE_URL,
  buildBreadcrumbSchema,
  buildOrganizationSchema,
  buildSoftwareSchema,
  buildWebsiteSchema,
} from '../../components/SEO';

const navLinks = [
  { to: '/services', label: 'Dịch vụ' },
  { to: '/about', label: 'Giới thiệu' },
  { to: '/faq', label: 'FAQ' },
  { to: '/blog', label: 'Blog' },
  { to: '/tuyen-dung', label: 'Tuyển dụng' },
  { to: '/contact', label: 'Liên hệ' },
];

const services = [
  'Quản lý đơn hàng giặt là theo trạng thái',
  'Theo dõi khách hàng, lịch sử đơn và công nợ',
  'Quản lý nhân viên, cơ sở, chấm công và lương',
  'Báo cáo doanh thu, thanh toán và vận hành',
  'CMS bài viết, tuyển dụng, email và SEO',
  'Chat nội bộ và thông báo theo vai trò',
];

const faqs = [
  {
    question: 'Giặt Ký dùng cho ai?',
    answer: 'Giặt Ký phù hợp cho tiệm giặt là, chuỗi cửa hàng giặt sấy, đội vận hành nhiều cơ sở và quản lý cần theo dõi đơn hàng, nhân viên, doanh thu trong một hệ thống.',
  },
  {
    question: 'Giặt Ký có hỗ trợ nhiều cơ sở không?',
    answer: 'Có. Hệ thống hỗ trợ tài khoản theo vai trò, phân quyền theo cơ sở, lựa chọn cơ sở làm việc và lọc dữ liệu vận hành theo chi nhánh.',
  },
  {
    question: 'Có thể quản lý tuyển dụng và bài viết không?',
    answer: 'Có. Module nội dung cho phép quản lý bài viết, tin tuyển dụng, hồ sơ ứng tuyển và dữ liệu SEO cho các trang public.',
  },
  {
    question: 'Website có hỗ trợ SEO và AI discovery không?',
    answer: 'Có. Website có robots.txt, sitemap.xml, llms.txt, RSS, Atom, JSON-LD, Open Graph, Twitter Card và các endpoint machine-readable trong thư mục /ai.',
  },
];

const PublicShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-[#f6f6f3] text-slate-950">
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4" aria-label="Điều hướng chính">
        <Link to="/" className="text-lg font-black tracking-tight text-slate-950">Giặt Ký</Link>
        <div className="hidden items-center gap-5 text-xs font-bold text-slate-600 md:flex">
          {navLinks.map(link => <Link key={link.to} to={link.to} className="hover:text-slate-950">{link.label}</Link>)}
        </div>
        <Link to="/admin/login" className="rounded-2xl bg-slate-950 px-4 py-2 text-xs font-black text-white hover:bg-black">Đăng nhập</Link>
      </nav>
    </header>
    {children}
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <section>
          <h2 className="text-base font-black">Giặt Ký</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">Nền tảng quản lý tiệm giặt là giúp theo dõi đơn hàng, khách hàng, nhân sự, doanh thu và nội dung public trong cùng một hệ thống.</p>
        </section>
        <section>
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">Website</h2>
          <div className="mt-3 grid gap-2 text-sm font-semibold text-slate-600">
            {navLinks.map(link => <Link key={link.to} to={link.to} className="hover:text-slate-950">{link.label}</Link>)}
          </div>
        </section>
        <section>
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">Pháp lý</h2>
          <div className="mt-3 grid gap-2 text-sm font-semibold text-slate-600">
            <Link to="/privacy" className="hover:text-slate-950">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-slate-950">Terms</Link>
            <Link to="/cookies" className="hover:text-slate-950">Cookie Policy</Link>
          </div>
        </section>
      </div>
    </footer>
  </div>
);

export const PublicHome: React.FC = () => (
  <PublicShell>
    <SEO
      title="Giặt Ký - Phần mềm quản lý tiệm giặt là"
      description="Giặt Ký là hệ thống quản lý tiệm giặt là chuyên nghiệp cho đơn hàng, khách hàng, cơ sở, nhân viên, doanh thu, CMS SEO và tuyển dụng."
      path="/"
      jsonLd={[buildOrganizationSchema(), buildWebsiteSchema(), buildSoftwareSchema()]}
    />
    <main>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1.1fr_0.9fr] md:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Laundry management platform</p>
          <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight text-slate-950 md:text-6xl">Quản lý tiệm giặt là gọn hơn mỗi ngày</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">Giặt Ký gom đơn hàng, khách hàng, nhân sự, doanh thu và truyền thông vào một bảng điều khiển rõ ràng cho đội vận hành nhiều cơ sở.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/services" className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-black">Xem dịch vụ</Link>
            <Link to="/contact" className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-900 hover:border-slate-950">Liên hệ tư vấn</Link>
          </div>
        </div>
        <div className="rounded-[28px] bg-slate-950 p-6 text-white shadow-diffusion">
          <div className="grid gap-3">
            {services.slice(0, 4).map(item => (
              <div key={item} className="flex items-start gap-3 rounded-2xl bg-white/10 p-4">
                <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
                <span className="text-sm font-bold leading-6">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  </PublicShell>
);

export const ServicesPage: React.FC = () => (
  <PublicShell>
    <SEO
      title="Dịch vụ phần mềm quản lý giặt là"
      description="Các tính năng chính của Giặt Ký: quản lý đơn hàng, khách hàng, nhân sự, chấm công, lương, báo cáo, CMS SEO và tuyển dụng."
      path="/services"
      jsonLd={[buildOrganizationSchema(), buildSoftwareSchema(), buildBreadcrumbSchema([{ name: 'Trang chủ', path: '/' }, { name: 'Dịch vụ', path: '/services' }])]}
    />
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-black tracking-tight text-slate-950">Dịch vụ và tính năng</h1>
      <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {services.map(item => (
          <article key={item} className="rounded-3xl bg-white p-5 shadow-card">
            <Shirt size={22} />
            <h2 className="mt-4 text-base font-black">{item}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Thiết kế cho thao tác hằng ngày tại quầy, quản lý và đội nhân viên.</p>
          </article>
        ))}
      </section>
    </main>
  </PublicShell>
);

export const AboutPage: React.FC = () => (
  <PublicShell>
    <SEO
      title="Giới thiệu Giặt Ký"
      description="Giặt Ký xây dựng phần mềm quản lý tiệm giặt là cho vận hành rõ ràng, dữ liệu tập trung và trải nghiệm khách hàng nhất quán."
      path="/about"
      jsonLd={[buildOrganizationSchema(), buildBreadcrumbSchema([{ name: 'Trang chủ', path: '/' }, { name: 'Giới thiệu', path: '/about' }])]}
    />
    <main className="mx-auto max-w-6xl px-4 py-12">
      <section className="max-w-3xl">
        <h1 className="text-3xl font-black tracking-tight text-slate-950">Giới thiệu Giặt Ký</h1>
        <p className="mt-4 text-base leading-7 text-slate-600">Giặt Ký tập trung vào việc giúp tiệm giặt là quản lý đơn hàng, khách hàng, nhân sự và doanh thu bằng dữ liệu dễ hiểu. Sứ mệnh của chúng tôi là làm cho vận hành tại quầy nhẹ hơn, minh bạch hơn và dễ mở rộng hơn.</p>
      </section>
      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          ['Lịch sử', 'Bắt đầu từ nhu cầu vận hành thực tế của các cơ sở giặt là.'],
          ['Sứ mệnh', 'Giúp đội ngũ giảm thao tác thủ công và tránh thất thoát dữ liệu.'],
          ['Tầm nhìn', 'Trở thành nền tảng quản lý giặt là dễ dùng cho các chuỗi cửa hàng.'],
        ].map(([title, text]) => (
          <article key={title} className="rounded-3xl bg-white p-5 shadow-card">
            <Users size={22} />
            <h2 className="mt-4 text-base font-black">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
          </article>
        ))}
      </section>
    </main>
  </PublicShell>
);

export const FAQPage: React.FC = () => (
  <PublicShell>
    <SEO
      title="FAQ - Câu hỏi thường gặp"
      description="Câu hỏi thường gặp về Giặt Ký, phần mềm quản lý tiệm giặt là, nhiều cơ sở, tuyển dụng, SEO và AI discovery."
      path="/faq"
      jsonLd={[
        buildOrganizationSchema(),
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs.map(item => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: { '@type': 'Answer', text: item.answer },
          })),
        },
      ]}
    />
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-black tracking-tight text-slate-950">Câu hỏi thường gặp</h1>
      <section className="mt-8 grid gap-3">
        {faqs.map(item => (
          <details key={item.question} className="rounded-2xl bg-white p-5 shadow-card">
            <summary className="flex cursor-pointer items-center gap-3 text-base font-black">
              <HelpCircle size={18} /> {item.question}
            </summary>
            <p className="mt-3 text-sm leading-6 text-slate-600">{item.answer}</p>
          </details>
        ))}
      </section>
    </main>
  </PublicShell>
);

export const ContactPage: React.FC = () => (
  <PublicShell>
    <SEO
      title="Liên hệ Giặt Ký"
      description="Liên hệ Giặt Ký để tư vấn phần mềm quản lý tiệm giặt là, quản lý nhiều cơ sở, báo cáo doanh thu và CMS SEO."
      path="/contact"
      jsonLd={[buildOrganizationSchema(), buildBreadcrumbSchema([{ name: 'Trang chủ', path: '/' }, { name: 'Liên hệ', path: '/contact' }])]}
    />
    <main className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-[0.9fr_1.1fr]">
      <section>
        <h1 className="text-3xl font-black tracking-tight text-slate-950">Liên hệ</h1>
        <div className="mt-6 grid gap-3 text-sm font-semibold text-slate-700">
          <p className="flex items-center gap-2"><Mail size={17} /> support@giatky.site</p>
          <p className="flex items-center gap-2"><Phone size={17} /> 1900 0000</p>
          <p className="flex items-center gap-2"><MapPin size={17} /> Việt Nam</p>
        </div>
      </section>
      <form className="rounded-3xl bg-white p-6 shadow-card" aria-label="Form liên hệ">
        <div className="grid gap-3">
          <label className="text-sm font-bold">Họ tên<input className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-950" /></label>
          <label className="text-sm font-bold">Email<input type="email" className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-950" /></label>
          <label className="text-sm font-bold">Nội dung<textarea rows={4} className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-950" /></label>
          <button type="button" className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white">Gửi yêu cầu</button>
        </div>
      </form>
    </main>
  </PublicShell>
);

const PolicyPage: React.FC<{ kind: 'privacy' | 'terms' | 'cookies' }> = ({ kind }) => {
  const titleMap = {
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    cookies: 'Cookie Policy',
  };
  const path = kind === 'privacy' ? '/privacy' : kind === 'terms' ? '/terms' : '/cookies';
  return (
    <PublicShell>
      <SEO title={`${titleMap[kind]} - Giặt Ký`} description={`${titleMap[kind]} của website Giặt Ký.`} path={path} />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <ShieldCheck size={28} />
        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">{titleMap[kind]}</h1>
        <section className="mt-6 space-y-4 text-sm leading-7 text-slate-600">
          <p>Giặt Ký chỉ thu thập thông tin cần thiết để vận hành tài khoản, đơn hàng, tuyển dụng và liên hệ tư vấn.</p>
          <p>Dữ liệu được dùng để cung cấp dịch vụ, cải thiện trải nghiệm, bảo mật hệ thống và phản hồi yêu cầu của người dùng.</p>
          <p>Người dùng có thể liên hệ support@giatky.site để yêu cầu cập nhật hoặc xóa thông tin theo quy định phù hợp.</p>
        </section>
      </main>
    </PublicShell>
  );
};

export const PrivacyPage = () => <PolicyPage kind="privacy" />;
export const TermsPage = () => <PolicyPage kind="terms" />;
export const CookiesPage = () => <PolicyPage kind="cookies" />;
