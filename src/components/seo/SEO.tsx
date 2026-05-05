import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  article?: boolean;
  author?: string;
  date?: string;
  category?: string;
  canonical?: string;
  type?: 'website' | 'article' | 'software' | 'person' | 'job';
  breadcrumbs?: Array<{ name: string; path: string }>;
  faqs?: Array<{ question: string; answer: string }>;
  jobPosting?: {
    title: string;
    description: string;
    datePosted: string;
    validThrough?: string;
    employmentType: string;
    hiringOrganization: {
      name: string;
      sameAs?: string;
      logo?: string;
    };
    jobLocation: {
      addressLocality: string;
      addressRegion?: string;
      addressCountry: string;
    };
    baseSalary?: {
      currency: string;
      value: number | { min: number; max: number };
      unitText: string;
    };
  };
  person?: {
    name: string;
    description?: string;
    jobTitle?: string;
    image?: string;
    sameAs?: string[];
  };
  robots?: string;
}

/**
 * SEO Component to manage all page metadata, Open Graph, Twitter cards, and JSON-LD structured data.
 */
export const SEO: React.FC<SEOProps> = ({
  title,
  description,
  keywords,
  image,
  article,
  author = 'FastestHR Team',
  date,
  category,
  canonical,
  type = 'website',
  breadcrumbs,
  faqs,
  jobPosting,
  person,
  robots = 'index, follow'
}) => {
  const siteName = 'FastestHR';
  const siteUrl = 'https://fastesthr.com';
  const defaultTitle = 'FastestHR | AI-Powered Workforce OS for Scaling Enterprises';
  const defaultDescription = 'FastestHR is the modern HR platform engineered for scaling enterprises. Featuring Neural Talent acquisition, Zero-Trust Payroll, and Real-Time Performance feedback.';
  const defaultImage = 'https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/59918d24-608b-4e3b-afcb-a133efbc4225/id-preview-ee149eb3--1f9ce50f-8d24-479b-acd8-e535221e7f10.lovable.app-1773472312491.png';
  const currentUrl = canonical || (typeof window !== 'undefined' ? window.location.href : siteUrl);

  const seo = {
    title: title ? `${title} | ${siteName}` : defaultTitle,
    description: description || defaultDescription,
    image: image || defaultImage,
    url: currentUrl,
  };

  // Structured Data (JSON-LD)
  const schemaOrgJSONLD: any[] = [
    {
      "@context": "http://schema.org",
      "@type": "Organization",
      "name": siteName,
      "description": "Next-gen AI-powered HR operating system for scaling enterprises.",
      "url": siteUrl,
      "logo": defaultImage,
      "brand": {
        "@type": "Brand",
        "name": siteName,
        "logo": defaultImage
      },
      "sameAs": [
        "https://twitter.com/FastestHR",
        "https://linkedin.com/company/fastesthr"
      ]
    },
    {
      "@context": "http://schema.org",
      "@type": "WebSite",
      "url": siteUrl,
      "name": siteName,
      "alternateName": ["FastestHR OS", "Fast HRMS", "Fastest HR"]
    }
  ];

  // FAQ Schema
  if (faqs && faqs.length > 0) {
    schemaOrgJSONLD.push({
      "@context": "http://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqs.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    });
  }

  // Breadcrumbs Schema
  if (breadcrumbs && breadcrumbs.length > 0) {
    schemaOrgJSONLD.push({
      "@context": "http://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": breadcrumbs.map((crumb, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "name": crumb.name,
        "item": crumb.path.startsWith('http') ? crumb.path : `${siteUrl}${crumb.path}`
      }))
    });
  }

  // BlogPosting Schema
  if (type === 'article' || article) {
    schemaOrgJSONLD.push({
      "@context": "http://schema.org",
      "@type": "BlogPosting",
      "url": seo.url,
      "name": seo.title,
      "headline": seo.title,
      "image": {
        "@type": "ImageObject",
        "url": seo.image
      },
      "description": seo.description,
      "author": {
        "@type": "Person",
        "name": author
      },
      "publisher": {
        "@type": "Organization",
        "name": siteName,
        "logo": {
          "@type": "ImageObject",
          "url": defaultImage
        }
      },
      "datePublished": date,
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": siteUrl
      }
    });
  } 
  
  // JobPosting Schema
  if (jobPosting) {
    schemaOrgJSONLD.push({
      "@context": "http://schema.org",
      "@type": "JobPosting",
      "title": jobPosting.title,
      "description": jobPosting.description,
      "datePosted": jobPosting.datePosted,
      "validThrough": jobPosting.validThrough,
      "employmentType": jobPosting.employmentType,
      "hiringOrganization": {
        "@type": "Organization",
        "name": jobPosting.hiringOrganization.name,
        "sameAs": jobPosting.hiringOrganization.sameAs,
        "logo": jobPosting.hiringOrganization.logo
      },
      "jobLocation": {
        "@type": "Place",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": jobPosting.jobLocation.addressLocality,
          "addressRegion": jobPosting.jobLocation.addressRegion,
          "addressCountry": jobPosting.jobLocation.addressCountry
        }
      },
      "baseSalary": jobPosting.baseSalary ? {
        "@type": "MonetaryAmount",
        "currency": jobPosting.baseSalary.currency,
        "value": typeof jobPosting.baseSalary.value === 'number' 
          ? jobPosting.baseSalary.value 
          : {
            "@type": "QuantitativeValue",
            "minValue": jobPosting.baseSalary.value.min,
            "maxValue": jobPosting.baseSalary.value.max,
            "unitText": jobPosting.baseSalary.unitText
          }
      } : undefined
    });
  }

  // Person Schema
  if (person) {
    schemaOrgJSONLD.push({
      "@context": "http://schema.org",
      "@type": "Person",
      "name": person.name,
      "description": person.description,
      "jobTitle": person.jobTitle,
      "image": person.image,
      "sameAs": person.sameAs
    });
  }

  if (type === 'software') {
    schemaOrgJSONLD.push({
      "@context": "http://schema.org",
      "@type": "SoftwareApplication",
      "name": siteName,
      "operatingSystem": "Web-based, Cloud, SaaS",
      "applicationCategory": "BusinessApplication, HRSoftware, HRMS",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.9",
        "reviewCount": "1250"
      }
    });
  }

  return (
    <Helmet>
      {/* Standard identity tags */}
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <meta name="image" content={seo.image} />
      <meta name="robots" content={robots} />
      <link rel="canonical" href={seo.url} />

      {/* Open Graph / Facebook */}
      <meta property="og:url" content={seo.url} />
      <meta property="og:type" content={type === 'article' ? 'article' : 'website'} />
      <meta property="og:title" content={seo.title} />
      <meta property="og:description" content={seo.description} />
      <meta property="og:image" content={seo.image} />
      <meta property="og:site_name" content={siteName} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seo.title} />
      <meta name="twitter:description" content={seo.description} />
      <meta name="twitter:image" content={seo.image} />
      <meta name="twitter:site" content="@FastestHR" />
      <meta name="twitter:creator" content="@FastestHR" />

      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(schemaOrgJSONLD)}
      </script>
    </Helmet>
  );
};
