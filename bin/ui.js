#!/usr/bin/env node

import('../dist/cli.js')
  .then(({ run }) => run(process.argv.slice(2)))
  .then((code) => { process.exitCode = code; })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
