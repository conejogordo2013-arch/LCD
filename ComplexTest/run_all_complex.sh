#!/usr/bin/env bash
set -euo pipefail
node tests_stress_lcdl.js
node run_learning_tests.js
node ComplexTest/complex_vm_suite.js
node ComplexTest/test_mega_program.js
node ComplexTest/encoding_suite.js
