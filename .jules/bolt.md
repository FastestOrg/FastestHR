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
## 2024-05-18 - RoleUsers Array Filtering Optimization\n**Learning:** In `RoleUsers.tsx`, filtering `allProfiles` against `assignedUsers` using `Array.includes()` inside `.filter()` caused an O(N*M) performance issue on every render. Additionally, lowercasing the search string occurred redundantly on every iteration.\n**Action:** Use `useMemo` to cache the filtered list. Before filtering, convert the negative list (`assignedUserIds`) to a `Set` for O(1) lookups. Hoist operations like `search.toLowerCase()` outside the loop. This pattern is highly effective for any complex filtering component.
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
## 2024-12-05 - Optimize O(N*M) Aggregations in Render Paths
**Learning:** In components like `Reports.tsx`, calculating aggregate metrics (like department headcount) by repeatedly filtering a main array (e.g. `employees.filter(e => e.department_id === dept.id).length`) for every item in a secondary array (e.g. `departments`) creates an O(N*M) performance bottleneck that blocks the main thread during render.
**Action:** Always replace nested `.filter()` loop patterns with a single-pass frequency map reduction (e.g. `employees.reduce`) to tally counts into a hash map, transforming the time complexity from O(N*M) to O(N+M). Wrap the aggregation logic in `useMemo` to prevent recalculation on every re-render.
## 2024-05-18 - Extract loop-invariant string operations from nested array callbacks
**Learning:** Performing string manipulations like `.toLowerCase()` inside an inner `.some()` loop (that itself is inside a `.filter()`) forces the JavaScript engine to allocate and discard identical strings redundantly O(N*M) times, increasing garbage collection and CPU overhead.
**Action:** Always extract invariant computations on outer-loop variables (e.g., `const lowerS = s.toLowerCase();`) to sit outside the inner array iteration method (like `.some()`).
## 2024-10-24 - Memoizing Array Filtering in Render
**Learning:** Performing inline array `.filter()` inside the render body combined with invariant operations like `.toLowerCase()` on search terms leads to unnecessary O(N) operations on every re-render, degrading performance.
**Action:** Always wrap expensive or data-transformation loops (like array filtering) in a `useMemo` block with appropriate dependencies (e.g., `[list, search]`). Hoist any single-run transformations (like converting the search string to lowercase) outside the filter loop but within the `useMemo` to minimize garbage collection overhead.
## 2024-12-05 - Optimize inline filter array counting during React Renders
**Learning:** Calling `.filter(condition).length` repeatedly inside React render templates (e.g. to display counts for various statuses) leads to O(N * M) redundant array iterations during every component re-render.
**Action:** Extract the tallying logic into a single-pass `useMemo` block that aggregates all required states (e.g. via a single `for` loop or `reduce` over the array) and stores them in a memoized `stats` object, reducing computational overhead from O(N * M) to O(N).
## 2024-12-05 - Optimize Grouping for Kanban Boards
**Learning:** In React render functions, grouping or mapping over categories (e.g., Kanban stages) and inside the `.map` loop repeatedly calling `.filter()` on a main array to get items for that category causes an O(Categories * N) computational bottleneck. This forces redundant array iterations on every re-render.
**Action:** Replace nested `.filter()` iterations within a map over categories with a single-pass `useMemo` iteration. Within the `useMemo`, reduce or loop over the main dataset once to populate a hash map (dictionary) keyed by category. Then, simply perform an O(1) lookup during the rendering mapping phase.
## 2026-05-28 - Optimize inline array element counting using single-pass logic\n**Learning:** In React components like `SendDeskSendShare.tsx`, computing counts using multiple `.filter(condition).length` calls chains results in repeated array traversals (O(N * M) behavior). This severely slows down rendering times as array size increases.\n**Action:** To eliminate O(N*M) performance bottlenecks when counting array values, avoid calling `.filter(condition).length` multiple times. Calculate all derived stats in a single-pass `for...of` or `.reduce()` loop inside a `useMemo` block, aggregating metrics efficiently.

## 2024-05-29 - Memoizing inline counts in Document list
**Learning:** React render functions that rely on O(Categories * N) inline filtering (e.g., `categories.map(cat => documents.filter(d => d.category === cat).length)`) cause significant, measurable bottlenecks, especially when paired with additional inline filter iterations for aggregate counts (like `documents.filter(d => d.expiresAt).length`).
**Action:** Replace multiple inline `.filter()` calls inside `.map()` loops with a single-pass `for...of` aggregate loop wrapped in `useMemo`. Store the results in a lookup dictionary (e.g., `categoryCounts[categoryName] = count`) to enable O(1) lookups during the render phase.
## 2024-05-29 - Memoizing inline counts in Document list
**Learning:** React render functions that rely on O(Categories * N) inline filtering (e.g., `categories.map(cat => documents.filter(d => d.category === cat).length)`) cause significant, measurable bottlenecks, especially when paired with additional inline filter iterations for aggregate counts (like `documents.filter(d => d.expiresAt).length`).
**Action:** Replace multiple inline `.filter()` calls inside `.map()` loops with a single-pass `for...of` aggregate loop wrapped in `useMemo`. Store the results in a lookup dictionary (e.g., `categoryCounts[categoryName] = count`) to enable O(1) lookups during the render phase.

