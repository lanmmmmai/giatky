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

const faqItems = [
  ['Giặt Ký dùng cho ai?', 'Giặt Ký phù hợp cho tiệm giặt sấy, chuỗi cửa hàng và đội vận hành nhiều cơ sở.'],
  ['Giặt Ký có hỗ trợ nhiều cơ sở không?', 'Có. Hệ thống hỗ trợ phân quyền theo vai trò và lọc dữ liệu theo cơ sở.'],
  ['Website có hỗ trợ SEO và AI discovery không?', 'Có. Website có robots.txt, sitemap.xml, llms.txt, RSS, Atom, JSON-LD, Open Graph, Twitter Card và dữ liệu /ai.'],
];

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
  return [...base, breadcrumbSchema([{ name: 'Trang chủ', path: '/' }, { name: seo.title.replace(` | ${SITE_NAME}`, ''), path: route }])];
};

const contentForRoute = (route, seo) => {
  if (route.includes('/login')) {
    return `<main><h1>${escapeHtml(seo.title.replace(` | ${SITE_NAME}`, ''))}</h1><p>${escapeHtml(seo.description)}</p></main>`;
  }
  if (route === '/') {
    return `<main>
      <h1>Hệ thống quản lý tiệm giặt sấy Giặt Ký</h1>
      <section><h2>Giặt Ký là gì?</h2><p>Giặt Ký là phần mềm quản lý tiệm giặt sấy được xây dựng cho các cơ sở cần theo dõi đơn hàng, khách hàng, nhân viên và dòng tiền trong cùng một nơi.</p></section>
      <section><h2>Các chức năng chính.</h2><p>Hệ thống hỗ trợ nhận đồ, chọn dịch vụ, ghi nhận thanh toán, quản lý trạng thái đơn, theo dõi khách hàng, quản lý cơ sở, nhân viên, chấm công, bảng lương, báo cáo và CMS SEO.</p></section>
      <section><h2>Quản lý đơn hàng và khách hàng.</h2><p>Mỗi đơn hàng có mã riêng, thông tin khách, danh sách dịch vụ, tổng tiền, phụ thu, giảm giá và trạng thái thanh toán để đội vận hành phục vụ nhất quán hơn.</p></section>
      <section><h2>Quản lý cơ sở và nhân viên.</h2><p>Giặt Ký hỗ trợ vai trò admin, quản lý và nhân viên, phân dữ liệu theo cơ sở làm việc và giúp phối hợp nội bộ rõ ràng hơn.</p></section>
      <section><h2>Báo cáo doanh thu.</h2><p>Khu vực báo cáo tổng hợp doanh thu, thanh toán và kết quả vận hành theo thời gian để chủ cơ sở có cái nhìn nhanh về tình hình kinh doanh.</p></section>
      <section><h2>Câu hỏi thường gặp.</h2><p>Trang FAQ giải thích cách sử dụng Giặt Ký cho nhiều cơ sở, tuyển dụng, SEO và AI discovery.</p></section>
    </main>`;
  }
  if (route === '/faq') {
    return `<main><h1>FAQ - Câu hỏi thường gặp</h1>${faqItems.map(([q, a]) => `<section><h2>${escapeHtml(q)}</h2><p>${escapeHtml(a)}</p></section>`).join('')}</main>`;
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

console.log(`Prerendered SEO HTML for ${Object.keys(routeSeo).length + posts.length} routes.`);
