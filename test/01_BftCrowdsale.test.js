require('babel-register');
require('babel-polyfill');

import EVMRevert from "../zeppelin/test/helpers/EVMRevert";
import {duration, increaseTimeTo} from '../zeppelin/test/helpers/increaseTime'
import {accounts} from './common/common';
import ether from '../zeppelin/test/helpers/ether';
import wei from './helpers/wei';

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
const TokenTimelock = artifacts.require("../zeppelin/contracts/token/TokenTimelock.sol");

contract('01_BftCrowdsale.sol', function(rpc_accounts) {

	let ac = accounts(rpc_accounts);

	let pGetBalance = Promise.promisify(web3.eth.getBalance);
	let pSendTransaction = Promise.promisify(web3.eth.sendTransaction);

	const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

	const SALE_CAP_USD = 21500;
	const BUYER_CAP_LOW_USD = 1000;
	const BUYER_CAP_HIGH_USD = 10000;
	const PRICE_MULTIPLIER = 100;
	const TOKENS_PER_USD= 10;

	const INIT_ETH_PRICE = 1000.0 * PRICE_MULTIPLIER;

	const TOKEN_DECIMALS = 18;
	const TOKEN_SYMBOL = 'BFT';
	const TOKEN_CAP = 1000000000;

	const tPreSaleBfPlatform = 300000000;
	const tCompany = 300000000;
	const tRewardPool = 200000000;
	const tShareholders = 100000000;
	const tTokenSaleCosts = 70000000;

	const tPreMintedSupply =
		tPreSaleBfPlatform+
		tCompany+
		tRewardPool+
		tShareholders+
		tTokenSaleCosts;

	let companyHolding2y = null;
	let shareholdersHolding1y = null;

	let crowdsale = null;
	let token = null;
	let aToken = null;

	let mintRate = null;
	let buyerCapLowEther = null;
	let buyerCapHighEther = null;
	let saleHardCapEther = null;

	let startTime = 1518818400; //Friday, 16th February 2018, 10:00pm UTC
	let endTime = 1520373600;   //Tuesday, 6th of March 2018, 10:00pm UTC

	let crowdsaleWalletBalanceBefore = undefined;

	it('should be able to deploy the BftCrowdsale contract and set initial state', async () => {

		crowdsaleWalletBalanceBefore = await pGetBalance(ac.crowdsaleWallet);

		console.log('startTime= '+startTime);
		console.log('endTime= '+endTime);

		crowdsale = await BftCrowdsale.new(
				startTime,
				endTime,
				INIT_ETH_PRICE,
				ac.crowdsaleWallet,

				ac.preSaleBfPlatform,
				ac.company,
				ac.rewardPool,
				ac.shareholders,
				ac.tokenSaleCosts,

				ac.operator1,
				ac.admin,

				SALE_CAP_USD,
				BUYER_CAP_LOW_USD,
				BUYER_CAP_HIGH_USD,

				{from: ac.operator1, gas: 7000000}
			);

		console.log("crowdsale.address= " +crowdsale.address);

		let result1 = await crowdsale.isOperator(ac.operator1);
		assert.isTrue(result1, "operator1 address not set correctly");

		let ad = await crowdsale.owner();
		assert.equal(ad, ac.admin, "operator1 address not set correctly");

		buyerCapLowEther = await crowdsale.buyerCapLowEther();
		buyerCapHighEther = await crowdsale.buyerCapHighEther();
		saleHardCapEther = await crowdsale.saleHardCapEther();
		mintRate = await crowdsale.mintRate();

		aToken = await crowdsale.token();
		token = BftToken.at(aToken);
		console.log("token.address= "+token.address);
		console.log("mintRate= "+mintRate);

		await crowdsale.addWhitelist(
			[
				ac.buyer1,
				ac.buyer2,
				ac.buyer3,
				ac.buyer4,
				ac.buyer5
			],
			{from: ac.operator1}
		).should.be.fulfilled;

		await increaseTimeTo(startTime);
	})


	it('should allow whitelisted buyers to participate', async() => {

		let result1 = await crowdsale.buyTokens(ac.buyer1,{from: ac.buyer1,value: buyerCapHighEther}).should.be.fulfilled;
		let result2 = await crowdsale.buyTokens(ac.buyer2,{from: ac.buyer1,value: buyerCapHighEther.div(2)}).should.be.fulfilled;

		let rewardPoolBalance1 = await token.balanceOf(ac.rewardPool);
		let result3 = await crowdsale.buyTokens(ac.buyer3,{from: ac.buyer1,value: buyerCapLowEther.mul(6)}).should.be.fulfilled;
		let rewardPoolBalance2 = await token.balanceOf(ac.rewardPool);


		console.log("receipt1.gasUsed= "+result1.receipt.gasUsed);
		console.log("receipt2.gasUsed= "+result2.receipt.gasUsed);
		console.log("receipt3.gasUsed= "+result3.receipt.gasUsed);

		console.log("buyer1= "+wei(await token.balanceOf(ac.buyer1)));
		console.log("buyer2= "+wei(await token.balanceOf(ac.buyer2)));
		console.log("buyer3= "+wei(await token.balanceOf(ac.buyer3)));

		console.log("rewardPool1= "+wei(rewardPoolBalance1));
		console.log("rewardPool2= "+wei(rewardPoolBalance2));
		console.log("rewardPool3= "+wei(rewardPoolBalance2.sub(rewardPoolBalance1)));

		let totalWei = buyerCapHighEther.add(buyerCapHighEther.div(2)).add(buyerCapLowEther.mul(6));

		let tBought1 = await token.balanceOf(ac.buyer1);
		tBought1.should.be.bignumber.equal(buyerCapHighEther.mul(mintRate));

		let tBought2 = await token.balanceOf(ac.buyer2);
		tBought2.should.be.bignumber.equal(buyerCapHighEther.div(2).mul(mintRate));

		let tBought3 = await token.balanceOf(ac.buyer3);
		tBought3.should.be.bignumber.equal(buyerCapLowEther.mul(6).mul(mintRate));

		let totalSupply = wei(await token.totalSupply());
		totalSupply.should.be.bignumber.equal(TOKEN_CAP);

		let ended = await crowdsale.hasEnded();
		assert.isTrue(ended, "sale should have ended already");

		let weiRaised = await crowdsale.weiRaised();
		weiRaised.should.be.bignumber.equal(totalWei);

		await crowdsale.transferTokenOwnership(ac.tokenAdmin, {from: ac.admin}).should.be.fulfilled;
		let tokenOwner = await token.owner();
		assert.equal(tokenOwner, ac.tokenAdmin);

		let mintFinished = await token.mintingFinished();
		assert.isTrue(mintFinished, "minting should have finished");
	})

});
