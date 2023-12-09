import { BigNumber } from 'ethers';
import { swapHandler } from './solver/1inch';
import { consolidateHandler } from './solver/bungee';
import { NATIVE_TOKEN_ADDRESS, addressToTokenName } from './conifg/config';
import { smartAccounts, bundlers, init } from './conifg/smart-account';
import { parseEther, parseUnits } from 'ethers/lib/utils';
import { execute } from './interpreter';

(async () => {
  await init();
  // await consolidateHandler(
  //   [1101, 8453, 42161],
  //   42161,
  //   12,
  //   await smartAccounts[1101].getAccountAddress({})
  // );
  // await swapHandler(
  //   [NATIVE_TOKEN_ADDRESS],
  //   '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
  //   parseUnits('0.02', 6),
  //   42161,
  //   await smartAccounts[42161].getAccountAddress()
  // );
  const bytecode =
    '0xabcd_01_3130_415242_42415345_7a6b45564d_415242_3_02_3130_55534443_414e59_03_415242_3130_ashcdkhcbdhk_1234_04';
  await execute('0x1234', bytecode);
})();
