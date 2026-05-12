## 2024-12-05 - N+1 Query Anti-Pattern in React Query
**Learning:** Avoid using `Promise.all` `.map` loops containing independent database `.select()` queries inside `useQuery` query functions. This triggers sequential parallel queries, creating an N+1 scaling bottleneck that significantly slows down frontend rendering as lists grow.
**Action:** Extract all IDs into a unique array, execute a single `supabase.from().select().in()` bulk query, and construct a local Javascript Map to join the fetched data back to the primary list.
## 2024-06-03 - Combine Supabase Queries for Dependent Metrics
**Learning:** In dashboards or overviews, fetching multiple dependent metrics (e.g., employee count, department stats, attrition count) via individual React Query `useQuery` calls results in an N+1-like network problem to Supabase. Even if run in parallel, it generates redundant queries on the same table (e.g., `employees`).
**Action:** Always inspect dashboard components for redundant data fetching. When multiple metrics are derived from the same base table (e.g., `employees`), combine them into a single `useQuery` that fetches the entire required dataset once and computes the derived stats locally, reducing network latency and database load.

## 2026-03-29 - Use Metadata Wrappers for List Filtering Optimization
**Learning:** Directly augmenting or cloning source data objects (e.g., `employees.map(e => ({ ...e, _searchStr }))`) to optimize list filtering breaks referential integrity. This can cause unnecessary re-renders in child components and break logic relying on object identity (e.g., selection state).
**Action:** When optimizing list filtering with `useMemo`, use a metadata wrapper pattern: `list.map(item => ({ item, precalculatedField }))`. Perform the filter on the metadata and then map back to the original `item` references. This preserves identity while still eliminating redundant allocations and operations during filtering.
## 2026-04-24 - Optimize multi-pass filtering bottlenecks
**Learning:** In React components like analytics dashboards, deriving multiple stats via repeated inline `.filter()` calls inside `.map()` creates O(N * M) performance bottlenecks.
**Action:** Use a single-pass iteration inside a `useMemo` block to calculate all derived metrics at once.
## 2024-10-24 - Debouncing search inputs for useQuery
**Learning:** Immediate bindings of React state to `useQuery`'s `queryKey` for input elements (like search boxes) causes excessive re-renders and unnecessary API/Database calls on every keystroke.
**Action:** Always wrap the user input string in a `useDebounce` hook before passing it into the dependency array of `useQuery`. This ensures the database/API is only queried when the user stops typing.

## 2024-05-18 - Maintain Supabase DB Counts While Batching Profile Fetches
**Learning:** When attempting to resolve N+1 queries using `Promise.all` `.map` over Supabase queries, do not replace efficient DB-level exact counts (e.g., `.select('*', { count: 'exact', head: true })`) with batched row fetching (e.g., `.in(...)`) simply to compute the count locally. Fetching entire datasets into memory to perform a count causes severe performance and memory regressions when row limits scale.
**Action:** Resolve the N+1 problem on the profile/entity fetches by extracting IDs, deduping them, and batching via `.in()`, while continuing to execute the `head: true` count queries individually within the same concurrent `Promise.all` block.
## 2024-05-18 - [API Request Optimization]
**Learning:** React Query `queryKey` dependencies trigger re-fetches immediately when state changes. If bound directly to a text input, it causes an API call per keystroke, which is a significant performance bottleneck.
**Action:** Always debounce text input state (e.g., using `useDebounce(input, 300)`) before passing it to the `queryKey` array in `useQuery` to reduce unnecessary network requests and database load.

## 2024-06-11 - Single-Pass Aggregation over Repeated Filtering
**Learning:** In analytics or dashboard views (e.g., `RecruitmentAnalytics.tsx`), calculating multiple grouped or derived metrics (funnels, averages, per-user stats) by repeatedly calling `Array.filter()` and `Array.reduce()` during render leads to O(N*M) complexity and unnecessary re-renders as the dataset grows.
**Action:** When deriving multiple metrics from a single large array, replace repeated `filter()` calls with a single-pass iteration (using `forEach` or `reduce`) inside a `useMemo` block. Create local state maps/buckets within the memoized function, process the array once to populate them, and return the aggregated results. This reduces complexity to O(N) and prevents unnecessary recalculations.
## 2024-05-18 - Unnecessary API calls due to missing input debouncing
**Learning:** Raw input search values used directly inside React Query `queryKey` without debouncing can trigger excessive network and database calls (one per keystroke) leading to significant overhead.
**Action:** Always wrap user text input state with `useDebounce` and use the debounced value in the query dependencies instead of the raw input.
## 2026-05-12 - O(N*M) Filtering in Render Functions
**Learning:** In reporting components, using  on an array combined with inner  or  calls directly in the React render body creates extreme performance bottlenecks by executing an O(N*M) operation on every render pass.
**Action:** Always wrap expensive aggregations in a `useMemo` and replace multi-pass filtering with a single-pass iteration that builds hash map lookups, reducing time complexity from O(N*M) to O(N).
## 2024-12-05 - O(N*M) Filtering in Render Functions
**Learning:** In reporting components, using `.map()` on an array combined with inner `.filter()` or `.reduce()` calls directly in the React render body creates extreme performance bottlenecks by executing an O(N*M) operation on every render pass.
**Action:** Always wrap expensive aggregations in a `useMemo` and replace multi-pass filtering with a single-pass iteration that builds hash map lookups, reducing time complexity from O(N*M) to O(N).
