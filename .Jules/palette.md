## 2025-03-24 - Accessibility improvements for icon buttons
**Learning:** Found multiple instances of icon-only `<button>` elements that lacked `aria-label` attributes for screen readers. Notably in Settings.tsx, HolidayCalendar.tsx, EmployeeDetail.tsx, and Performance.tsx.
**Action:** Adding `aria-label` attributes to improve screen reader accessibility.

## 2025-03-27 - Accessibility improvements for icon buttons
**Learning:** Found multiple instances of icon-only `<Button>` elements that lacked `aria-label` attributes for screen readers across `Topbar.tsx`, `NotificationsDropdown.tsx`, `AppSidebar.tsx`, `ApplyLeave.tsx`, `Documents.tsx`, `HelpDesk.tsx`, `Payroll.tsx`, `Settings.tsx`, `Employees.tsx`, and `Performance.tsx`.
**Action:** Adding `aria-label` attributes to improve screen reader accessibility.
## 2026-04-18 - AI Assistant Accessibility and Auto-focus
**Learning:** Found that the AI Assistant chat interface lacked basic accessibility (missing `aria-label` on icon-only Open, Close, and Send buttons) and forced the user to manually click into the input field after opening the chat overlay.
**Action:** Adding `aria-label`s for screen reader support and the `autoFocus` prop to the main chat input so it's ready for typing immediately when the overlay opens.
## 2026-05-22 - [DropdownMenuTrigger and aria-labels]
**Learning:** In Shadcn UI implementations within this repository, DropdownMenuTrigger elements that use 'asChild' with icon-only Button components (e.g., using 'variant="ghost" size="icon"') frequently lack an explicit 'aria-label', causing screen reader accessibility issues as the underlying button receives no accessible name.
**Action:** When auditing or updating accessibility in this codebase, pay special attention to DropdownMenuTrigger elements with icon-only Buttons to ensure they have descriptive 'aria-label' attributes.
## 2026-05-18 - [Add Password Visibility Toggles for Better UX]
**Learning:** Blind-typing errors during password creation or reset cause significant user frustration. A consistent pattern of providing "Show/Hide" password visibility toggles using relative-positioned `Button` components with `Eye`/`EyeOff` icons over password `Input` fields significantly improves usability and accessibility.
**Action:** When creating or modifying authentication forms, always incorporate password visibility toggles with proper `aria-label` attributes to allow users to verify their input.

## 2026-05-13 - Password Visibility Toggles
**Learning:** While primary password fields often get visibility toggles during initial development, 'Confirm Password' fields and secondary auth flows (like Reset Password) are frequently missed, leading to frustrating blind-typing errors and friction.
**Action:** Always verify that *all* password input variants within a form or flow include a show/hide toggle, not just the primary input.
## 2026-05-15 - Password visibility on 'Confirm Password' fields
**Learning:** Found that while main password fields often have visibility toggles, 'Confirm Password' fields are frequently overlooked. This inconsistency causes UX friction as users can't verify what they typed in the confirmation field, leading to potential blind typing errors.
**Action:** Ensure all password input fields, including confirmation fields, have a consistent 'show/hide' visibility toggle.
## 2024-05-28 - ARIA Labels for Emoji Arrays
**Learning:** Raw emoji arrays rendered inside buttons are read literally by screen readers (e.g., "smiling face with smiling eyes"), stripping context.
**Action:** When rendering mapping options that are purely visual or emoji-based, convert the array of strings to an array of objects `{ emoji: string, label: string }` to provide proper `aria-label` and native `title` tooltips.
## 2024-05-28 - ARIA Labels on Destructive Icon Buttons
**Learning:** Found multiple instances where `Button` components using the `Trash2` icon for destructive actions (like removing conditions or deleting workflows) lacked text equivalents for screen readers. While `size="icon"` correctly styles them as circular buttons, it does not implicitly provide accessibility context.
**Action:** Always verify that `Button` components acting as icon-only controls explicitly include `aria-label` attributes to ensure they remain accessible to users relying on assistive technologies.
## 2026-05-29 - Added missing ARIA labels to icon-only buttons
**Learning:** Found multiple instances where icon-only custom Button components lacked `aria-label` attributes, affecting screen reader accessibility. Since the text is usually conveyed visually via icons (like 'X' for close, 'Trash' for delete), ensuring these components have proper labels is crucial for non-visual users.
**Action:** Always verify that `<Button size="icon">` or buttons without inner text include a descriptive `aria-label` property.

## 2026-05-30 - Added missing ARIA labels to multiple icon buttons
**Learning:** Found several instances across the app where icon-only `Button` elements lacked `aria-label`s, which is critical for screen reader users since they have no visible text. Specifically fixed these in AddCandidateDialog, OfferDetailsDialog, and AssetManagementTab.
**Action:** Always verify that `<Button size="icon">` or any button lacking visible text content explicitly includes a descriptive `aria-label`.
