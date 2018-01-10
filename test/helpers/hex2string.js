
module.exports = function hex2string(hex) {
	hex = hex.slice(2);
	const str = new Buffer(hex, 'hex').toString();
	let ret= "";
	for(let i=0; i<str.length; i++) {
		if(str[i] === String.fromCharCode(0)) { break; }
		ret += str[i];
	}
	return ret;
}