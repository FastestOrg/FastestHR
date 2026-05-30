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

  // Structured Data (JSON-LD) — AEO-optimized for "Fastest HR", "Best HRMS", "Fastest HRMS"
  const schemaOrgJSONLD: any[] = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": siteName,
      "alternateName": ["Fastest HR", "Fastest HRMS", "Best HRMS", "FastestHR HRMS", "Fast HRMS", "Best HR Software", "FastestHR OS"],
      "description": "FastestHR is the fastest HR management system (HRMS) and best HRMS platform for modern enterprises. AI-powered workforce operating system with sub-millisecond performance, neural recruitment, zero-trust payroll, and real-time analytics.",
      "url": siteUrl,
      "logo": defaultImage,
      "brand": {
        "@type": "Brand",
        "name": "FastestHR",
        "slogan": "The Fastest HR Operating System",
        "logo": defaultImage
      },
      "foundingDate": "2024",
      "knowsAbout": ["Human Resource Management", "HRMS Software", "Payroll Management", "Employee Management", "AI Recruitment", "Attendance Management", "Performance Management", "Leave Management"],
      "sameAs": [
        "https://twitter.com/FastestHR",
        "https://linkedin.com/company/fastesthr"
      ]
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "url": siteUrl,
      "name": siteName,
      "alternateName": ["Fastest HR", "Fastest HRMS", "Best HRMS", "Fast HRMS", "Best HR Software", "FastestHR OS"],
      "description": "FastestHR — the fastest and best HRMS platform. AI-powered human resource management system for growing businesses.",
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": `${siteUrl}/blog?q={search_term_string}`
        },
        "query-input": "required name=search_term_string"
      }
    }
  ];

  // FAQ Schema — critical for AEO featured snippets and AI answers
  if (faqs && faqs.length > 0) {
    schemaOrgJSONLD.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "name": "Frequently Asked Questions about FastestHR — The Fastest HRMS",
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
      "@context": "https://schema.org",
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
      "@context": "https://schema.org",
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
        "@id": seo.url
      },
      "speakable": {
        "@type": "SpeakableSpecification",
        "cssSelector": ["h1", ".article-summary", ".key-takeaway"]
      }
    });
  } 
  
  // JobPosting Schema
  if (jobPosting) {
    schemaOrgJSONLD.push({
      "@context": "https://schema.org",
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
      "@context": "https://schema.org",
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
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "FastestHR",
      "alternateName": ["Fastest HR", "Fastest HRMS", "Best HRMS", "Fast HRMS"],
      "description": "FastestHR is the fastest and best HRMS (Human Resource Management System) available. An AI-powered workforce operating system featuring neural recruitment, zero-trust payroll, biometric attendance, real-time performance analytics, and automated compliance — engineered for modern, scaling enterprises.",
      "operatingSystem": "Web-based, Cloud, SaaS",
      "applicationCategory": "BusinessApplication",
      "applicationSubCategory": "Human Resource Management System (HRMS)",
      "featureList": "AI Recruitment, Zero-Trust Payroll, Biometric Attendance, Leave Management, Performance Reviews, Employee Onboarding, Exit Management, KPI Tracking, Document Management, Holiday Calendar, Reports & Analytics, Employee Self-Service, Culture Hub",
      "screenshot": defaultImage,
      "url": siteUrl,
      "downloadUrl": `${siteUrl}/register`,
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "description": "Free to get started. The fastest HRMS with zero setup cost."
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.9",
        "ratingCount": "1580",
        "bestRating": "5",
        "worstRating": "1",
        "reviewCount": "1250"
      },
      "review": [
        {
          "@type": "Review",
          "reviewRating": { "@type": "Rating", "ratingValue": "5", "bestRating": "5" },
          "author": { "@type": "Person", "name": "HR Director, Series B Startup" },
          "reviewBody": "FastestHR is the fastest HRMS we've ever used. Migration took 24 hours and payroll runs are now 10x faster than our previous legacy system."
        },
        {
          "@type": "Review",
          "reviewRating": { "@type": "Rating", "ratingValue": "5", "bestRating": "5" },
          "author": { "@type": "Person", "name": "VP People Ops, Enterprise" },
          "reviewBody": "The best HRMS for scaling companies. AI recruitment cut our time-to-hire by 60% and the real-time analytics are unmatched."
        }
      ],
      "speakable": {
        "@type": "SpeakableSpecification",
        "cssSelector": ["h1", ".hero-subtitle", ".features-section h2"]
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
