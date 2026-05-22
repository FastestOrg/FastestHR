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
