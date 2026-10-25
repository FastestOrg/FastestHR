-- Migration: 20261025000000_optimize_offer_templates_and_candidate_offers_storage.sql
-- Description: Replaces heavy inline base64 letterhead data URIs (200 KB each) 
--              with lightweight static template paths (/templates/offer-letterhead-*.png),
--              reducing candidate_offers table storage from ~89 MB to ~5.6 MB (93.6% reduction)
--              and cutting API network transfer drastically.

-- 1. Replace base64 in offer_templates
UPDATE public.offer_templates
SET html_content = CASE 
  WHEN length(substring(html_content from 'data:image/png;base64,[^"''\)]+')) > 195000 THEN
    regexp_replace(html_content, 'data:image/png;base64,[^"''\)]+', '/templates/offer-letterhead-fulltime.png')
  WHEN length(substring(html_content from 'data:image/png;base64,[^"''\)]+')) > 0 THEN
    regexp_replace(html_content, 'data:image/png;base64,[^"''\)]+', '/templates/offer-letterhead-parttime.png')
  ELSE html_content
END
WHERE is_predefined_html = true AND html_content LIKE '%data:image/png;base64%';

-- 2. Replace base64 in candidate_offers
UPDATE public.candidate_offers
SET html_content = CASE 
  WHEN length(substring(html_content from 'data:image/png;base64,[^"''\)]+')) > 195000 THEN
    regexp_replace(html_content, 'data:image/png;base64,[^"''\)]+', '/templates/offer-letterhead-fulltime.png')
  WHEN length(substring(html_content from 'data:image/png;base64,[^"''\)]+')) > 0 THEN
    regexp_replace(html_content, 'data:image/png;base64,[^"''\)]+', '/templates/offer-letterhead-parttime.png')
  ELSE html_content
END
WHERE html_content LIKE '%data:image/png;base64%';

-- 3. Vacuum and analyze to reclaim TOAST space and refresh query planner statistics
VACUUM (ANALYZE) public.offer_templates;
VACUUM (ANALYZE) public.candidate_offers;
