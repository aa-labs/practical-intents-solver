import { BigNumber, ethers } from 'ethers';
import { decodeHexString, toExplorerUrl } from '../utils/utils';
import {
  ACTION_INPUT_TYPES,
  STACKR_DOMAIN,
  STACKR_PRIVATE_KEY,
  addressToTokenName,
  chainNameToId,
  rollupAxiosClient,
  tokenNameToAddress,
} from '../config/config';
import { consolidateHandler } from '../solver/bungee';
import { swapHandler } from '../solver/1inch';
import { callHandler } from '../solver/call';

// set to false to debug interpreter
const shouldExecute = false;

const getPayload = async (actionData: any) => {
  const wallet = new ethers.Wallet(STACKR_PRIVATE_KEY);
  const sign = await wallet._signTypedData(STACKR_DOMAIN, ACTION_INPUT_TYPES, actionData);

  return JSON.stringify({
    msgSender: wallet.address,
    signature: sign,
    payload: actionData,
  });
};

const updateProgramCounter = async (programCounter: number) => {
  const data = {
    type: 'update',
    id: 5,
    byteCode: Math.ceil(Math.random() * 10000).toString(),
    programCounter,
    transactionData: {
      id: 5,
      type: 'add',
      hashs: 'abc',
    },
  };
  const payload = getPayload(data);
  const response = await rollupAxiosClient.post('', {
    data: payload,
  });
  console.log('updateProgramCounter: ', response.data);
};

const updateTxHash = async (programCounter: number, txHash: string, type: string) => {
  const data = {
    type: 'addTransaction',
    id: 5,
    byteCode: Math.ceil(Math.random() * 10000).toString(),
    programCounter,
    transactionData: {
      id: programCounter,
      type,
      hashs: txHash,
    },
  };
  const payload = getPayload(data);
  const response = await rollupAxiosClient.post('', {
    data: payload,
  });
  console.log('updateTxHash: ', response.data);
};

const updateProgramCounterOnChain = async (
  programId: number,
  newProgramCounter: number,
  txs: { txHash: string; chainId: number }[],
  type: 'swap' | 'consolidate' | 'call'
) => {
  const explorerLinks = txs
    .map((tx) => toExplorerUrl(tx.txHash, tx.chainId as any))
    .reduce((a, b) => `${a},${b}`);
  console.log(
    `Updating program counter for program ${programId} to ${newProgramCounter} with txs\n: \t${explorerLinks}`
  );

  await updateProgramCounter(programCounter);
  await updateTxHash(programCounter, explorerLinks, type);
};

const OP_CODES: Record<string, string> = {
  USE: '01',
  CONSOLIDATE: '02',
  SWAP: '03',
  CALL: '04',
};

let stack: string[] = [];
let smartAccountAddress: string;
let programCounter = 0;

export const execute = async (programId: number, bytecode: string) => {
  stack = [];
  smartAccountAddress = '';
  programCounter = 0;

  const tokens = bytecode.split('_');

  console.log(`VM: Begin Execution of program ${programId}`);

  while (programCounter < tokens.length) {
    let token = tokens[programCounter];
    if (token.startsWith('0x')) {
      token = token.slice(2);
    }

    HANDLERS[token] ? await HANDLERS[token](programCounter) : await handleDefault(token);

    ++programCounter;
  }
};

const handleUse = async (programId: number) => {
  console.log(`VM: USE`);
  if (stack.length < 1) {
    throw new Error('VM: USE: Not enough arguments');
  }

  smartAccountAddress = `0x${stack.pop()!}`;
  console.log('VM: USE: Params: ', { smartAccountAddress });
};

const handleConsolidate = async (programId: number) => {
  console.log(`VM: CONSOLIDATE`);
  if (stack.length < 1) {
    throw new Error('VM: CONSOLIDATE: Not enough arguments');
  }
  const fromChainsLength = parseInt(stack.pop()!, 16);
  if (fromChainsLength > stack.length) {
    throw new Error(
      `VM: CONSOLIDATE: Not enough arguments for fromChains. Expected: ${fromChainsLength}, Actual: ${stack.length}`
    );
  }
  const fromChains = new Array(fromChainsLength)
    .fill(0)
    .map(() => decodeHexString(stack.pop()!))
    .map((chainName) => chainNameToId[chainName as keyof typeof chainNameToId]);

  if (stack.length < 2) {
    throw new Error('VM: CONSOLIDATE: Not enough arguments for value and dest');
  }
  const destChain = chainNameToId[decodeHexString(stack.pop()!) as keyof typeof chainNameToId];
  const value = parseFloat(decodeHexString(stack.pop()!));

  console.log('VM: CONSOLIDATE: Params: ', {
    value: value.toString(),
    destChain,
    fromChains,
    fromChainsLength,
  });

  if (shouldExecute) {
    const txns = await consolidateHandler(
      fromChains as (keyof typeof addressToTokenName)[],
      destChain,
      value,
      smartAccountAddress
    );
    if (!txns) {
      console.log('VM: CONSOLIDATE: No txns need to be executed');
      return;
    }
    await updateProgramCounterOnChain(programId, programCounter, txns, 'consolidate');
  } else {
    await updateProgramCounterOnChain(programId, programCounter, [], 'consolidate');
  }
};

const handleSwap = async (programId: number) => {
  console.log(`VM: SWAP`);
  if (stack.length < 4) {
    throw new Error('VM: SWAP: Not enough arguments');
  }
  const from = decodeHexString(stack.pop()!);
  const toTokenSymbol = decodeHexString(stack.pop()!);
  const value = BigNumber.from(decodeHexString(stack.pop()!));
  const chainId = chainNameToId[decodeHexString(stack.pop()!) as keyof typeof chainNameToId];
  const to = tokenNameToAddress[chainId][toTokenSymbol];
  console.log('VM: SWAP: Params: ', { value: value.toString(), to, from, chainId });

  if (shouldExecute) {
    const txn = await swapHandler(
      Object.keys(addressToTokenName[chainId as keyof typeof addressToTokenName]),
      to,
      value,
      chainId,
      smartAccountAddress
    );
    if (!txn) {
      throw new Error('VM: SWAP: No txns found');
    }
    await updateProgramCounterOnChain(programId, programCounter, [txn], 'swap');
  } else {
    await updateProgramCounterOnChain(programId, programCounter, [], 'swap');
  }
};

const handleCall = async (programId: number) => {
  console.log(`VM: CALL`);
  if (stack.length < 4) {
    throw new Error('VM: CALL: Not enough arguments');
  }
  const to = `0x${stack.pop()!}`;
  const callData = `0x${stack.pop()!}`;
  const value = BigNumber.from(`0x${decodeHexString(stack.pop()!)}`);
  const chainId = chainNameToId[decodeHexString(stack.pop()!) as keyof typeof chainNameToId];

  console.log('VM: CALL: Params: ', { value: value.toString(), callData, to, chainId });

  if (shouldExecute) {
    const txn = await callHandler(smartAccountAddress, chainId, to, value, callData);
    if (!txn) {
      throw new Error('VM: CALL: No txns found');
    }
    await updateProgramCounterOnChain(programId, programCounter, [txn], 'call');
  } else {
    await updateProgramCounterOnChain(programId, programCounter, [txn], 'call');
  }
};

const handleDefault = async (token: string) => {
  console.log(`VM: PUSH ${token}`);
  stack.push(token);
};

const HANDLERS = {
  [OP_CODES.USE]: handleUse,
  [OP_CODES.CONSOLIDATE]: handleConsolidate,
  [OP_CODES.SWAP]: handleSwap,
  [OP_CODES.CALL]: handleCall,
};
