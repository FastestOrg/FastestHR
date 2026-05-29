1.  **Refactor Employee Stats Calculation in `src/pages/Dashboard.tsx`:**
    *   Currently, the dashboard makes multiple O(N) passes over the `activeEmployees` array to compute: `deptMap`, `thisYearHires`, `attritionCount`, `upcomingBdays`, and `upcomingAnnis`.
    *   There are multiple `.filter()` and `.forEach()` calls, and inside the sort functions for birthdays and anniversaries, new `Date` objects are instantiated repeatedly.
    *   I will refactor this to process all these metrics in a single `for...of` pass, calculate time variables upfront to avoid repetitive `new Date()` calls, and push items to temporary lists which are then sorted once using the precalculated timestamps.

2.  **Run Pre-commit Checks:**
    *   Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.

3.  **Submit Changes:**
    *   Create a PR with title "⚡ Bolt: Refactor dashboard employee stats calculation to a single pass" and standard Bolt description formatting.
