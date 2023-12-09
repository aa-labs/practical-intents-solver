import { BigNumber } from 'ethers';
import { decodeHexString } from '../utils/utils';

const updateProgramCounter = async (
  programId: string,
  newProgramCounter: number,
  txHash: string,
  chainId: string
) => {};

const OP_CODES: Record<string, string> = {
  USE: '01',
  CONSOLIDATE: '02',
  SWAP: '03',
  CALL: '04',
};

let stack: string[] = [];
let smartAccountAddress;

export const execute = async (programId: string, bytecode: string) => {
  stack = [];
  smartAccountAddress = '';

  const tokens = bytecode.split('_');
  let programCounter = 0;

  console.log(`VM: Begin Execution of program ${programId}`);

  while (programCounter < tokens.length) {
    let token = tokens[programCounter];
    if (token.startsWith('0x')) {
      token = token.slice(2);
    }

    HANDLERS[token] ? await HANDLERS[token]() : await handleDefault(token);

    ++programCounter;
  }
};

const handleUse = async () => {
  console.log(`VM: USE`);
  if (stack.length < 1) {
    throw new Error('VM: USE: Not enough arguments');
  }

  smartAccountAddress = `0x${stack.pop()!}`;
  console.log('VM: USE: Params: ', { smartAccountAddress });
};

const handleConsolidate = async () => {
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
  const fromChains = new Array(fromChainsLength).fill(0).map(() => decodeHexString(stack.pop()!));

  if (stack.length < 2) {
    throw new Error('VM: CONSOLIDATE: Not enough arguments for value and dest');
  }
  const dest = decodeHexString(stack.pop()!);
  const value = BigNumber.from(`0x${decodeHexString(stack.pop()!)}`);

  console.log('VM: CONSOLIDATE: Params: ', {
    value: value.toString(),
    dest,
    fromChains,
    fromChainsLength,
  });
};

const handleSwap = async () => {
  console.log(`VM: SWAP`);
  if (stack.length < 3) {
    throw new Error('VM: SWAP: Not enough arguments');
  }
  const from = `0x${stack.pop()!}`;
  const to = `0x${stack.pop()!}`;
  const value = BigNumber.from(`0x${decodeHexString(stack.pop()!)}`);
  console.log('VM: SWAP: Params: ', { value: value.toString(), to, from });
};

const handleCall = async () => {
  console.log(`VM: CALL`);
  if (stack.length < 4) {
    throw new Error('VM: CALL: Not enough arguments');
  }
  const to = `0x${stack.pop()!}`;
  const callData = `0x${stack.pop()!}`;
  const value = BigNumber.from(`0x${decodeHexString(stack.pop()!)}`);
  const chain = decodeHexString(stack.pop()!);
  console.log('VM: CALL: Params: ', { value: value.toString(), callData, to, chain });
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