## 2025-02-12 - Prevent O(N*M) lookups when rendering hierarchical relations
**Learning:** Rendering hierarchical structures (like Managers to Reports) by doing `.filter` on a child array within a `.map` loop over a parent array results in unnecessary O(N*M) time complexity every re-render.
**Action:** When grouping child entities by parent IDs, calculate the groupings in a single O(N) pass inside a `useMemo` block using an accumulator dictionary. Use O(1) dictionary lookups (`dict[parentId] || []`) inside the render block instead of inline filters.

## 2024-11-21 - [React Rendering: O(N) Array Operations]
**Learning:** Performing array aggregations, `.filter()`, and `.sort()` operations repeatedly inside a React component's return function creates significant O(N) or O(N log N) rendering bottlenecks.
**Action:** Extract all inline list transformations and aggregations into a single-pass loop wrapped inside a `useMemo` block to memoize the final UI structure before rendering.

## 2024-05-29 - O(N*M) String Operation Extraction during Filtering
**Learning:** Found an optimization opportunity where string conversions (e.g., `.toLowerCase()`) and object key generation (`Object.keys()`) were executed on every single iteration inside a React `.filter()` array method, leading to significant overhead on repetitive renders.
**Action:** Extract loop-invariant string operations (like `search.toLowerCase()`) outside of nested `.filter()` scopes. Leverage short-circuiting to check less computationally heavy conditions first before running expensive transformations inside filter evaluations.

## 2024-05-29 - O(N) Single-pass Aggregations in React Queries
**Learning:** Performing multiple array `.filter()` and `.forEach()` passes and re-instantiating `Date` objects within derived state calculations (e.g. employee metrics) creates O(N) and O(N log N) performance bottlenecks.
**Action:** Always accumulate metrics and perform derived calculations inside a single loop iteration over the primary data array. Precalculate timestamps instead of instantiating new `Date` objects repeatedly inside `.sort()` callbacks.
## 2024-05-29 - O(N*M) Lookup Optimization in Export Loops
**Learning:** Performing `Array.find()` lookups on external arrays (e.g. `departments.find(d => d.id === emp.department_id)`) inside mapping functions over large arrays (like generating CSV export lines for employees) leads to an O(N*M) performance bottleneck, causing significant main thread blockage.
**Action:** Always refactor these O(N*M) nested lookups by building a lookup dictionary map first (e.g. `departments.reduce((acc, d) => { acc[d.id] = d.name; return acc; }, {})`) outside the map function. Then, perform a single O(1) dictionary lookup inside the loop, transforming time complexity from O(N*M) to O(N+M).

## 2024-05-29 - O(N*M) Lookup in Render Loop
**Learning:** Found an `O(N*M)` nested lookup bottleneck inside a `.map` loop in `src/components/onboarding/EmployeeOnboardingView.tsx` where `.find` was repeatedly called on an array of `docSubmissions` on every render cycle.
**Action:** Replace `array.find()` inside `.map()` with a pre-computed dictionary mapping (using `Array.reduce()` inside a `useMemo()`) to reduce complexity to `O(N)`. This drastically reduces redundant operations and keeps rendering performant as the number of employees/documents grows.

## 2024-05-29 - O(N*M) Lookup Optimization in Onboarding Progress
**Learning:** Found an O(N*M) lookup bottleneck in `src/pages/Onboarding.tsx` where `docSubmissions.find(s => s.requirement_id === req.id)` was repeatedly called inside an O(N) map, which is inefficient.
**Action:** Always refactor these O(N*M) nested lookups by building a lookup dictionary map first using `useMemo` and `Array.reduce` to enable O(1) lookups during the render phase.
## 2024-06-01 - O(N*M) Lookup Optimization via Global Dictionaries and Single-Pass Reductions
**Learning:** Found multiple instances where `.find()` operations were executed during React renders inside `.map()` loops or inline property accessors. Specifically:
1. Inside combobox triggers fetching display data (`InviteHRUserDialog.tsx`).
2. Inside mapping static configurations like icons (`OnboardingSettingsDialog.tsx`).
3. Inside inline conditional rendering components (`KPI.tsx`).

Additionally, counting elements using `.filter(...).length` inside `useMemo` creates unnecessary temporary arrays.

**Action:**
- Always refactor `.find()` lookups by converting arrays into dictionaries (using `Array.reduce()`). Use a global `const` dictionary for static options (like icons), or a `useMemo` dictionary for dynamic states (like employee lists).
- Replace `.filter(...).length` inside `useMemo` hooks with single-pass `for...of` loops with counters to prevent temporary array allocations overhead.
