import { BigNumber } from 'ethers';
import { sendUserOp, smartAccounts } from '../conifg/smart-account';

export const callHandler = async (
  smartAccountAddress: string,
  chainId: number,
  to: string,
  value: BigNumber,
  callData: string
): Promise<string> => {
  const smartAccount = smartAccounts[chainId];
  if ((await smartAccount.getAccountAddress()) !== smartAccountAddress) {
    throw new Error('Smart account address mismatch');
  }

  const { hash } = await sendUserOp([{ to, value, data: callData }], smartAccount, chainId);
  return hash;
};
