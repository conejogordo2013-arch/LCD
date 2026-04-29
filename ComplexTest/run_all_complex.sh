#!/usr/bin/env bash
set -euo pipefail
node tests_stress_lcdl.js
node run_learning_tests.js
node ComplexTest/complex_vm_suite.js
