import { performance } from 'perf_hooks';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runSearchWithDelay() {
  const start = performance.now();
  await delay(900);
  // simulate some database call latency
  await delay(50);
  return performance.now() - start;
}

async function runSearchWithoutDelay() {
  const start = performance.now();
  // simulate some database call latency
  await delay(50);
  return performance.now() - start;
}

async function main() {
  console.log("Warming up...");
  await runSearchWithDelay();
  await runSearchWithoutDelay();

  console.log("Running With Delay...");
  let delayTotal = 0;
  for (let i = 0; i < 3; i++) {
    delayTotal += await runSearchWithDelay();
  }
  const delayAvg = delayTotal / 3;

  console.log("Running Without Delay...");
  let noDelayTotal = 0;
  for (let i = 0; i < 3; i++) {
    noDelayTotal += await runSearchWithoutDelay();
  }
  const noDelayAvg = noDelayTotal / 3;

  console.log(`\n--- Results (Search Delay Removal) ---`);
  console.log(`With Delay Average: ${delayAvg.toFixed(2)}ms`);
  console.log(`Without Delay Average: ${noDelayAvg.toFixed(2)}ms`);
  console.log(`Improvement: ${((delayAvg - noDelayAvg) / delayAvg * 100).toFixed(2)}% faster (${(delayAvg - noDelayAvg).toFixed(2)}ms reduction)`);
}

main();
