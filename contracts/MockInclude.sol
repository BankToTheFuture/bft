pragma solidity ^0.4.18;

import {BasicTokenMock} from '../zeppelin/contracts/mocks/BasicTokenMock.sol';
import {DetailedERC20Mock} from '../zeppelin/contracts/mocks/DetailedERC20Mock.sol';
import {PausableMock} from '../zeppelin/contracts/mocks/PausableMock.sol';
import {PausableTokenMock} from '../zeppelin/contracts/mocks/PausableTokenMock.sol';
import {SafeERC20Helper} from '../zeppelin/contracts/mocks/SafeERC20Helper.sol';
import {SafeMathMock} from '../zeppelin/contracts/mocks/SafeMathMock.sol';
import {StandardTokenMock} from '../zeppelin/contracts/mocks/StandardTokenMock.sol';
import {BurnableTokenMock} from '../zeppelin/contracts/mocks/BurnableTokenMock.sol';
import {CappedCrowdsaleImpl} from '../zeppelin/contracts/mocks/CappedCrowdsaleImpl.sol';

contract MockInclude {
	function MockInclude() public {

	}
}
