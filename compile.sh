#!/usr/bin/env bash

trf="node node_modules/.bin/truffle"

echo "Running truffle compile"
${trf} compile --network development --optimize $@
