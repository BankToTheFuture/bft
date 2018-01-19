#!/usr/bin/env bash
pushd () {
    command pushd "$@" > /dev/null
}

popd () {
    command popd "$@" > /dev/null
}

echo "Running testrpc"

pushd ${PWD}/../
bash ./testrpc.sh >/dev/null 2>&1 &
popd

echo "Running tests"
node ../node_modules/.bin/truffle test $@

echo "Stopping the testrpc ethereum node"
pgrep -f "node_modules/.bin/testrpc-sc" | xargs kill -9

