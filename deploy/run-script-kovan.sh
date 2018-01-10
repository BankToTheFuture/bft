#!/usr/bin/env bash

trf="node ../node_modules/.bin/truffle"

echo "Running script on KOVAN network"
${trf} test --network kovan $@

