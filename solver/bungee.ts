import { formatUnits } from 'ethers/lib/utils';
import { getTokenPrice } from '../service/coinmarketcap';
import { addressToTokenName, BUNGEE_API_KEY } from '../config/config';
import { ERC20__factory } from '../typechain';
import { BigNumber } from 'ethers';
import { sendUserOp, smartAccounts } from '../config/smart-account';
import axios, { Axios } from 'axios';
import { TokenRecord, tokensOwnedOnChain } from '../utils/utils';

type TokenList = any;
type Route = any;
type Path = {
  fromChainId: number;
  toChainId: number;
  fromTokenAddress: string;
  toTokenAddress: string;
  userAddress: string;
};

const socketAxiosClient = new Axios({
  ...axios.defaults,
  baseURL: 'https://api.socket.tech/v2',
  headers: {
    'API-KEY': BUNGEE_API_KEY,
  },
});

const getRouteTransactionData = async (route: Route) => {
  console.log(route);
  const response = await socketAxiosClient.post('/build-tx', { route });
  return response.data.result;
};

const socketTokenListCache = new Map<[number, number], { from: TokenList; to: TokenList }>();

const getSocketTokenList = async (fromChainId: number, toChainId: number) => {
  if (socketTokenListCache.has([fromChainId, toChainId])) {
    return socketTokenListCache.get([fromChainId, toChainId])!;
  }
  let response = await socketAxiosClient.get('/token-lists/from-token-list', {
    params: {
      fromChainId,
    },
  });
  const from = response.data.result;
  response = await socketAxiosClient.get('/token-lists/to-token-list', {
    params: {
      fromChainId,
      toChainId,
    },
  });
  const to = response.data.result;
  const tokenList = { from, to };
  socketTokenListCache.set([fromChainId, toChainId], tokenList);
  return tokenList;
};

const generateQuotes = async (
  tokenRecords: Record<string, TokenRecord[]>,
  targetChainId: number,
  walletAddress: string
) => {
  const quotes: [number, { path: Path; route: Route }][] = [];

  for (const chainId of Object.keys(tokenRecords)) {
    if (chainId === targetChainId.toString()) {
      continue;
    }

    const tokenList = await getSocketTokenList(parseInt(chainId), targetChainId);

    // Generate routes assuming maximal transfer
    for (const tokenRecord of tokenRecords[chainId]) {
      const fromToken = tokenList.from.find((token: any) => token.symbol === tokenRecord.symbol);
      const toToken = tokenList.to.find((token: any) => token.symbol === tokenRecord.symbol);
      const path = {
        fromChainId: parseInt(chainId),
        toChainId: targetChainId,
        fromTokenAddress: fromToken.address,
        toTokenAddress: toToken.address,
        userAddress: walletAddress,
      };
      const response = await socketAxiosClient.get('/quote', {
        params: {
          ...path,
          isContractCall: true,
          singleTxOnly: true,
          fromAmount: tokenRecord.balanceInWei.toString(),
          sort: 'output',
        },
      });
      const quote = response.data.result;
      const bestRoute = quote.routes.length > 0 ? quote.routes[0] : null;

      if (bestRoute) {
        quotes.push([
          bestRoute.outputValueInUsd / bestRoute.inputValueInUsd,
          {
            path,
            route: bestRoute,
          },
        ]);
      }
    }
  }

  // Sort in descending order by conversion %
  quotes.sort((a, b) => b[0] - a[0]);
  return quotes.map(([, route]) => route);
};

const regenerateQuoteWithUpdatedAmount = async (
  quote: { path: Path; route: Route },
  amount: BigNumber
) => {
  const response = await socketAxiosClient.get('/quote', {
    params: {
      ...quote.path,
      fromAmount: amount.toString(),
      isContractCall: true,
      singleTxOnly: true,
      sort: 'output',
    },
  });
  const newQuote = response.data.result;
  return {
    path: quote.path,
    route: newQuote.routes[0],
  };
};

const waitUntilBridgeSucceeds = async (
  transactionHash: string,
  fromChainId: number,
  toChainId: number
) => {
  return new Promise<void>((resolve, reject) => {
    const interval = setInterval(async () => {
      const response = await socketAxiosClient.get('/bridge-status', {
        params: {
          transactionHash,
          fromChainId,
          toChainId,
        },
      });
      const result = response.data.result;
      console.log(result);
      if (result.sourceTxStatus === 'COMPLETED' && result.destinationTxStatus === 'COMPLETED') {
        clearInterval(interval);
        resolve();
      }
    }, 1000);
  });
};

