import { useEffect } from 'react';

export const SITE_URL = 'https://giatky.site';
export const SITE_NAME = 'Giặt Ký';
export const DEFAULT_IMAGE = `${SITE_URL}/og-image.svg`;

type JsonLd = Record<string, unknown> | Array<Record<string, unknown>>;

interface SEOProps {
  title: string;
  description: string;
  path?: string;
  keywords?: string;
  image?: string;
  type?: 'website' | 'article';
  robots?: string;
  jsonLd?: JsonLd;
  publishedTime?: string;
  modifiedTime?: string;
}

const upsertMeta = (selector: string, attrs: Record<string, string>) => {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  Object.entries(attrs).forEach(([key, value]) => element?.setAttribute(key, value));
};

const upsertLink = (selector: string, attrs: Record<string, string>) => {
  let element = document.head.querySelector<HTMLLinkElement>(selector);
  if (!element) {
    element = document.createElement('link');
    document.head.appendChild(element);
  }
  Object.entries(attrs).forEach(([key, value]) => element?.setAttribute(key, value));
};

export const buildOrganizationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': ['Organization', 'LocalBusiness'],
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  legalName: 'Giặt Ký',
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.svg`,
  image: DEFAULT_IMAGE,
  email: 'support@giatky.site',
  telephone: '+84-1900-0000',
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'VN',
    addressLocality: 'Việt Nam',
  },
  contactPoint: [{
    '@type': 'ContactPoint',
    contactType: 'customer support',
    telephone: '+84-1900-0000',
    email: 'support@giatky.site',
    availableLanguage: ['vi', 'en'],
  }],
  sameAs: [
    'https://giatky.site',
    'https://github.com/lanmmmmai/giatky',
  ],
});

export const buildWebsiteSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: SITE_NAME,
  url: SITE_URL,
  publisher: { '@id': `${SITE_URL}/#organization` },
  inLanguage: 'vi-VN',
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_URL}/blog?search={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
});

export const buildSoftwareSchema = () => ({
  '@context': 'https://schema.org',
  '@type': ['SoftwareApplication', 'WebApplication'],
  '@id': `${SITE_URL}/#software`,
  name: SITE_NAME,
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'Laundry Management',
  operatingSystem: 'Web',
  url: SITE_URL,
  image: DEFAULT_IMAGE,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'VND',
    availability: 'https://schema.org/InStock',
  },
  publisher: { '@id': `${SITE_URL}/#organization` },
});

export const buildBreadcrumbSchema = (items: Array<{ name: string; path: string }>) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: `${SITE_URL}${item.path}`,
  })),
});

const SEO: React.FC<SEOProps> = ({
  title,
  description,
  path = '/',
  keywords = 'Giặt Ký, phần mềm quản lý tiệm giặt, quản lý giặt là, laundry management software, quản lý đơn hàng giặt là',
  image = DEFAULT_IMAGE,
  type = 'website',
  robots = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  jsonLd,
  publishedTime,
  modifiedTime,
}) => {
  useEffect(() => {
    const canonical = `${SITE_URL}${path}`;
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;

    document.documentElement.lang = 'vi';
    document.title = fullTitle;

    upsertMeta('meta[name="description"]', { name: 'description', content: description });
    upsertMeta('meta[name="keywords"]', { name: 'keywords', content: keywords });
    upsertMeta('meta[name="author"]', { name: 'author', content: SITE_NAME });
    upsertMeta('meta[name="publisher"]', { name: 'publisher', content: SITE_NAME });
    upsertMeta('meta[name="robots"]', { name: 'robots', content: robots });
    upsertMeta('meta[name="theme-color"]', { name: 'theme-color', content: '#111111' });
    upsertMeta('meta[name="application-name"]', { name: 'application-name', content: SITE_NAME });
    upsertMeta('meta[name="apple-mobile-web-app-title"]', { name: 'apple-mobile-web-app-title', content: SITE_NAME });

    upsertLink('link[rel="canonical"]', { rel: 'canonical', href: canonical });
    upsertLink('link[rel="alternate"][hreflang="vi"]', { rel: 'alternate', hrefLang: 'vi', href: canonical });
    upsertLink('link[rel="alternate"][hreflang="x-default"]', { rel: 'alternate', hrefLang: 'x-default', href: canonical });

    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: type });
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: SITE_NAME });
    upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: 'vi_VN' });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: fullTitle });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: image });
    if (publishedTime) upsertMeta('meta[property="article:published_time"]', { property: 'article:published_time', content: publishedTime });
    if (modifiedTime) upsertMeta('meta[property="article:modified_time"]', { property: 'article:modified_time', content: modifiedTime });

    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: fullTitle });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image });

    const schema = (document.getElementById('page-json-ld') as HTMLScriptElement | null) || document.createElement('script');
    schema.id = 'page-json-ld';
    schema.type = 'application/ld+json';
    schema.textContent = JSON.stringify(jsonLd || [
      buildOrganizationSchema(),
      buildWebsiteSchema(),
      buildSoftwareSchema(),
      buildBreadcrumbSchema([{ name: 'Trang chủ', path }]),
    ]);
    if (!schema.parentElement) document.head.appendChild(schema);
  }, [description, image, jsonLd, keywords, modifiedTime, path, publishedTime, robots, title, type]);

  return null;
};

export default SEO;
