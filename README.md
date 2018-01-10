# BFT smart contracts

The repo has 2 main contracts, BftCrowdsale and BftToken. Please follow the unit-tests and compare to specs.

# Instructions to run unit-tests

```
git clone git@github.com:BankToTheFuture/bft.git 

cd bft 
git submodule update --init --recursive
npm install 
```

The mnemonic in the file called `deploy_mnemonic.key` will be used for testing purposes.
For a production release, replace the mnemonic here with a new one. The key here will only be used for the `operator` account which is permissioned for whitelisting

```
cd test 
./run-project-tests.sh 
./run-zeppelin-tests.sh
```
