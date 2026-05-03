## 2025-03-24 - Accessibility improvements for icon buttons
**Learning:** Found multiple instances of icon-only `<button>` elements that lacked `aria-label` attributes for screen readers. Notably in Settings.tsx, HolidayCalendar.tsx, EmployeeDetail.tsx, and Performance.tsx.
**Action:** Adding `aria-label` attributes to improve screen reader accessibility.

## 2025-03-27 - Accessibility improvements for icon buttons
**Learning:** Found multiple instances of icon-only `<Button>` elements that lacked `aria-label` attributes for screen readers across `Topbar.tsx`, `NotificationsDropdown.tsx`, `AppSidebar.tsx`, `ApplyLeave.tsx`, `Documents.tsx`, `HelpDesk.tsx`, `Payroll.tsx`, `Settings.tsx`, `Employees.tsx`, and `Performance.tsx`.
**Action:** Adding `aria-label` attributes to improve screen reader accessibility.
## 2026-04-18 - AI Assistant Accessibility and Auto-focus
**Learning:** Found that the AI Assistant chat interface lacked basic accessibility (missing `aria-label` on icon-only Open, Close, and Send buttons) and forced the user to manually click into the input field after opening the chat overlay.
**Action:** Adding `aria-label`s for screen reader support and the `autoFocus` prop to the main chat input so it's ready for typing immediately when the overlay opens.
## 2024-05-03 - Missing Password Visibility Toggle on Reset Form
**Learning:** Found an inconsistency where the `ResetPassword` form lacked password visibility toggles, whereas `Login` and `Register` had them. This causes friction for users trying to securely type new complex passwords.
**Action:** Always ensure that any password input field (including 'confirm password') features a 'show/hide' visibility toggle across the entire application to reduce user friction and prevent blind typing errors.
