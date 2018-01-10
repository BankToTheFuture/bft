#!/usr/bin/env bash

trf="node ../node_modules/.bin/truffle"

echo "Running tests"
${trf} test $@

