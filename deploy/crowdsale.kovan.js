
require('babel-register');
require('babel-polyfill');

let Web3 = require('web3');
let fs = require("fs");
let path = require("path")
let HDWalletProvider = require("truffle-hdwallet-provider");

let mnemonic = fs.readFileSync(path.join(__dirname, "../deploy_mnemonic.key"), {encoding: "utf8"}).trim();
let provider = new HDWalletProvider(mnemonic, "http://localhost:8545", 0, 20);
let web3 = new Web3(provider);

import {duration} from '../zeppelin/test/helpers/increaseTime'
import ether from '../zeppelin/test/helpers/ether';
import wei from '../test/helpers/wei';

let Promise = require('bluebird');

const BigNumber = web3.BigNumber;
let chai = require('chai');
let assert = chai.assert;
const should = require('chai')
	.use(require('chai-as-promised'))
	.use(require('chai-bignumber')(BigNumber))
	.should();

const BftCrowdsale = artifacts.require("../contracts/BftCrowdsale.sol");
const BftToken = artifacts.require("../contracts/BftToken.sol");

let ac = {
	admin: '0x320f77519307c9041c1626ee48226235992c85a2',
	operator: '0x4aab2747dd80258f46d38376ff6726d8231fbcd8',

	preSaleBfPlatform : '0xb674cac98f179f2caf34d5cd37cf0a7f46690984',
	company : '0x735218dc7c7259ba63105ef9fca1776d6559609c',
	rewardPool : '0xd6514387236595e080b97c8ead1cbf12f9a6ab65',
	shareholders : '0xce95ebac6cc4e09e79c2e6265b9ef3ee722ee9ee',
	tokenSaleCosts : '0x5bc79fbbce4e5d6c3de7bd1a252ef3f58a66b09c',

	crowdsaleWallet: '0x6ad84f90c401c29a86549fb208b969add5e46219',

	buyer1: '0x8c0022b891e2b4d5ae7af7400c635aee93728c8a',
	buyer2: '0xa5698d26417fc4cde6fcbce2a5ecd3bdd6649ff4',
	buyer3: '0xe8cfc068cce963421c994cc54e1412d5024bd247',
}

let pGetBalance = Promise.promisify(web3.eth.getBalance);
let pGetBlock = Promise.promisify(web3.eth.getBlock);
let pGetAccounts = Promise.promisify(web3.eth.getAccounts);

async function latestTime () {
	return (await pGetBlock('latest')).timestamp;
}

contract('crowdsale.kovan.js', function(rpc_accounts) {

	const PRICE_MULTIPLIER = 100;
	const ETH_PRICE = 749.90 * PRICE_MULTIPLIER;

	let crowdsale = null;
	let token = null;
	let aToken = null;

	let adminBalance = null;

	it('should be able to deploy the BftCrowdsale contract and set initial state', async () => {

		adminBalance = await pGetBalance(ac.admin);
		console.log("balance= "+wei(adminBalance));

		let accounts = await pGetAccounts();
		console.log(JSON.stringify(accounts, null, 2));
		console.log('admin= '+accounts[0]);

		let latestTimestamp = await latestTime();
		let startTime = 1515519000; //latestTimestamp + duration.hours(1);
		let endTime = 1515520800; //startTime + duration.weeks(12);

		console.log('startTime= '+startTime);
		console.log('endTime= '+endTime);

		crowdsale = await BftCrowdsale.new(
			startTime,
			endTime,
			ETH_PRICE,
			ac.crowdsaleWallet,

			ac.preSaleBfPlatform,
			ac.company,
			ac.rewardPool,
			ac.shareholders,
			ac.tokenSaleCosts,

			ac.operator,

			{from: ac.operator, gas: 6000000}
		);

		console.log("crowdsale.address= " +crowdsale.address);

		await crowdsale.transferOwnership(ac.admin, {from: ac.operator})
		let newOwner = await crowdsale.owner();
		console.log("token.owner= " +newOwner);

		aToken = await crowdsale.token();
		token = BftToken.at(aToken);
		console.log("token.address= " +token.address);

		let op = await crowdsale.operator();
		assert.equal(op, ac.operator.toLowerCase(), "operator address not set correctly");

		let bce = await crowdsale.buyerCapEther();
		console.log("buyerCapEther= "+wei(bce));

		let companyHolding2y = await crowdsale.companyHolding2y();
		let shareholdersHolding1y = await crowdsale.shareholdersHolding1y();

		console.log('companyHolding2y= '+companyHolding2y);
		console.log('shareholdersHolding1y= '+shareholdersHolding1y);
	})

});
