import { EntryPoint_v006__factory } from '@biconomy/common';
import * as dotenv from 'dotenv';
import { Wallet, ethers } from 'ethers';
import axios, { Axios } from 'axios';

dotenv.config();

export const chainNameToId = {
  ARB: 42161,
  BASE: 8453,
  zkEVM: 1101,
};

const bundlerApiKeys = {
  1101: 'cJPK7B3ru.dd7f7861-190d-45ic-af80-6877f74b8f44', //zkevm
  8453: 'cJPK7B3ru.dd7f7861-190d-45ic-af80-6877f74b8f44', //base
  42161: 'cJPK7B3ru.dd7f7861-190d-45ic-af80-6877f74b8f44', //arb
};

const paymasterApiKeys = {
  137: 'PP4Nc9NKF.c5fd91f0-70e5-4bd9-8a22-fe163e2b4b61',
};

const rpcUrls = {
  1101: 'https://polygonzkevm-mainnet.g.alchemy.com/v2/5SSCCpZLALU28NFyjQlA05y3a-8lRVo4',
  8453: 'https://base.llamarpc.com',
  42161: 'https://arb-mainnet.g.alchemy.com/v2/j_x-t42wzTMnkB1gP03NRNTsbTaPvB9x',
};

export const explorerUrls = {
  1101: 'https://zkevm.polygonscan.com',
  8453: 'https://basescan.org',
  42161: 'https://arbiscan.io',
};

export const NATIVE_TOKEN_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
export const addressToTokenName = {
  1101: {
    [NATIVE_TOKEN_ADDRESS]: 'ETH',
    '0xa8ce8aee21bc2a48a5ef670afcc9274c7bbbc035': 'USDC',
  },
  8453: {
    [NATIVE_TOKEN_ADDRESS]: 'ETH',
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 'USDC',
  },
  42161: {
    [NATIVE_TOKEN_ADDRESS]: 'ETH',
    '0xaf88d065e77c8cc2239327c5edb3a432268e5831': 'USDC',
  },
};
export const tokenNameToAddress = Object.fromEntries(
  Object.entries(addressToTokenName).map(([chainId, tokenNameToAddress]) => [
    chainId,
    Object.fromEntries(
      Object.entries(tokenNameToAddress).map(([address, tokenName]) => [tokenName, address])
    ),
  ])
);

export const config = {
  ownerPrivateKey: process.env.PRIVATE_KEY!,
  rpcUrls,
  bundlerUrl: Object.fromEntries(
    Object.entries(bundlerApiKeys).map(([chainId, apiKey]) => [
      chainId,
      `https://bundler.biconomy.io/api/v2/${chainId}/${apiKey}`,
    ])
  ),
  paymasterUrl: Object.fromEntries(
    Object.entries(paymasterApiKeys).map(([chainId, apiKey]) => [
      chainId,
      `https://paymaster.biconomy.io/api/v1/${chainId}/${apiKey}`,
    ])
  ),
  provider: Object.fromEntries(
    Object.entries(rpcUrls).map(([chainId, rpcUrl]) => [
      chainId,
      new ethers.providers.JsonRpcProvider(rpcUrl),
    ])
  ),
  entrtyPoint: Object.fromEntries(
    Object.entries(rpcUrls).map(([chainId, rpcUrl]) => [
      chainId,
      EntryPoint_v006__factory.connect(
        '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
        new Wallet(process.env.PRIVATE_KEY!, new ethers.providers.JsonRpcProvider(rpcUrl))
      ),
    ])
  ),
};

export const BUNGEE_API_KEY = process.env.BUNGEE_API_KEY!;
export const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY!;
export const ONEINCH_API_KEY = process.env.ONEINCH_API_KEY!;

export const rollupAxiosClient = new Axios({
  ...axios.defaults,
  baseURL: 'http://localhost:3000',
  headers: {},
});

export const STACKR_PRIVATE_KEY = process.env.STACKR_PRIVATE_KEY!;
export const STACKR_DOMAIN = {
  name: 'Stackr MVP v0',
  version: '1',
  chainId: 69420,
  verifyingContract: '0xe95157e7f6b65ccf3d7a2176d1162825a1436593',
  salt: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
};
export const ACTION_INPUT_TYPES = {
  TransactionData: [
    {
      name: 'id',
      type: 'uint256',
    },
    {
      name: 'type',
      type: 'string',
    },
    {
      name: 'hashs',
      type: 'string',
    },
  ],
  'update-state': [
    {
      name: 'type',
      type: 'string',
    },
    {
      name: 'id',
      type: 'uint256',
    },
    {
      name: 'byteCode',
      type: 'string',
    },
    {
      name: 'programCounter',
      type: 'uint256',
    },
    {
      name: 'transactionData',
      type: 'TransactionData',
    },
  ],
};
