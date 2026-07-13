// Tiện ích dùng chung cho module Email Template (CMS)

// Client-side HTML sanitizer cho preview email (project không có thư viện
// sanitize; kết hợp iframe sandbox rỗng làm defense in depth)
export const sanitizeHtml = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, iframe, object, embed, form, link, meta, base').forEach(el => el.remove());
  doc.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith('on') || ((name === 'href' || name === 'src' || name === 'xlink:href') && value.startsWith('javascript:'))) {
        el.removeAttribute(attr.name);
      }
    });
  });
  return '<!doctype html>' + (doc.documentElement?.outerHTML || '');
};

// Chuyển văn bản thường (có {{biến}}) thành HTML email dễ đọc
export const generateHtmlFromText = (text: string): string => {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `      <p style="margin: 0 0 16px;">\n        ${p.replace(/\n/g, '<br />\n        ')}\n      </p>`)
    .join('\n');
  return `<html>
  <body style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6; margin: 0;">
    <div style="max-width: 640px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #171717; margin: 0 0 16px;">Giặt Ký</h2>
${paragraphs}
    </div>
  </body>
</html>`;
};
