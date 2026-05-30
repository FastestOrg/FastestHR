import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read blogs.ts and all other phase files in src/data/
const dataDir = path.resolve(__dirname, '../src/data');
const blogFiles = fs.readdirSync(dataDir).filter(file => file.startsWith('blogs') && file.endsWith('.ts'));

let combinedContent = '';
blogFiles.forEach(file => {
  try {
    combinedContent += fs.readFileSync(path.join(dataDir, file), 'utf8') + '\n';
  } catch (e) {
    console.warn(`Could not read ${file}, skipping.`);
  }
});

const slugRegex = /slug:\s*["']([^"']+)["']/g;
const blogSlugs = [];
let match;
while ((match = slugRegex.exec(combinedContent)) !== null) {
  blogSlugs.push(match[1]);
}

const baseUrl = 'https://fastesthr.com';
const today = new Date().toISOString().split('T')[0];

const staticRoutes = [
  { url: '/', priority: '1.0' },
  { url: '/blog', priority: '0.9' },
  { url: '/login', priority: '0.8' },
  { url: '/register', priority: '0.8' },
  { url: '/company/about', priority: '0.7' },
  { url: '/company/careers', priority: '0.7' },
  { url: '/company/changelog', priority: '0.6' },
  { url: '/legal/terms', priority: '0.3' },
  { url: '/legal/privacy', priority: '0.3' },
  { url: '/legal/security', priority: '0.5' },
  { url: '/vs/legacy-hrms', priority: '0.9' },
  { url: '/solutions/startups', priority: '0.9' },
  { url: '/platform/core-engine', priority: '0.9' },
  { url: '/platform/payroll-os', priority: '0.9' },
  { url: '/platform/talent-pipeline', priority: '0.9' },
  { url: '/platform/api-docs', priority: '0.8' },
  { url: '/llms.txt', priority: '0.9' },
  { url: '/llms-full.txt', priority: '0.9' },
  { url: '/.well-known/ai-plugin.json', priority: '0.7' }
];
let sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

staticRoutes.forEach(route => {
  sitemap += `  <url>\n    <loc>${baseUrl}${route.url}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${route.priority}</priority>\n  </url>\n`;
});

blogSlugs.forEach(slug => {
  sitemap += `  <url>\n    <loc>${baseUrl}/blog/${slug}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>0.8</priority>\n  </url>\n`;
});

sitemap += `</urlset>\n`;

const outputPath = path.resolve(__dirname, '../public/sitemap.xml');
fs.writeFileSync(outputPath, sitemap);
console.log('Sitemap generated successfully with ' + (staticRoutes.length + blogSlugs.length) + ' routes.');
