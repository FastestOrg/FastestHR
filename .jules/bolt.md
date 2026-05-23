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
## 2025-05-18 - Optimize array filtering loops using Set.has() and hoisted functions
**Learning:** Checking inclusion of IDs against another array (`array.includes()`) within a `.filter()` or `.map()` loop results in `O(N*M)` time complexity. In React rendering cycles, doing this repeatedly inside inline assignments without `useMemo` causes performance bottlenecks as dataset size increases. Repeatedly calling `.toLowerCase()` on the search string inside the loop is also inefficient.
**Action:** Convert arrays used for lookups into `Set`s before the loop to reduce lookup complexity to `O(1)`, resulting in `O(N+M)` time complexity overall. Pre-compute constant string transformations (like `.toLowerCase()`) before the loop. Wrap the entire array mapping/filtering calculation inside `useMemo` with appropriate dependencies to skip redundant processing when state hasn't changed.
## 2024-12-05 - Optimize O(N) includes to O(1) Set in filters
**Learning:** Using `Array.includes()` inside an `Array.filter()` callback creates an O(N*M) nested loop pattern, which becomes a performance bottleneck as the filtered array and the lookup array grow in size.
**Action:** When filtering an array based on the absence or presence of items in another array, always convert the lookup array into a `Set` before the loop, and use `Set.has()` instead of `Array.includes()` for O(1) lookups.

## 2024-12-05 - Hoist String Methods outside Array Filtering Loops
**Learning:** Calling string manipulation methods like `.toLowerCase()` on an unchanging search parameter directly inside an `Array.filter()` callback causes the same operation to be redundantly executed for every item in the array, wasting CPU cycles and generating excessive garbage collection overhead.
**Action:** Always extract invariant computations, such as `search.toLowerCase()`, into a constant variable outside the loop before starting the array iteration or filtering.

## 2024-12-05 - Batching sequential Database Queries inside mapping loops
**Learning:** Resolving N+1 issues when inserting/syncing tasks requires extracting keys, issuing a single `.in()` query, then running local filters to identify missing rows, and finally issuing a single bulk `.insert(array)`. When comparing timestamps retrieved from Supabase with locally constructed ISO strings, direct string comparison can fail due to time zone representation differences (`+00:00` vs `Z`).
**Action:** When migrating from individual `.select` loops to batched lookups, always convert date strings to numeric values using `new Date(...).getTime()` for reliable matching and idempotency.
## 2026-05-14 - Optimize Array Filtering in Render Paths
**Learning:** In React components that filter arrays during render, chaining `.filter()` with `.includes()` on arrays (O(N*M)) and performing repeated string allocations (e.g., `.toLowerCase()`) inside the loop can cause significant performance bottlenecks as lists grow.
**Action:** Always extract static values (like `search.toLowerCase()`) outside the filter loop, convert lookup arrays to `Set`s for O(1) membership checks, and wrap the entire operation in `useMemo` to prevent recalculation on every re-render.
