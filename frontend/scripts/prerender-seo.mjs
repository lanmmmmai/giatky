import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const templatePath = path.join(dist, 'index.html');
const seoPath = path.join(root, 'src', 'config', 'routeSeo.json');
const SITE_URL = 'https://giatky.site';
const SITE_NAME = 'Giặt Ký';

const routeSeo = JSON.parse(fs.readFileSync(seoPath, 'utf8'));
// Nguồn FAQ duy nhất — dùng chung với trang /faq (React) và /ai/faq.json
const faqData = JSON.parse(fs.readFileSync(path.join(root, 'src', 'config', 'faqData.json'), 'utf8'));
const template = fs.readFileSync(templatePath, 'utf8');

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const imageType = (url = '') => url.endsWith('.svg') ? 'image/svg+xml' : 'image/jpeg';

const cleanHead = (html) => html
  .replace(/<title>[\s\S]*?<\/title>\s*/gi, '')
  .replace(/<meta\s+(?:name|property)=["'](?:description|keywords|author|publisher|robots|theme-color|application-name|apple-mobile-web-app-title|og:[^"']+|twitter:[^"']+)["'][^>]*>\s*/gi, '')
  .replace(/<link\s+rel=["']canonical["'][^>]*>\s*/gi, '')
  .replace(/<link\s+rel=["']alternate["']\s+hreflang=["'][^"']+["'][^>]*>\s*/gi, '')
  .replace(/<script\s+type=["']application\/ld\+json["'][\s\S]*?<\/script>\s*/gi, '');

const organizationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  logo: {
    '@type': 'ImageObject',
    url: `${SITE_URL}/favicon.svg`,
  },
  email: 'support@giatky.site',
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    email: 'support@giatky.site',
    availableLanguage: ['vi'],
  },
  sameAs: ['https://github.com/lanmmmmai/giatky'],
});

const websiteSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  publisher: { '@id': `${SITE_URL}/#organization` },
  inLanguage: 'vi-VN',
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_URL}/blog?search={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
});

const breadcrumbSchema = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: `${SITE_URL}${item.path}`,
  })),
});

const faqItems = faqData.map(item => [item.question, item.answer]);

