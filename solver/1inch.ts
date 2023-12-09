import axios, { Axios } from 'axios';
import { BigNumber, BigNumberish } from 'ethers';
import { decimals, tokensOwnedOnChain } from '../utils/utils';
import { NATIVE_TOKEN_ADDRESS, addressToTokenName } from '../conifg/config';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { getTokenPrice } from '../service/coinmarketcap';
import { sendUserOp, smartAccounts } from '../conifg/smart-account';

const oneInchAxiosClient = new Axios({
  ...axios.defaults,
  baseURL: 'https://api.1inch.dev',
  headers: {
    Authorization: 'Bearer ' + process.env.ONEINCH_API_KEY,
  },
});

const generateSwapTx = async (
  chain: number,
  src: string,
  dst: string,
  amount: BigNumber,
  smartAccountAddress: string
) => {
  const tx = [];
  let expectedAmountOut: BigNumber = BigNumber.from(0);

  if (src != NATIVE_TOKEN_ADDRESS) {
    try {
      const approveResponse = await oneInchAxiosClient.get(
        `/swap/v5.2/${chain}/approve/transaction`,
        {
          params: {
            tokenAddress: src,
            amount: amount.toString(),
          },
        }
      );

      const approveData = approveResponse.data;
      tx.push({
        to: approveData.to,
        data: approveData.data,
        value: approveData.value,
      });
    } catch (e) {
      console.error(`1inch: Failed to generate approval for ${src} on chain ${chain}`);
      console.error(e);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  try {
    const swapResponse = await oneInchAxiosClient.get(`/swap/v5.2/${chain}/swap`, {
      params: {
        src,
        dst,
        amount: amount.toString(),
        slippage: 1,
        from: smartAccountAddress,
      },
    });

    const swapData = swapResponse.data;
    expectedAmountOut = BigNumber.from(swapData.toAmount);

    tx.push({
      to: swapData.tx.to,
      data: swapData.tx.data,
      value: swapData.tx.value,
    });
  } catch (e) {
    console.error(`1inch: Failed to generate swap from ${src} to ${dst} on chain ${chain}`);
    console.error(e);
  }

  return { tx, expectedAmountOut };
};

export const swapHandler = async (
  fromTokens: string[],
  toToken: string,
  toAmountRequired: BigNumber,
  chainId: number,
  walletAddress: string
) => {
  console.log(
    `Calling swap handler with args: ${JSON.stringify({
      fromTokens,
      toToken,
      toAmountRequired,
      chainId,
      walletAddress,
    })}`
  );
  const ownedTokenRecords = await tokensOwnedOnChain(walletAddress, chainId as any);

  // Calculate how much funds are required on this chain
  let toAmountRequiredCurrent = toAmountRequired;
  const toTokenCurrentBalance = ownedTokenRecords.find(
    (tokenRecord) => tokenRecord.address === toToken
  )?.balanceInWei;
  if (toTokenCurrentBalance) {
    console.log('to token current balance', toTokenCurrentBalance.toString());
    toAmountRequiredCurrent = toAmountRequiredCurrent.sub(toTokenCurrentBalance);
  }
  const toTokenSymbol = (addressToTokenName as any)[chainId][toToken];
  console.log(
    `Funds required on ${chainId}: ${toAmountRequiredCurrent.toString()} ${toTokenSymbol}`
  );

  let tx: { to: string; value: BigNumberish; data: string }[] = [];

  // FCFS Swap via 1inch
  for (const fromToken of fromTokens) {
    if (toAmountRequiredCurrent.lte(0)) {
      console.log(`No need to swap on ${chainId}`);
      break;
    }

    if (fromToken == toToken) {
      continue;
    }

    const fromTokenRecord = ownedTokenRecords.find(
      (tokenRecord) => tokenRecord.address === fromToken
    );
    if (!fromTokenRecord) {
      throw new Error(`Token ${fromToken} not found`);
    }

    console.log(
      `Processing token ${
        fromTokenRecord.symbol
      } on chain ${chainId} with balance ${fromTokenRecord.balanceInWei.toString()}`
    );

    const tokenValueInUSD = fromTokenRecord.valueUsd;
    const amountRequiredInUSD =
      parseFloat(formatUnits(toAmountRequiredCurrent, await decimals(toToken, chainId))) *
      (await getTokenPrice(toTokenSymbol));

    console.log("From token's value in USD: ", tokenValueInUSD);
    console.log('Amount required in USD: ', amountRequiredInUSD);

    const amountInFromTokenToSwap =
      Math.min(tokenValueInUSD, amountRequiredInUSD) /
      (await getTokenPrice(fromTokenRecord.symbol));

    console.log('Amount in from token to swap', amountInFromTokenToSwap);

    const { tx: swapTx, expectedAmountOut } = await generateSwapTx(
      chainId,
      fromToken,
      toToken,
      parseUnits(amountInFromTokenToSwap.toFixed(8).toString(), await decimals(fromToken, chainId)),
      walletAddress
    );

    tx = [...tx, ...swapTx];

    console.log(`Expected amount out: ${expectedAmountOut.toString()}`);
    toAmountRequiredCurrent = toAmountRequiredCurrent.sub(expectedAmountOut);
    console.log(`Amount required in ${toToken} after swap: ${toAmountRequiredCurrent.toString()}`);
  }

  console.log('Generated swap', tx);

  const smartAccount = smartAccounts[chainId];
  await sendUserOp(tx, smartAccount, chainId);
};
