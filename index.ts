import { BigNumber } from 'ethers';
import { swapHandler } from './solver/1inch';
import { consolidateHandler } from './solver/bungee';
import { NATIVE_TOKEN_ADDRESS, addressToTokenName } from './config/config';
import { init } from './config/smart-account';
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
    '0x0D125Df38bFd6eAA2478052ABB7d7E62d2CF604B_01_3131_415242_42415345_7a6b45564d_415242_3_02_415242_32303030_55534443_414e59_03_415242_3130303030303030303030303030__0D125Df38bFd6eAA2478052ABB7d7E62d2CF604B_04';
  await execute('0x1234', bytecode);
})();
