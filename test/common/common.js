function accounts(rpc_accounts) {
	return {
		admin: rpc_accounts[0],
		crowdsaleWallet: rpc_accounts[1],

		privateContributors: rpc_accounts[2],
		preSaleBfPlatform: rpc_accounts[3],
		company: rpc_accounts[4],
		rewardPool: rpc_accounts[5],
		shareholders: rpc_accounts[6],
		tokenSaleCosts: rpc_accounts[7],

		operator1: rpc_accounts[8],
		operator2: rpc_accounts[9],
		operator3: rpc_accounts[10],
		operator4: rpc_accounts[11],

		intruder1: rpc_accounts[12],
		intruder2: rpc_accounts[13],

		buyer1: rpc_accounts[14],
		buyer2: rpc_accounts[15],
		buyer3: rpc_accounts[16],
		buyer4: rpc_accounts[17],
		buyer5: rpc_accounts[18],

		tokenAdmin: rpc_accounts[19],
	};
}

function strip0x(input) {
	if (typeof(input) !== 'string') {
		return input;
	}
	else if (input.length >= 2 && input.slice(0, 2) === '0x') {
		return input.slice(2);
	}
	else {
		return input;
	}
}

function add0x(input) {
	if (typeof(input) !== 'string') {
		return input;
	}
	else if (input.length < 2 || input.slice(0, 2) !== '0x') {
		return '0x' + input;
	}
	else {
		return input;
	}
}

module.exports = {
	accounts: accounts,
	strip0x: strip0x,
	add0x: add0x,
};
