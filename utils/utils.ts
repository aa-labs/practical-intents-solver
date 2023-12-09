import { NATIVE_TOKEN_ADDRESS, addressToTokenName, config, explorerUrls } from '../conifg/config';
import { formatEther, formatUnits } from 'ethers/lib/utils';
import { ERC20__factory } from '../typechain';
import { BigNumber } from 'ethers';
import { getTokenPrice } from '../service/coinmarketcap';

export type TokenRecord = {
  symbol: string;
  address: string;
  balance: number;
  balanceInWei: BigNumber;
  valueUsd: number;
  decimals: number;
};

export const tokensOwnedOnChain = async (
  walletAddress: string,
  chainId: keyof typeof addressToTokenName
): Promise<TokenRecord[]> => {
  const provider = config.provider[chainId];
  const balances = (
    await Promise.all(
      Object.entries(addressToTokenName[chainId]).map(async ([address, symbol]) => {
        if (address === NATIVE_TOKEN_ADDRESS) {
          const balanceInWei = await provider.getBalance(walletAddress);
          const balance = parseFloat(formatEther(balanceInWei));
          const valueUsd = (await getTokenPrice(symbol)) * balance;
          return {
            symbol,
            address,
            balanceInWei,
            balance,
            decimals: 18,
            valueUsd,
          };
        } else {
          const token = ERC20__factory.connect(address, provider);
          const balanceInWei = await token.balanceOf(walletAddress);
          const decimals = await token.decimals();
          const balance = parseFloat(formatUnits(balanceInWei, decimals));
          const valueUsd = (await getTokenPrice(symbol)) * balance;
          return {
            symbol,
            address,
            balanceInWei,
            decimals,
            balance,
            valueUsd,
          };
        }
      })
    )
  ).filter(({ balance }) => balance > 0);

  return balances;
};

const decimalsCache = new Map<string, number>();
export const decimals = async (tokenAddress: string, chainId: number) => {
  if (decimalsCache.has(tokenAddress)) {
    return decimalsCache.get(tokenAddress)!;
  }

  let decimals;
  if (tokenAddress == NATIVE_TOKEN_ADDRESS) {
    decimals = 18;
  } else {
    decimals = await ERC20__factory.connect(tokenAddress, config.provider[chainId]).decimals();
  }

  decimalsCache.set(tokenAddress, decimals);
  return decimals;
};

export const balanceOf = async (tokenAddress: string, walletAddress: string, chainId: number) => {
  if (tokenAddress == NATIVE_TOKEN_ADDRESS) {
    return await config.provider[chainId].getBalance(walletAddress);
  } else {
    return await ERC20__factory.connect(tokenAddress, config.provider[chainId]).balanceOf(
      walletAddress
    );
  }
};

export const toExplorerUrl = (txHash: string, chainId: keyof typeof explorerUrls) =>
  `${explorerUrls[chainId]}/tx/${txHash}`;

export const decodeHexString = (hexStr: string): string => {
  if (hexStr.length % 2 !== 0) {
    hexStr = '0' + hexStr; // Pad with zero if odd length
  }
  let str = '';
  for (let i = 0; i < hexStr.length; i += 2) {
    const charCode = parseInt(hexStr.substring(i, i + 2), 16);
    if (charCode >= 32 && charCode < 127) {
      // Printable ASCII range
      str += String.fromCharCode(charCode);
    } else {
      return hexStr; // Return original hex string if non-printable char
    }
  }
  return str;
};
