#!/usr/bin/env bash

trf="node ./node_modules/.bin/truffle"

echo "Deploying"
${trf} deploy --network development $@