const schemaForRoute = (route, seo) => {
  const base = [organizationSchema()];
  if (route === '/') return [...base, websiteSchema(), {
    '@context': 'https://schema.org',
    '@type': ['SoftwareApplication', 'WebApplication'],
    '@id': `${SITE_URL}/#software`,
    name: SITE_NAME,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Laundry Management',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'VND' },
  }];
  if (route === '/faq') return [...base, {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(([question, answer]) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  }];
  if (route.includes('/login')) return [{
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: seo.title,
    url: seo.canonical,
    isPartOf: { '@id': `${SITE_URL}/#website` },
  }];
  if (route === '/about') return [...base, {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': `${SITE_URL}/about#webpage`,
    name: seo.title,
    url: `${SITE_URL}/about`,
    inLanguage: 'vi-VN',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    about: { '@id': `${SITE_URL}/#organization` },
  }, breadcrumbSchema([{ name: 'Trang chủ', path: '/' }, { name: 'Giới thiệu', path: '/about' }])];
  if (route === '/contact') return [...base, {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    '@id': `${SITE_URL}/contact#webpage`,
    name: seo.title,
    url: `${SITE_URL}/contact`,
    inLanguage: 'vi-VN',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    about: { '@id': `${SITE_URL}/#organization` },
  }, breadcrumbSchema([{ name: 'Trang chủ', path: '/' }, { name: 'Liên hệ', path: '/contact' }])];
  return [...base, breadcrumbSchema([{ name: 'Trang chủ', path: '/' }, { name: seo.title.replace(` | ${SITE_NAME}`, ''), path: route }])];
};

const contentForRoute = (route, seo) => {
  if (route.includes('/login')) {
    return `<main><h1>${escapeHtml(seo.title.replace(` | ${SITE_NAME}`, ''))}</h1><p>${escapeHtml(seo.description)}</p></main>`;
  }
  if (route === '/') {
    return `<main>
      <h1>Hệ thống quản lý tiệm giặt sấy Giặt Ký</h1>
      <p>Giặt Ký là hệ thống quản lý dành cho tiệm giặt sấy và chuỗi nhiều cơ sở. Phần mềm thay thế phiếu giấy và sổ tay bằng một bảng điều khiển duy nhất cho đơn hàng, khách hàng, nhân viên, chấm công, tính lương, doanh thu và nội dung website. Xem thêm tại <a href="/about">trang giới thiệu</a>, <a href="/faq">câu hỏi thường gặp</a>, <a href="/blog">blog</a> và <a href="/contact">liên hệ</a>.</p>
      <section><h2>Số liệu tính năng của hệ thống</h2><ul>
        <li>Số cân nhận tối đa 2 chữ số thập phân, bước nhỏ nhất 0.01 kg.</li>
        <li>3 vai trò phân quyền: admin, quản lý cơ sở và nhân viên.</li>
        <li>6 trạng thái đơn hàng: mới tạo, đang giặt, đang sấy, sẵn sàng, đã giao, đã hủy.</li>
        <li>15 biến động trong mẫu email như {{customer_name}}, {{order_code}}.</li>
        <li>Một ngày làm việc có thể gồm nhiều phiên chấm công vào - ra.</li>
        <li>Báo cáo doanh thu lọc theo tháng, năm và từng cơ sở.</li>
      </ul></section>
      <section><h2>Quản lý đơn hàng giặt sấy tập trung</h2><p>Quy trình tại quầy đi theo một luồng thống nhất: nhận đồ của khách, chọn dịch vụ theo kilogram hoặc theo món, nhập số cân lẻ tới 2 chữ số thập phân, ghi ngày giờ nhận và ngày hẹn trả, rồi xác nhận tạo đơn. Ngày hẹn trả được đề xuất tự động dựa trên ngày nhận và có thể chỉnh tay khi khách cần gấp. Mỗi đơn có mã riêng được sinh tự động, đi qua các trạng thái mới tạo, đang giặt, đang sấy, sẵn sàng, đã giao hoặc đã hủy; thanh toán ghi nhận theo tiền mặt, chuyển khoản hoặc ví điện tử và phiếu biên nhận in được ngay từ trang chi tiết đơn.</p></section>
      <section><h2>Quản lý khách hàng và lịch sử giao dịch</h2><p>Hồ sơ khách hàng lưu tên, số điện thoại, email và địa chỉ. Khi nhân viên nhập số điện thoại lúc tạo đơn, hệ thống tự tra cứu và hiển thị tổng số đơn, tổng chi tiêu, lần giao dịch gần nhất và lịch sử dịch vụ đã dùng để phục vụ khách quen nhanh hơn.</p></section>
      <section><h2>Quản lý nhiều cơ sở</h2><p>Một nhân viên có thể được phân công vào nhiều cơ sở và chọn cơ sở đang làm việc khi vào ca. Quản lý chỉ nhìn thấy dữ liệu thuộc cơ sở mình phụ trách, còn admin xem được toàn hệ thống. Đơn hàng, chấm công và báo cáo đều lọc theo từng cơ sở.</p></section>
      <section><h2>Chấm công và tính lương</h2><p>Nhân viên chấm công vào - ra theo phiên, một ngày có thể có nhiều phiên làm việc. Khi quên chấm, quản lý điều chỉnh công thủ công kèm lý do. Tổng giờ làm được cộng dồn tự động và là căn cứ tính lương theo giờ.</p></section>
      <section><h2>Báo cáo doanh thu và vận hành</h2><p>Khu vực báo cáo tổng hợp doanh thu theo tháng, theo năm và theo cơ sở, kèm trạng thái thanh toán của từng đơn để thấy rõ tiền đã thu và khoản khách còn nợ.</p></section>
      <section><h2>Email, SEO và nội dung</h2><p>Hệ thống gửi email xác nhận tự động theo mẫu do quản trị viên soạn, có xem trước và gửi thử. Khu vực CMS quản lý thẻ SEO, bài viết blog và tin tuyển dụng cho website public.</p></section>
      <section><h2>Giặt Ký phù hợp với ai?</h2><p>Tiệm giặt nhỏ dùng Giặt Ký để bỏ phiếu giấy và tra cứu khách quen nhanh hơn. Chuỗi nhiều cơ sở dùng phân quyền theo chi nhánh. Chủ tiệm theo dõi doanh thu và công nợ từ xa, còn nhân viên quầy thao tác nhận đồ, tạo đơn và thu tiền trên một màn hình duy nhất.</p></section>
      <section><h2>Câu hỏi thường gặp</h2>${faqItems.slice(0, 4).map(([q, a]) => `<h3>${escapeHtml(q)}</h3><p>${escapeHtml(a)}</p>`).join('')}<p><a href="/faq">Xem tất cả câu hỏi thường gặp về Giặt Ký</a></p></section>
    </main>`;
  }
  if (route === '/faq') {
    return `<main>
      <h1>Câu hỏi thường gặp về Giặt Ký</h1>
      <p>Trang này tổng hợp các câu hỏi phổ biến về hệ thống quản lý tiệm giặt sấy Giặt Ký: phạm vi nghiệp vụ, quản lý nhiều cơ sở, chấm công, tính lương, email tự động và cách liên hệ hỗ trợ. Xem thêm <a href="/">trang chủ</a>, <a href="/services">dịch vụ</a> và <a href="/contact">liên hệ</a>.</p>
      ${faqData.map(item => `<section id="${escapeHtml(item.id)}"><h2>${escapeHtml(item.question)}</h2><p>${escapeHtml(item.answer)}</p></section>`).join('')}
    </main>`;
  }
  return `<main><h1>${escapeHtml(seo.title.replace(` | ${SITE_NAME}`, ''))}</h1><p>${escapeHtml(seo.description)}</p></main>`;
};

const renderHead = (route, seo, schema) => {
  const canonical = seo.canonical || `${SITE_URL}${route}`;
  const image = seo.image;
  const description = seo.description;
  const title = seo.title;
  const alt = seo.imageAlt || title;
  return `
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="keywords" content="Giặt Ký, phần mềm quản lý tiệm giặt, quản lý giặt sấy, laundry management software" />
    <meta name="author" content="${SITE_NAME}" />
    <meta name="publisher" content="${SITE_NAME}" />
    <meta name="robots" content="${escapeHtml(seo.robots)}" />
    <meta name="theme-color" content="#111111" />
    <meta name="application-name" content="${SITE_NAME}" />
    <meta name="apple-mobile-web-app-title" content="${SITE_NAME}" />
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <link rel="alternate" hreflang="vi" href="${escapeHtml(canonical)}" />
    <link rel="alternate" hreflang="x-default" href="${escapeHtml(canonical)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:locale" content="vi_VN" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(image)}" />
    <meta property="og:image:type" content="${imageType(image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(alt)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />
    <script type="application/ld+json">${JSON.stringify(schema)}</script>
  `;
};

const renderRoute = (route, seo) => {
  const html = cleanHead(template)
    .replace('</head>', `${renderHead(route, seo, schemaForRoute(route, seo))}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${contentForRoute(route, seo)}</div>`);
  const target = route === '/' ? templatePath : path.join(dist, route.replace(/^\//, ''), 'index.html');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, html);
};

Object.entries(routeSeo).forEach(([route, seo]) => renderRoute(route, seo));

const fetchPosts = async () => {
  const apiBase = process.env.VITE_API_URL;
  if (!apiBase) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(`${apiBase.replace(/\/+$/, '')}/posts`, { signal: controller.signal });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
};

const posts = await fetchPosts();
for (const post of Array.isArray(posts) ? posts : []) {
  const isRecruitment = post.post_type === 'recruitment';
  const route = `/${isRecruitment ? 'tuyen-dung' : 'blog'}/${post.slug}`;
  const seo = {
    title: `${post.meta_title || post.title} | ${SITE_NAME}`,
    description: post.meta_description || post.excerpt || post.title,
    canonical: `${SITE_URL}${route}`,
    image: post.og_image || post.featured_image || routeSeo['/blog'].image,
    imageAlt: post.title,
    robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  };
  renderRoute(route, seo);
  if (!isRecruitment) renderRoute(`/bai-viet/${post.slug}`, { ...seo, canonical: `${SITE_URL}/bai-viet/${post.slug}` });
}

// /ai/faq.json sinh từ đúng nguồn faqData.json — không nhập tay bản thứ hai
const aiFaq = {
  site: SITE_NAME,
  url: SITE_URL,
  language: 'vi',
  last_updated: new Date().toISOString().slice(0, 10),
  items: faqData.map(item => ({
    question: item.question,
    answer: item.answer,
    url: `${SITE_URL}/faq#${item.id}`,
  })),
};
fs.mkdirSync(path.join(dist, 'ai'), { recursive: true });
fs.writeFileSync(path.join(dist, 'ai', 'faq.json'), JSON.stringify(aiFaq, null, 2));

console.log(`Prerendered SEO HTML for ${Object.keys(routeSeo).length + posts.length} routes + synced ai/faq.json (${faqData.length} items).`);
