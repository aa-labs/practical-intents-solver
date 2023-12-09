import { ERC20__factory, NFT__factory } from './typechain';
import { init, sendUserOp, smartAccounts } from './config/smart-account';
import { BigNumber } from 'ethers';
import { formatUnits, parseUnits } from 'ethers/lib/utils';

// const callData = NFT__factory.createInterface().encodeFunctionData('safeMint', [
//   '0x0D125Df38bFd6eAA2478052ABB7d7E62d2CF604B',
//   parseUnits('15', 6),
// ]);

// console.log(callData);

// (async () => {
//   await init();
//   const smartAccount = smartAccounts[42161];
//   console.log(
//     await sendUserOp(
//       [
//         {
//           to: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
//           value: 0,
//           data: ERC20__factory.createInterface().encodeFunctionData('approve', [
//             '0x9CaeFEb398C3F2601Fb09E232f0a7eB37724b361',
//             BigNumber.from(10).pow(40),
//           ]),
//         },
//       ],
//       smartAccount,
//       42161
//     )
//   );
// })();
