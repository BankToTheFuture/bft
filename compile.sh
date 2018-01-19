#!/usr/bin/env bash

trf="node node_modules/.bin/truffle"

echo "Running testrpc"
./testrpc.sh >/dev/null 2>&1 &

echo "Running truffle compile"
${trf} compile --network development --optimize $@

echo "Stopping the testrpc ethereum node"
pgrep -f "node_modules/.bin/testrpc" | xargs kill -9
