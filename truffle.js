require('babel-register');
require('babel-polyfill');

let fs = require("fs");
let path = require("path")
let HDWalletProvider = require("truffle-hdwallet-provider");

let mnemonic = fs.readFileSync(path.join(__dirname, "deploy_mnemonic.key"), {encoding: "utf8"}).trim();
let kovan = new HDWalletProvider(mnemonic, "http://localhost:8545", 0, 20);

module.exports = {
	networks: {
		development: {
			host: 'localhost',
			port: 8545,
			network_id: '*',
		},
		kovan: {
			host: 'localhost',
			port: 8545,
			network_id: '*',
			provider: kovan,
		},
	},

	solc: {
		optimizer: {
			enabled: true,
			runs: 200
		}
	}
};
