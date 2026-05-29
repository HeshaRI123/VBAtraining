import { checkProblemSet } from '../src/core/engine';
import { problems } from '../src/data/problems';

const summary = await checkProblemSet(problems);

for (const result of summary.results) {
  const status = result.valid ? 'OK' : 'NG';
  console.log(`${status} ${result.problemId}`);
  for (const diagnostic of result.diagnostics) {
    console.log(`  - ${diagnostic.kind}: ${diagnostic.message}`);
  }
}

if (!summary.valid) {
  process.exitCode = 1;
}
