import { performance } from 'perf_hooks';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function mockGenerateAndUpload() {
  await delay(100); // simulate 100ms for PDF generation/upload
  return { pdfPath: 'mock_path.pdf' };
}

async function mockSupabaseInsertSingle() {
  await delay(20); // simulate 20ms DB insert
  return { error: null };
}

async function mockSupabaseInsertBatch() {
  await delay(30); // simulate 30ms batch DB insert
  return { error: null };
}

const numEmployees = 10;

async function runSequential() {
  const start = performance.now();

  for (let i = 0; i < numEmployees; i++) {
    await mockGenerateAndUpload();
    await mockSupabaseInsertSingle();
  }

  return performance.now() - start;
}

async function runParallel() {
  const start = performance.now();

  const promises = [];
  for (let i = 0; i < numEmployees; i++) {
    promises.push(mockGenerateAndUpload());
  }

  const results = await Promise.all(promises);
  await mockSupabaseInsertBatch();

  return performance.now() - start;
}

async function main() {
  console.log("Warming up...");
  await runSequential();
  await runParallel();

  console.log("Running Sequential...");
  let seqTotal = 0;
  for (let i = 0; i < 3; i++) {
    seqTotal += await runSequential();
  }
  const seqAvg = seqTotal / 3;

  console.log("Running Parallel...");
  let parTotal = 0;
  for (let i = 0; i < 3; i++) {
    parTotal += await runParallel();
  }
  const parAvg = parTotal / 3;

  console.log(`\n--- Results ---`);
  console.log(`Sequential Average: ${seqAvg.toFixed(2)}ms`);
  console.log(`Parallel Average: ${parAvg.toFixed(2)}ms`);
  console.log(`Improvement: ${((seqAvg - parAvg) / seqAvg * 100).toFixed(2)}% faster`);
}

main();
