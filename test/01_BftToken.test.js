
require('babel-register');
require('babel-polyfill');

import EVMRevert from "../zeppelin/test/helpers/EVMRevert";
import {accounts} from './common/common';
import ether from '../zeppelin/test/helpers/ether';
import {increaseTimeTo} from "../zeppelin/test/helpers/increaseTime";

const BigNumber = web3.BigNumber;

let chai = require('chai');
let assert = chai.assert;
const should = require('chai')
	.use(require('chai-as-promised'))
	.use(require('chai-bignumber')(BigNumber))
	.should();

const BftToken = artifacts.require("../contracts/BftToken.sol");
const MintableToken = artifacts.require("../zeppelin/contracts/token/MintableToken.sol");
const Crowdsale = artifacts.require("../zeppelin/contracts/crowdsale/Crowdsale.sol");

contract('01_BftToken.sol', function(rpc_accounts) {

	let ac = accounts(rpc_accounts);
	console.log(JSON.stringify(ac, null, 2));
	const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

	const ETH_PRICE = 752.0;
	const TOKEN_PRICE = 0.1;
	const MINT_RATE = ETH_PRICE / TOKEN_PRICE;

	const TOKEN_CAP = ether(1000000000);
	const TOKEN_DEC = 18;

	let startTime = 1518818400; //Friday, 16th February 2018, 10:00pm UTC
	let endTime = 1520373600;   //Tuesday, 6th of March 2018, 10:00pm UTC

	let crowdsale = null;
	let myToken = null;
	let newToken = null;

	it('should be able to deploy the BftCrowdsale contract so we can call it from the token sc', async () => {

		crowdsale = await Crowdsale.new(
			startTime,
			endTime,
			MINT_RATE,
			ac.crowdsaleWallet,

			{from: ac.admin, gas: 6000000, gasPrice: 5 * Math.pow(10, 9)}
		).should.be.fulfilled;

		console.log("crowdsale.address= " +crowdsale.address);
	})

	it('should be able to deploy the BftToken contract and set initial state', async () => {

		myToken = await BftToken.new(
				TOKEN_CAP,
				TOKEN_DEC,
				crowdsale.address,
				{from: ac.admin, gas: 6000000}
			);

		console.log("myToken.address= " +myToken.address);

		newToken = await MintableToken.new({from: ac.admin, gas: 7000000});
		console.log("newToken.address= " +newToken.address);

		let startTransfersTime = await myToken.startTransfersTime();
		startTransfersTime.should.be.bignumber.equal(endTime, 'The startTransfersDate timestamp is incorrect');
	})

	it('should be able mint some tokens to my buyers', async () => {
		await myToken.mint(ac.buyer1, ether(1), {from: ac.admin}).should.be.fulfilled;
		let b1 = await myToken.balanceOf(ac.buyer1);
		b1.should.be.bignumber.equal(ether(1));

		await myToken.mint(ac.buyer2, ether(2), {from: ac.admin}).should.be.fulfilled;
		let b2 = await myToken.balanceOf(ac.buyer2);
		b2.should.be.bignumber.equal(ether(2));

		await myToken.mint(ac.buyer3, ether(3), {from: ac.admin}).should.be.fulfilled;
		let b3 = await myToken.balanceOf(ac.buyer3);
		b3.should.be.bignumber.equal(ether(3));

		await myToken.mint(ac.buyer4, ether(4), {from: ac.admin}).should.be.fulfilled;
		let b4 = await myToken.balanceOf(ac.buyer4);
		b4.should.be.bignumber.equal(ether(4));

		await myToken.mint(ac.buyer5, ether(5), {from: ac.admin}).should.be.fulfilled;
		let b5 = await myToken.balanceOf(ac.buyer5);
		b5.should.be.bignumber.equal(ether(5));
	})

	it('should not allow ERC20 interface use before startTransfersTime', async() => {
		await myToken.transfer(ac.buyer5, ether(0.1),{from: ac.buyer4}).should.be.rejectedWith(EVMRevert);
		await myToken.approve(ac.intruder2, ether(0.1),{from: ac.buyer4}).should.be.rejectedWith(EVMRevert);
		await myToken.increaseApproval(ac.intruder2, ether(0.1),{from: ac.buyer4}).should.be.rejectedWith(EVMRevert);
		await myToken.decreaseApproval(ac.intruder2, ether(0.1),{from: ac.buyer4}).should.be.rejectedWith(EVMRevert);
		await myToken.transferFrom(ac.buyer4, ac.buyer5, ether(0.1),{from: ac.buyer4}).should.be.rejectedWith(EVMRevert);
	})

	it('should allow ERC20 interface use after startTransfersTime', async() => {
		await increaseTimeTo(endTime);

		await myToken.transfer(ac.buyer1, ether(0.1),{from: ac.buyer4}).should.be.fulfilled;
		await myToken.approve(ac.buyer5, ether(0.1),{from: ac.buyer4}).should.be.fulfilled;

		await myToken.increaseApproval(ac.buyer5, ether(0.1),{from: ac.buyer4}).should.be.fulfilled;
		await myToken.decreaseApproval(ac.buyer5, ether(0.1),{from: ac.buyer4}).should.be.fulfilled;

		await myToken.transferFrom(ac.buyer4, ac.buyer1, ether(0.1),{from: ac.buyer5}).should.be.fulfilled;
	})

	it('should not allow public access to the burn function', async() => {
		await myToken.burn(ether(0.5), {from: ac.buyer1}).should.be.rejectedWith(EVMRevert);
	})

	it('should not allow a token holder to redeem before token is paused', async() => {
		await myToken.redeem({from: ac.buyer1}).should.be.rejectedWith(EVMRevert);
	})

	it('should not allow pausing from a non-owner', async() => {
		await myToken.pause({from: ac.intruder1}).should.be.rejectedWith(EVMRevert);
	})

	it('should not allow a token holder to redeem before having an upgrade token', async() => {
		await myToken.redeem({from: ac.buyer1}).should.be.rejectedWith(EVMRevert);
	})

	it('should not allow ERC20 interface use when paused', async() => {
		await myToken.pause({from: ac.admin}).should.be.fulfilled;
		assert.isTrue(await myToken.paused());

		await myToken.transfer(ac.buyer5, ether(0.1),{from: ac.buyer4}).should.be.rejectedWith(EVMRevert);
		await myToken.approve(ac.intruder2, ether(0.1),{from: ac.buyer4}).should.be.rejectedWith(EVMRevert);
		await myToken.increaseApproval(ac.intruder2, ether(0.1),{from: ac.buyer4}).should.be.rejectedWith(EVMRevert);
		await myToken.decreaseApproval(ac.intruder2, ether(0.1),{from: ac.buyer4}).should.be.rejectedWith(EVMRevert);
		await myToken.transferFrom(ac.buyer4, ac.buyer5, ether(0.1),{from: ac.buyer4}).should.be.rejectedWith(EVMRevert);

		await myToken.unpause({from: ac.admin}).should.be.fulfilled;
		assert.isFalse(await myToken.paused());
	})

	it('should allow upgrading even if not paused', async() => {
		assert.equal(await myToken.newToken(), NULL_ADDRESS);
		await myToken.upgrade(newToken.address, {from: ac.admin}).should.be.fulfilled;
		assert.equal(await myToken.newToken(), newToken.address);

		await newToken.transferOwnership(myToken.address, {from: ac.admin});
	})

	it('should allow a token holder to redeem after we have an upgrade token', async() => {

		let b0 = await myToken.balanceOf(ac.buyer1);
		await myToken.redeem({from: ac.buyer1}).should.be.fulfilled;

		let b1 = await myToken.balanceOf(ac.buyer1);
		b1.should.be.bignumber.equal(ether(0));

		let b2 = await newToken.balanceOf(ac.buyer1);
		b2.should.be.bignumber.equal(b0);
	})

	it('should allow a non-token holder to redeem ', async() => {
		await myToken.redeem({from: ac.intruder1}).should.be.fulfilled;
	})

	it('should allow a token holders to redeem twice - allow redeem with 0 balance', async() => {
		await myToken.redeem({from: ac.buyer1}).should.be.fulfilled;
	})

	it('should allow all token holders to redeem ', async() => {
		let totalSupply = await myToken.totalSupply();
		totalSupply.should.be.bignumber.equal(ether(15-1.2)); // 1.2 redeemed before by buyer1

		await myToken.redeem({from: ac.buyer2}).should.be.fulfilled;
		await myToken.redeem({from: ac.buyer3}).should.be.fulfilled;
		await myToken.redeem({from: ac.buyer4}).should.be.fulfilled;
		await myToken.redeem({from: ac.buyer5}).should.be.fulfilled;

		totalSupply = await myToken.totalSupply();
		totalSupply.should.be.bignumber.equal(ether(0));

		let newTotalSupply = await newToken.totalSupply();
		newTotalSupply.should.be.bignumber.equal(ether(15));
	})
});
