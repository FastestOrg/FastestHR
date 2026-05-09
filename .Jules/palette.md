## 2025-03-24 - Accessibility improvements for icon buttons
**Learning:** Found multiple instances of icon-only `<button>` elements that lacked `aria-label` attributes for screen readers. Notably in Settings.tsx, HolidayCalendar.tsx, EmployeeDetail.tsx, and Performance.tsx.
**Action:** Adding `aria-label` attributes to improve screen reader accessibility.

## 2025-03-27 - Accessibility improvements for icon buttons
**Learning:** Found multiple instances of icon-only `<Button>` elements that lacked `aria-label` attributes for screen readers across `Topbar.tsx`, `NotificationsDropdown.tsx`, `AppSidebar.tsx`, `ApplyLeave.tsx`, `Documents.tsx`, `HelpDesk.tsx`, `Payroll.tsx`, `Settings.tsx`, `Employees.tsx`, and `Performance.tsx`.
**Action:** Adding `aria-label` attributes to improve screen reader accessibility.
## 2026-04-18 - AI Assistant Accessibility and Auto-focus
**Learning:** Found that the AI Assistant chat interface lacked basic accessibility (missing `aria-label` on icon-only Open, Close, and Send buttons) and forced the user to manually click into the input field after opening the chat overlay.
**Action:** Adding `aria-label`s for screen reader support and the `autoFocus` prop to the main chat input so it's ready for typing immediately when the overlay opens.

## 2026-05-09 - Password Visibility Toggle in Authentication Forms
**Learning:** Adding a "show/hide" toggle to password input fields is a critical usability improvement, especially in forms with complex password rules or "confirm password" fields. It reduces user friction, prevents blind typing errors, and is a standard accessibility best practice for authentication flows.
**Action:** Always ensure that password input fields (including 'confirm password') feature a 'show/hide' visibility toggle, particularly in registration and password reset components. Ensure the toggle button has a dynamic `aria-label` that reflects the current state (e.g., 'Show password' or 'Hide password').
