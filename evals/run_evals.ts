import { evaluateRules } from '../server/services/rules';
import evalCases from './eval_dataset.json';

interface EvalCase {
  id: string;
  name: string;
  type: string;
  ocrText: string;
  expectedVerdict: string;
}

export function runEvals() {
  console.log('--- Running Screen Buddy Benchmark Evals ---');
  let passed = 0;
  let totalScams = 0;
  let detectedScams = 0;
  let totalGenuine = 0;
  let falseAlarms = 0;

  for (const tc of evalCases as EvalCase[]) {
    const res = evaluateRules(tc.ocrText, [], 'en');
    const isMatch = res.verdict === tc.expectedVerdict;

    if (tc.type === 'scam') {
      totalScams++;
      if (res.verdict === 'scam') detectedScams++;
    } else if (tc.type === 'genuine') {
      totalGenuine++;
      if (res.verdict === 'scam') falseAlarms++;
    }

    if (isMatch) {
      passed++;
      console.log(`[PASS] ${tc.id}: ${tc.name} -> ${res.verdict}`);
    } else {
      console.log(`[FAIL] ${tc.id}: ${tc.name} -> Got ${res.verdict}, Expected ${tc.expectedVerdict}`);
    }
  }

  const scamRecall = (detectedScams / totalScams) * 100;
  const falseAlarmRate = (falseAlarms / totalGenuine) * 100;

  console.log('\n--- Metrics Summary ---');
  console.log(`Passed: ${passed}/${evalCases.length} (${((passed / evalCases.length) * 100).toFixed(1)}%)`);
  console.log(`Scam Recall: ${scamRecall.toFixed(1)}% (Target >= 95%)`);
  console.log(`False Alarm Rate: ${falseAlarmRate.toFixed(1)}% (Target <= 10%)`);
}

runEvals();
