
require('babel-register');
require('babel-polyfill');

let Web3 = require('web3');
let fs = require("fs");
let path = require("path")
let HDWalletProvider = require("truffle-hdwallet-provider");

let mnemonic = fs.readFileSync(path.join(__dirname, "../deploy_mnemonic.key"), {encoding: "utf8"}).trim();
let provider = new HDWalletProvider(mnemonic, "http://localhost:8545", 0, 20);
let web3 = new Web3(provider);

const BigNumber = web3.BigNumber;
let chai = require('chai');
let assert = chai.assert;
const should = require('chai')
	.use(require('chai-as-promised'))
	.use(require('chai-bignumber')(BigNumber))
	.should();

const BftCrowdsale = artifacts.require("../contracts/BftCrowdsale.sol");

let text = fs.readFileSync(path.join(__dirname, "contributors.txt"),{encoding: "utf8"})
let contributors = text.match(/[^\s]+/g);
console.log(JSON.stringify(contributors, null, 2));

contract('whitelist.kovan.js', function(rpc_accounts) {

	let crowdsale = '0xcfb0dee9d2b32ea7c2c510359d008d5757e9138f';
	let operator  = '0x4aab2747dd80258f46d38376ff6726d8231fbcd8';

	it('should be able to whitelist contributors', async () => {

		let instance = BftCrowdsale.at(crowdsale);
		for(let address of contributors) {

			let whitelisted = await instance.isWhitelisted(address);
			if(whitelisted) {
				console.log(address+" already whitelisted; skipping");
				continue;
			}

			console.log('sending for '+address);
			await instance.addWhitelist(
				address,
				{
					from: operator,
					gas: 50000,
					gasPrice: 5 * Math.pow(10, 9)
				}
			).should.be.fulfilled;

			whitelisted = await instance.isWhitelisted(address);
			console.log(address+" is now whitelisted");
		}

	})
});
