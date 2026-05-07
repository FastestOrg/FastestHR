## 2023-10-27 - Fix XSS Vulnerability in External Links
**Vulnerability:** User-supplied URLs rendered directly in `href` attributes without protocol validation could lead to Cross-Site Scripting (XSS) if they contain `javascript:` URIs.
**Learning:** Found instances where meeting links (`interview.meeting_link`) and company external links (`website`, `linkedin_url`) were directly injected into `<a>` tags.
**Prevention:** Always validate external URLs to ensure they start with safe protocols (`http://` or `https://`) before rendering them in `href` attributes using a centralized utility function like `isSafeUrl`.
## 2024-03-24 - HTML Injection in PDF Templates
**Vulnerability:** XSS/HTML Injection vulnerability in `src/lib/pdf-generator.ts` where unescaped user inputs (e.g., candidate names, custom template variables) were directly substituted into HTML strings before being rendered to PDF and persisted.
**Learning:** The PDF generator natively executes `<script>` tags found in templates for features like CTC calculations before capturing `.innerHTML`. Using robust sanitizers like DOMPurify on the full template would strip these required scripts and break the feature.
**Prevention:** Rather than sanitizing the entire compiled template block or pulling in heavy dependencies, escape individual variable values (e.g., `&`, `<`, `>`, `"`, `'`) specifically during variable substitution. This ensures user input is safe while preserving the template's intentional functional elements.
## 2024-05-18 - [Fix Stored XSS and Regex Backref in ID Card Templates]
**Vulnerability:** ID card templates containing HTML and `<style>` blocks (authored by potentially malicious company admins) were rendered directly via `dangerouslySetInnerHTML` in three components without sanitization, leading to Stored XSS. Also, template variable replacement used string replacements `html.replace(regex, val)`, which suffers from regex backreference attacks if `val` contains tokens like `$&`.
**Learning:** Tenant-customizable templates must be sanitized before rendering. Using `dangerouslySetInnerHTML` without `dompurify` is dangerous, even for internal users. Furthermore, string-based regex replacement fails securely on malicious strings with regex tokens.
**Prevention:** Always wrap `dangerouslySetInnerHTML` content with `DOMPurify.sanitize(html, { ADD_TAGS: ['style'], ADD_ATTR: ['style'], FORCE_BODY: true })` if style tags are needed. Always use the callback form for replace `replace(regex, () => val)` to treat replacement values as literal strings.

## 2024-05-18 - [Insecure Randomness for Tokens and IDs]
**Vulnerability:** Used `Math.random()` to generate random strings for token creation (`generateRandomString` in `SendDeskGenerator`) and for file names in uploads (`VirtualIDCard` and `Documents`).
**Learning:** `Math.random()` is not cryptographically secure and can result in predictable outputs, especially problematic for generating password-like strings or predictable file paths.
**Prevention:** Always use `crypto.randomUUID()` for unique identifiers or `window.crypto.getRandomValues()` with typed arrays for generating secure random strings/tokens.
## 2024-05-24 - [Fix Insecure Random Number Generation for Security Purposes]
**Vulnerability:** The application used the predictable `Math.random()` function to generate random strings for SendDesk template documents and unique filenames for document and avatar uploads.
**Learning:** `Math.random()` is not cryptographically secure and its outputs can be predicted if enough values are known. This is a risk for unique identifiers or random secrets where predictability can lead to unauthorized access or collisions.
**Prevention:** Always use the Web Crypto API (`crypto.randomUUID()` for UUIDs or `crypto.getRandomValues()` for general random data) when generating tokens, filenames, or unique identifiers where unpredictability is important for security.
## 2024-05-18 - [Fix Protocol-based XSS in External Links]
**Vulnerability:** The application was directly using user-provided URLs (like company websites, LinkedIn profiles, and interview meeting links) in the `href` attribute of `<a>` tags without validation. This could allow protocol-based XSS attacks where an attacker inputs a URL starting with `javascript:` to execute malicious code when a user clicks the link.
**Learning:** React escapes HTML content to prevent XSS in child nodes, but it does not prevent malicious URIs in attributes like `href`. All user-supplied URLs must be validated to ensure they use a safe protocol.
**Prevention:** Implement a utility function like `isSafeUrl` to validate that URLs start with `http://` or `https://` before rendering them in an anchor tag.
## 2025-04-19 - Regex Backreference Injection in String.prototype.replace
**Vulnerability:** In `OfferLetterRenderer.tsx`, `DocumentRenderer.tsx`, and `pdf-generator.ts`, `String.prototype.replace(regex, value)` was used to substitute variables into HTML templates. If the user input contained special regex tokens like `$&` (which inserts the matched substring), it caused unintended injections and manipulation of the final output.
**Learning:** `String.prototype.replace()` interprets special replacement patterns (like `$&`, `$`, `$\``, `$'`) when passing a string as the second argument, bypassing simple HTML escaping if the token is valid in regex contexts.
**Prevention:** Always use a replacer function `String.prototype.replace(regex, () => value)` when replacing with dynamic or untrusted strings, as functions do not evaluate these special regex tokens.
## 2024-05-07 - Remove Hardcoded Supabase Credentials
**Vulnerability:** Supabase URL and Publishable Key were hardcoded in `src/integrations/supabase/client.ts` and `src/pages/Billing.tsx`.
**Learning:** Hardcoded credentials even in auto-generated files can expose sensitive project configuration and access, risking unauthorized interaction.
**Prevention:** Always use environment variables (`import.meta.env.VITE_SUPABASE_URL`, etc.) for credentials, especially in frontend code, and ensure they are loaded dynamically even in auto-generated code blocks where possible.
