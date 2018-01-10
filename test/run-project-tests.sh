#!/usr/bin/env bash
project_tests=$(/bin/ls *.js | sort)

mv "../contracts/MockInclude.sol" "../contracts/MockInclude.sol_"

for file in ${project_tests[@]} ; do
    js=`pwd`/${file}
    echo "Testing: ${js}"
    ./run-test.sh ${js}
done

mv "../contracts/MockInclude.sol_" "../contracts/MockInclude.sol"
