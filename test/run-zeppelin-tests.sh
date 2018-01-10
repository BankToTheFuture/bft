#!/usr/bin/env bash

declare -a zeppelin_tests=(
"../zeppelin/test/Ownable.test.js"
"../zeppelin/test/Pausable.test.js"
"../zeppelin/test/SafeERC20.test.js"
"../zeppelin/test/SafeMath.test.js"
"../zeppelin/test/BasicToken.test.js"
"../zeppelin/test/StandardToken.test.js"
"../zeppelin/test/PausableToken.test.js"
"../zeppelin/test/DetailedERC20.test.js"
"../zeppelin/test/CappedToken.test.js"
"../zeppelin/test/TokenTimelock.test.js"
"../zeppelin/test/Crowdsale.test.js"
"../zeppelin/test/Crowdsale.test.js"
"../zeppelin/test/BurnableToken.test.js"
"../zeppelin/test/CappedCrowdsale.test.js"
)

for file in ${zeppelin_tests[@]} ; do
    js=`pwd`/${file}
    echo "Testing: ${js}"
    ./run-test.sh ${js}
done
