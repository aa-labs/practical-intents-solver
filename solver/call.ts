import { BigNumber } from 'ethers';
import { sendUserOp, smartAccounts } from '../config/smart-account';

export const callHandler = async (
  smartAccountAddress: string,
  chainId: number,
  to: string,
  value: BigNumber,
  callData: string
) => {
  console.log('Calling call handler with args: ', {
    smartAccountAddress,
    chainId,
    to,
    value: value.toString(),
    callData,
  });
  const smartAccount = smartAccounts[chainId];
  if ((await smartAccount.getAccountAddress()) !== smartAccountAddress) {
    throw new Error('Smart account address mismatch');
  }
  console.log('Executing call txn...');

  const { hash } = await sendUserOp([{ to, value, data: callData }], smartAccount, chainId);
  return { txHash: hash, chainId };
};
