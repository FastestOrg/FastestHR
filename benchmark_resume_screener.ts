import { performance } from 'perf_hooks';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function mockSupabaseCallSingle(id: string) {
  await delay(20); // simulate 20ms network latency per query
  return { data: id === '1' ? { id: '1' } : null };
}

async function mockSupabaseCallBatch(ids: string[]) {
  await delay(30); // simulate 30ms network latency for the batch query
  return { data: ids.includes('1') ? [{ candidate_id: '1' }] : [] };
}

async function runSequential(candidates: any[]) {
  const start = performance.now();

  for (const cand of candidates) {
    const { data: existing } = await mockSupabaseCallSingle(cand.id);
    if (!existing) {
        // do work
        await delay(5);
    }
  }

  return performance.now() - start;
}

async function runBatch(candidates: any[]) {
  const start = performance.now();

  const candidateIds = candidates.map(c => c.id);
  const { data: existingEmbeddings } = await mockSupabaseCallBatch(candidateIds);
  const existingSet = new Set(existingEmbeddings?.map(e => e.candidate_id) || []);

  for (const cand of candidates) {
    if (!existingSet.has(cand.id)) {
        // do work
        await delay(5);
    }
  }

  return performance.now() - start;
}

async function main() {
  const candidates = Array.from({ length: 50 }, (_, i) => ({ id: `${i}`, name: `Candidate ${i}` }));

  console.log("Warming up...");
  await runSequential(candidates.slice(0, 5));
  await runBatch(candidates.slice(0, 5));

  console.log("Running Sequential (N+1)...");
  let seqTotal = 0;
  for (let i = 0; i < 3; i++) {
    seqTotal += await runSequential(candidates);
  }
  const seqAvg = seqTotal / 3;

  console.log("Running Batch...");
  let batchTotal = 0;
  for (let i = 0; i < 3; i++) {
    batchTotal += await runBatch(candidates);
  }
  const batchAvg = batchTotal / 3;

  console.log(`\n--- Results (ResumeScreener N+1) ---`);
  console.log(`Candidates count: ${candidates.length}`);
  console.log(`Sequential Average: ${seqAvg.toFixed(2)}ms`);
  console.log(`Batch Average: ${batchAvg.toFixed(2)}ms`);
  console.log(`Improvement: ${((seqAvg - batchAvg) / seqAvg * 100).toFixed(2)}% faster`);
}

main();