const executeQuotes = async (quotes: { path: Path; route: Route }[], walletAddress: string) => {
  const txHashes: { chainId: number; txHash: string }[] = [];
  for (const quote of quotes) {
    const smartAccount = smartAccounts[quote.path.fromChainId];
    if ((await smartAccount.getAccountAddress({})) !== walletAddress) {
      throw new Error('Wallet address does not match smart account address');
    }
    console.log(
      'Executing quote from ',
      ' on ',
      quote.path.fromChainId,
      ' to ',
      quote.path.toChainId,
      ' for amount ',
      quote.route.fromAmount,
      ' via ',
      quote.route.usedBridgeNames
    );
    const routeTransactionData = await getRouteTransactionData(quote.route);
    let approvalTx;
    if (routeTransactionData.approvalData?.minimumApprovalAmount) {
      approvalTx = {
        to: routeTransactionData.approvalData?.approvalTokenAddress,
        value: 0,
        data: ERC20__factory.createInterface().encodeFunctionData('approve', [
          routeTransactionData.approvalData.allowanceTarget,
          routeTransactionData.approvalData.minimumApprovalAmount,
        ]),
      };
    }
    const sendTransaction = {
      to: routeTransactionData.txTarget,
      value: routeTransactionData.value,
      data: routeTransactionData.txData,
    };

    console.log('Executing quote txn...');

    const batch = [...(approvalTx ? [approvalTx] : []), sendTransaction];
    const { hash } = await sendUserOp(batch, smartAccount, quote.path.fromChainId);
    await waitUntilBridgeSucceeds(hash, quote.path.fromChainId, quote.path.toChainId);
    txHashes.push({
      txHash: hash,
      chainId: quote.path.fromChainId,
    });
  }
  return txHashes;
};

export const consolidateHandler = async (
  sourceChainIds: (keyof typeof addressToTokenName)[],
  targetChainId: number,
  requiredTokenValueInUsd: number,
  walletAddress: string
) => {
  const tokenOwned: Record<string, TokenRecord[]> = Object.fromEntries(
    await Promise.all(
      sourceChainIds.map(async (chainId) => {
        const tokensOwned = await tokensOwnedOnChain(walletAddress, chainId);
        if (tokensOwned.length === 0) {
          return [chainId, []];
        }

        const tokensOwnedInUsd = await Promise.all(
          tokensOwned.map(async (item) => ({
            ...item,
            valueUsd: (await getTokenPrice(item.symbol)) * item.balance,
          }))
        );

        return [chainId, tokensOwnedInUsd];
      })
    )
  );

  console.log('TokenOwned', JSON.stringify(tokenOwned, null, 2));

  const totalValueOwnedOnTargetChainInUsd = tokenOwned[targetChainId].reduce(
    (acc: number, tokensOwned: TokenRecord) => acc + tokensOwned.valueUsd!,
    0
  );

  let fundsRequiredInUsd = requiredTokenValueInUsd - totalValueOwnedOnTargetChainInUsd;

  console.log('Total value owned on target chain', totalValueOwnedOnTargetChainInUsd);
  console.log('Required value on target chain', requiredTokenValueInUsd);
  console.log('Funds required in USD', fundsRequiredInUsd);

  if (fundsRequiredInUsd <= 0) {
    console.log('No need to consolidate');
    return;
  }

  // Generate all quotes based on sourceChains -> targetChain
  const rankedQuotes = await generateQuotes(tokenOwned, targetChainId, walletAddress);

  // Greedily transfer tokens based on requirement and highest conversion %
  const quotesToExecute = [];
  for (const quote of rankedQuotes) {
    let quoteToExecute = quote;
    const fromChain = quoteToExecute.path.fromChainId;
    const tokenRecord = tokenOwned[fromChain].find(
      (item) => item.address === quoteToExecute.path.fromTokenAddress
    )!;

    const fromTokenSymbol = tokenRecord.symbol;

    const toChain = quoteToExecute.path.toChainId;
    const toTokenSymbol = tokenOwned[toChain].find(
      (item) => item.address === quoteToExecute.path.toTokenAddress
    )!.symbol;

    let amountToTransfer = BigNumber.from(tokenRecord.balanceInWei);
    let amountToTransferInUSD = tokenRecord.valueUsd!;
    if (tokenRecord.valueUsd! > fundsRequiredInUsd) {
      // If the balance exceeds the requirement, adjust quote to transfer only the required amount
      amountToTransfer = BigNumber.from(tokenRecord.balanceInWei)
        .mul(Math.floor((fundsRequiredInUsd * 100000) / tokenRecord.valueUsd!))
        .div(100000);
      amountToTransferInUSD = fundsRequiredInUsd;
      quoteToExecute = await regenerateQuoteWithUpdatedAmount(quoteToExecute, amountToTransfer);
    }

    console.log(
      'Selecing quote from ',
      fromTokenSymbol,
      ' on ',
      quoteToExecute.path.fromChainId,
      'to ',
      toTokenSymbol,
      ' on ',
      toChain,
      ' for amount ',
      formatUnits(quoteToExecute.route.fromAmount, tokenRecord.decimals),
      ' via ',
      quoteToExecute.route.usedBridgeNames
    );

    fundsRequiredInUsd -= amountToTransferInUSD;
    quotesToExecute.push(quoteToExecute);
  }

  // Execute the quotes
  return await executeQuotes(quotesToExecute, walletAddress);
};
