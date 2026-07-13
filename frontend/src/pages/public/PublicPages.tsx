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
import routeSeo from '../../config/routeSeo.json';
import faqData from '../../config/faqData.json';

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

// Nguồn FAQ DUY NHẤT: src/config/faqData.json — dùng chung cho trang /faq,
// FAQ preview trang chủ, FAQPage JSON-LD và /ai/faq.json (sinh lúc build).
const faqs = faqData as Array<{ id: string; question: string; answer: string }>;

export const buildFaqPageSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(item => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: { '@type': 'Answer', text: item.answer },
  })),
});

// Số liệu tính năng có thể kiểm chứng trực tiếp trong hệ thống — không phải
// số liệu kinh doanh tự phong (xem docs backend/frontend tương ứng).
const featureFacts = [
  ['0.01 kg', 'bước khối lượng nhỏ nhất — số cân nhận tối đa 2 chữ số thập phân'],
  ['3 vai trò', 'admin, quản lý cơ sở và nhân viên với phạm vi dữ liệu riêng'],
  ['6 trạng thái đơn', 'mới tạo, đang giặt, đang sấy, sẵn sàng, đã giao, đã hủy'],
  ['15 biến email', 'placeholder động như {{customer_name}}, {{order_code}} trong mẫu email'],
  ['Nhiều phiên/ngày', 'chấm công vào - ra nhiều phiên trong một ngày làm việc'],
  ['Lọc 3 chiều', 'báo cáo doanh thu theo tháng, năm và từng cơ sở'],
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
      title={routeSeo['/'].title}
      description={routeSeo['/'].description}
      path="/"
      image={routeSeo['/'].image}
      imageAlt={routeSeo['/'].imageAlt}
      robots={routeSeo['/'].robots}
      jsonLd={[buildOrganizationSchema(), buildWebsiteSchema(), buildSoftwareSchema()]}
    />
    <main>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1.1fr_0.9fr] md:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Laundry management platform</p>
          <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight text-slate-950 md:text-6xl">Hệ thống quản lý tiệm giặt sấy Giặt Ký</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">Giặt Ký là hệ thống quản lý dành cho tiệm giặt sấy và chuỗi nhiều cơ sở. Phần mềm thay thế phiếu giấy và sổ tay bằng một bảng điều khiển duy nhất cho đơn hàng, khách hàng, nhân viên, chấm công, tính lương, doanh thu và nội dung website. Tìm hiểu thêm tại trang <Link to="/about" className="font-bold text-slate-950 underline">giới thiệu</Link>.</p>
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

      {/* Số liệu tính năng có thể kiểm chứng — không dùng số liệu kinh doanh tự phong */}
      <section className="mx-auto max-w-6xl px-4 pb-12" aria-label="Số liệu tính năng">
        <h2 className="sr-only">Số liệu tính năng của hệ thống</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {featureFacts.map(([stat, note]) => (
            <div key={stat} className="rounded-2xl bg-white p-4 shadow-card">
              <p className="text-lg font-black text-slate-950">{stat}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">{note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <aside className="rounded-[28px] bg-white p-6 shadow-card">
            <h2 className="text-xl font-black text-slate-950">Giặt Ký là gì?</h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">Giặt Ký là phần mềm quản lý tiệm giặt sấy được xây dựng cho các cơ sở cần theo dõi đơn hàng, khách hàng, nhân viên và dòng tiền trong cùng một nơi. Thay vì ghi phiếu thủ công, lưu thông tin rời rạc hoặc trao đổi qua nhiều nhóm chat, đội vận hành có thể tạo đơn, chọn dịch vụ, ghi nhận thanh toán, theo dõi trạng thái xử lý và xem lịch sử khách hàng theo thời gian thực.</p>
            <p className="mt-4 text-sm leading-7 text-slate-600">Website public của Giặt Ký cung cấp thông tin sản phẩm, bài viết, tuyển dụng, FAQ và kênh liên hệ. Các trang này được tối ưu để công cụ tìm kiếm và hệ thống AI có thể hiểu đúng thực thể Giặt Ký, nội dung chính và các liên kết quan trọng.</p>
            <p className="mt-4 text-sm leading-7 text-slate-600">Bạn có thể đọc thêm về sứ mệnh và đội ngũ tại trang <Link to="/about" className="font-bold text-slate-950 underline">Giới thiệu</Link>, hoặc gửi câu hỏi qua trang <Link to="/contact" className="font-bold text-slate-950 underline">Liên hệ</Link>.</p>
          </aside>
          <div className="space-y-6">
            <section className="rounded-[28px] bg-white p-6 shadow-card">
              <h2 className="text-xl font-black text-slate-950">Quản lý đơn hàng giặt sấy tập trung</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">Quy trình tại quầy đi theo một luồng thống nhất: nhận đồ của khách, chọn dịch vụ theo kilogram hoặc theo món, nhập số cân lẻ tới 2 chữ số thập phân, ghi ngày giờ nhận và ngày hẹn trả, rồi xác nhận tạo đơn. Ngày hẹn trả được đề xuất tự động dựa trên ngày nhận và có thể chỉnh tay khi khách cần gấp.</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">Mỗi đơn có mã riêng được sinh tự động, đi qua các trạng thái mới tạo, đang giặt, đang sấy, sẵn sàng, đã giao hoặc đã hủy. Thanh toán ghi nhận theo tiền mặt, chuyển khoản hoặc ví điện tử; phiếu biên nhận in được ngay từ trang chi tiết đơn.</p>
            </section>
            <section className="rounded-[28px] bg-white p-6 shadow-card">
              <h2 className="text-xl font-black text-slate-950">Quản lý khách hàng và lịch sử giao dịch</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">Hồ sơ khách hàng lưu tên, số điện thoại, email và địa chỉ. Khi nhân viên nhập số điện thoại lúc tạo đơn, hệ thống tự tra cứu và hiển thị tổng số đơn, tổng chi tiêu, lần giao dịch gần nhất và lịch sử dịch vụ đã dùng. Khách quen được phục vụ nhanh hơn và cửa hàng hạn chế nhập trùng thông tin.</p>
            </section>
            <section className="rounded-[28px] bg-white p-6 shadow-card">
              <h2 className="text-xl font-black text-slate-950">Quản lý nhiều cơ sở</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">Một nhân viên có thể được phân công vào nhiều cơ sở và chọn cơ sở đang làm việc khi vào ca. Quản lý chỉ nhìn thấy dữ liệu thuộc cơ sở mình phụ trách, còn admin xem được toàn hệ thống. Đơn hàng, chấm công và báo cáo đều lọc theo từng cơ sở, giúp chuỗi cửa hàng đối soát rõ ràng.</p>
            </section>
            <section className="rounded-[28px] bg-white p-6 shadow-card">
              <h2 className="text-xl font-black text-slate-950">Chấm công và tính lương</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">Nhân viên chấm công vào - ra theo phiên, một ngày có thể có nhiều phiên làm việc. Khi quên chấm, quản lý điều chỉnh công thủ công kèm lý do để giữ lịch sử minh bạch. Tổng giờ làm của từng người được cộng dồn tự động và là căn cứ tính lương theo giờ trong kỳ trả lương.</p>
            </section>
            <section className="rounded-[28px] bg-white p-6 shadow-card">
              <h2 className="text-xl font-black text-slate-950">Báo cáo doanh thu và vận hành</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">Khu vực báo cáo tổng hợp doanh thu theo tháng, theo năm và theo cơ sở, kèm trạng thái thanh toán của từng đơn để thấy rõ tiền đã thu và khoản khách còn nợ. Báo cáo không thay thế kế toán chuyên sâu, nhưng đủ để chủ tiệm nắm nhanh tình hình vận hành mỗi ngày.</p>
            </section>
            <section className="rounded-[28px] bg-white p-6 shadow-card">
              <h2 className="text-xl font-black text-slate-950">Email, SEO và nội dung</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">Hệ thống gửi email xác nhận tự động theo mẫu do quản trị viên soạn, với 15 biến động như tên khách, mã đơn hoặc tổng tiền và chức năng gửi thử trước khi kích hoạt. Khu vực CMS quản lý thẻ SEO cho từng tên miền, bài viết blog và tin tuyển dụng, giúp website public luôn có nội dung mới. Xem các bài mới nhất tại <Link to="/blog" className="font-bold text-slate-950 underline">Blog</Link>.</p>
            </section>
            <section className="rounded-[28px] bg-white p-6 shadow-card">
              <h2 className="text-xl font-black text-slate-950">Giặt Ký phù hợp với ai?</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">Tiệm giặt nhỏ dùng Giặt Ký để bỏ phiếu giấy và tra cứu khách quen nhanh hơn. Chuỗi nhiều cơ sở dùng phân quyền theo chi nhánh để mỗi quản lý làm đúng phạm vi. Chủ tiệm theo dõi doanh thu và công nợ từ xa, còn nhân viên quầy thao tác nhận đồ, tạo đơn và thu tiền trên một màn hình duy nhất.</p>
            </section>
            <section className="rounded-[28px] bg-white p-6 shadow-card">
              <h2 className="text-xl font-black text-slate-950">Câu hỏi thường gặp</h2>
              <div className="mt-4 grid gap-3">
                {faqs.slice(0, 4).map(item => (
                  <details key={item.id} className="rounded-2xl border border-slate-100 bg-[#fafaf8] p-4">
                    <summary className="cursor-pointer text-sm font-black text-slate-900">{item.question}</summary>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.answer}</p>
                  </details>
                ))}
              </div>
              <Link to="/faq" className="mt-4 inline-flex rounded-2xl bg-slate-950 px-4 py-2 text-xs font-black text-white">Xem tất cả câu hỏi thường gặp</Link>
            </section>
          </div>
        </div>
      </section>
    </main>
  </PublicShell>
);

export const ServicesPage: React.FC = () => (
  <PublicShell>
    <SEO
      title={routeSeo['/services'].title}
      description={routeSeo['/services'].description}
      path="/services"
      image={routeSeo['/services'].image}
      imageAlt={routeSeo['/services'].imageAlt}
      robots={routeSeo['/services'].robots}
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
      title={routeSeo['/about'].title}
      description={routeSeo['/about'].description}
      path="/about"
      image={routeSeo['/about'].image}
      imageAlt={routeSeo['/about'].imageAlt}
      robots={routeSeo['/about'].robots}
      jsonLd={[
        buildOrganizationSchema(),
        {
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          '@id': `${SITE_URL}/about#webpage`,
          name: routeSeo['/about'].title,
          url: `${SITE_URL}/about`,
          inLanguage: 'vi-VN',
          isPartOf: { '@id': `${SITE_URL}/#website` },
          about: { '@id': `${SITE_URL}/#organization` },
        },
        buildBreadcrumbSchema([{ name: 'Trang chủ', path: '/' }, { name: 'Giới thiệu', path: '/about' }]),
      ]}
    />
    <main className="mx-auto max-w-6xl px-4 py-12">
      <section className="max-w-3xl">
        <h1 className="text-3xl font-black tracking-tight text-slate-950">Giới thiệu Giặt Ký</h1>
        <p className="mt-4 text-base leading-7 text-slate-600">Giặt Ký là hệ thống quản lý tiệm giặt sấy, tập trung vào việc giúp cửa hàng theo dõi đơn hàng, khách hàng, nhân sự và doanh thu bằng dữ liệu dễ hiểu. Sứ mệnh của chúng tôi là làm cho vận hành tại quầy nhẹ hơn, minh bạch hơn và dễ mở rộng hơn khi cửa hàng phát triển thành chuỗi nhiều cơ sở.</p>
        <p className="mt-4 text-base leading-7 text-slate-600">Sản phẩm bắt đầu từ nhu cầu thực tế của cơ sở giặt sấy: bớt phiếu giấy, bớt nhập liệu trùng lặp và có một nguồn dữ liệu duy nhất cho cả đội. Bạn có thể trải nghiệm tổng quan tại <Link to="/" className="font-bold text-slate-950 underline">trang chủ</Link> hoặc đặt câu hỏi qua trang <Link to="/contact" className="font-bold text-slate-950 underline">liên hệ</Link>.</p>
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
      <section className="mt-10">
        <h2 className="text-xl font-black text-slate-950">Giặt Ký dành cho ai?</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            ['Chủ tiệm', 'Theo dõi doanh thu, công nợ và hiệu quả từng cơ sở mà không cần có mặt tại quầy.'],
            ['Quản lý cơ sở', 'Điều phối đơn hàng, chấm công, chỉnh công có lý do và duyệt dữ liệu trong phạm vi chi nhánh.'],
            ['Nhân viên quầy', 'Nhận đồ, tạo đơn theo kilogram hoặc theo món, thu tiền và trả đồ trên một màn hình.'],
          ].map(([title, text]) => (
            <article key={title} className="rounded-3xl bg-white p-5 shadow-card">
              <h3 className="text-base font-black">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="mt-10">
        <h2 className="text-xl font-black text-slate-950">Các nhóm chức năng chính</h2>
        <ul className="mt-4 grid gap-2 text-sm leading-7 text-slate-700 md:grid-cols-2">
          <li>• Đơn hàng: nhận đồ, dịch vụ theo kg hoặc theo món, trạng thái, thanh toán, in phiếu.</li>
          <li>• Khách hàng: hồ sơ, tổng đơn, tổng chi tiêu và lịch sử giao dịch.</li>
          <li>• Cơ sở và nhân sự: phân công nhiều cơ sở, phân quyền theo vai trò.</li>
          <li>• Chấm công và lương: nhiều phiên mỗi ngày, chỉnh công có lý do, lương theo giờ.</li>
          <li>• Báo cáo: doanh thu theo tháng, năm và từng cơ sở.</li>
          <li>• Nội dung: email tự động, CMS SEO, blog và tuyển dụng.</li>
        </ul>
      </section>
      <section className="mt-10 rounded-[28px] bg-white p-6 shadow-card">
        <h2 className="text-xl font-black text-slate-950">Tài liệu và tiêu chuẩn tham khảo</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">Giặt Ký được xây dựng dựa trên các tiêu chuẩn web và tài liệu chính thức dưới đây. Các nguồn này là tài liệu tham khảo kỹ thuật, không phải chứng nhận cho Giặt Ký.</p>
        <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
          <li>
            <a href="https://schema.org/" target="_blank" rel="noopener noreferrer" className="font-bold text-slate-950 underline">Schema.org</a>
            {' '}— từ vựng structured data mà website dùng cho Organization, FAQPage, BreadcrumbList và BlogPosting.
          </li>
          <li>
            <a href="https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data" target="_blank" rel="noopener noreferrer" className="font-bold text-slate-950 underline">Google Search Central — Structured data</a>
            {' '}— hướng dẫn chính thức về cách công cụ tìm kiếm đọc JSON-LD trên các trang public.
          </li>
          <li>
            <a href="https://developer.mozilla.org/en-US/docs/Web/HTML" target="_blank" rel="noopener noreferrer" className="font-bold text-slate-950 underline">MDN Web Docs — HTML</a>
            {' '}— tiêu chuẩn semantic HTML áp dụng cho header, main, section và accordion FAQ.
          </li>
          <li>
            <a href="https://owasp.org/www-project-top-ten/" target="_blank" rel="noopener noreferrer" className="font-bold text-slate-950 underline">OWASP Top Ten</a>
            {' '}— danh mục rủi ro bảo mật ứng dụng web được tham chiếu khi xây dựng phân quyền và xử lý dữ liệu.
          </li>
          <li>
            <a href="https://react.dev/" target="_blank" rel="noopener noreferrer" className="font-bold text-slate-950 underline">React</a>
            {' '}và{' '}
            <a href="https://fastapi.tiangolo.com/" target="_blank" rel="noopener noreferrer" className="font-bold text-slate-950 underline">FastAPI</a>
            {' '}— tài liệu chính thức của hai framework tạo nên giao diện và API của hệ thống.
          </li>
          <li>
            <a href="https://www.postgresql.org/docs/" target="_blank" rel="noopener noreferrer" className="font-bold text-slate-950 underline">PostgreSQL Documentation</a>
            {' '}— cơ sở dữ liệu lưu đơn hàng, khách hàng và dữ liệu vận hành của hệ thống.
          </li>
        </ul>
      </section>
    </main>
  </PublicShell>
);

export const FAQPage: React.FC = () => (
  <PublicShell>
    <SEO
      title={routeSeo['/faq'].title}
      description={routeSeo['/faq'].description}
      path="/faq"
      image={routeSeo['/faq'].image}
      imageAlt={routeSeo['/faq'].imageAlt}
      robots={routeSeo['/faq'].robots}
      jsonLd={[
        buildOrganizationSchema(),
        buildFaqPageSchema(),
        buildBreadcrumbSchema([{ name: 'Trang chủ', path: '/' }, { name: 'Câu hỏi thường gặp', path: '/faq' }]),
      ]}
    />
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-black tracking-tight text-slate-950">Câu hỏi thường gặp về Giặt Ký</h1>
      <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
        Trang này tổng hợp các câu hỏi phổ biến về hệ thống quản lý tiệm giặt sấy Giặt Ký: phạm vi nghiệp vụ,
        quản lý nhiều cơ sở, chấm công, tính lương, email tự động và cách liên hệ hỗ trợ. Nếu chưa tìm thấy câu trả lời,
        bạn có thể xem thêm <Link to="/services" className="font-bold text-slate-950 underline">dịch vụ</Link> hoặc
        gửi câu hỏi qua trang <Link to="/contact" className="font-bold text-slate-950 underline">liên hệ</Link>.
      </p>
      <section className="mt-8 grid gap-3" aria-label="Danh sách câu hỏi thường gặp">
        {faqs.map(item => (
          <details key={item.id} id={item.id} className="rounded-2xl bg-white p-5 shadow-card">
            <summary className="flex cursor-pointer items-center gap-3 text-base font-black">
              <HelpCircle size={18} /> {item.question}
            </summary>
            <p className="mt-3 text-sm leading-6 text-slate-600">{item.answer}</p>
          </details>
        ))}
      </section>
      <p className="mt-8 text-sm leading-6 text-slate-600">
        Quay lại <Link to="/" className="font-bold text-slate-950 underline">trang chủ</Link> hoặc
        liên hệ đội hỗ trợ tại <Link to="/contact" className="font-bold text-slate-950 underline">giatky.site/contact</Link>.
      </p>
    </main>
  </PublicShell>
);

export const ContactPage: React.FC = () => (
  <PublicShell>
    <SEO
      title={routeSeo['/contact'].title}
      description={routeSeo['/contact'].description}
      path="/contact"
      image={routeSeo['/contact'].image}
      imageAlt={routeSeo['/contact'].imageAlt}
      robots={routeSeo['/contact'].robots}
      jsonLd={[
        buildOrganizationSchema(),
        {
          '@context': 'https://schema.org',
          '@type': 'ContactPage',
          '@id': `${SITE_URL}/contact#webpage`,
          name: routeSeo['/contact'].title,
          url: `${SITE_URL}/contact`,
          inLanguage: 'vi-VN',
          isPartOf: { '@id': `${SITE_URL}/#website` },
          about: { '@id': `${SITE_URL}/#organization` },
        },
        buildBreadcrumbSchema([{ name: 'Trang chủ', path: '/' }, { name: 'Liên hệ', path: '/contact' }]),
      ]}
    />
    <main className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-[0.9fr_1.1fr]">
      <section>
        <h1 className="text-3xl font-black tracking-tight text-slate-950">Liên hệ Giặt Ký</h1>
        <div className="mt-6 grid gap-3 text-sm font-semibold text-slate-700">
          <p className="flex items-center gap-2"><Mail size={17} /> <a href="mailto:support@giatky.site" className="underline hover:text-slate-950">support@giatky.site</a></p>
          <p className="flex items-center gap-2"><Phone size={17} /> Số điện thoại sẽ được cập nhật khi được phép công khai</p>
          <p className="flex items-center gap-2"><MapPin size={17} /> Việt Nam</p>
        </div>
        <p className="mt-5 max-w-md text-sm leading-6 text-slate-600">Đội hỗ trợ thường phản hồi trong 1-2 ngày làm việc. Với câu hỏi phổ biến về tính năng, bạn có thể xem nhanh tại trang <Link to="/faq" className="font-bold text-slate-950 underline">câu hỏi thường gặp</Link> hoặc quay lại <Link to="/" className="font-bold text-slate-950 underline">trang chủ</Link>.</p>
      </section>
      <form
        className="rounded-3xl bg-white p-6 shadow-card"
        aria-label="Form liên hệ"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const name = (form.elements.namedItem('contact-name') as HTMLInputElement)?.value?.trim() || '';
          const email = (form.elements.namedItem('contact-email') as HTMLInputElement)?.value?.trim() || '';
          const message = (form.elements.namedItem('contact-message') as HTMLTextAreaElement)?.value?.trim() || '';
          const subject = encodeURIComponent(`Liên hệ từ website Giặt Ký - ${name || 'Khách'}`);
          const body = encodeURIComponent(`Họ tên: ${name}\nEmail: ${email}\n\n${message}`);
          window.location.href = `mailto:support@giatky.site?subject=${subject}&body=${body}`;
        }}
      >
        <div className="grid gap-3">
          <label className="text-sm font-bold">Họ tên<input name="contact-name" required className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-950" /></label>
          <label className="text-sm font-bold">Email<input name="contact-email" type="email" required className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-950" /></label>
          <label className="text-sm font-bold">Nội dung<textarea name="contact-message" required rows={4} className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-950" /></label>
          <button type="submit" className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white">Gửi yêu cầu</button>
          <p className="text-xs leading-5 text-slate-500">Thông tin bạn nhập chỉ dùng để phản hồi yêu cầu và được xử lý theo <Link to="/privacy" className="font-bold text-slate-700 underline">chính sách bảo mật</Link>. Form sẽ mở ứng dụng email của bạn với nội dung đã điền sẵn.</p>
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
  const seo = routeSeo[path as '/privacy' | '/terms' | '/cookies'];
  return (
    <PublicShell>
      <SEO
        title={seo.title}
        description={seo.description}
        path={path}
        image={seo.image}
        imageAlt={seo.imageAlt}
        robots={seo.robots}
      />
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
