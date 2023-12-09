import { BiconomySmartAccountV2, DEFAULT_ENTRYPOINT_ADDRESS } from '@biconomy/account';
import { Bundler } from '@biconomy/bundler';
import { ECDSAOwnershipValidationModule } from '@biconomy/modules';
import { ContractReceipt, Wallet } from 'ethers';
import { config } from './config';
import { ChainId, Transaction } from '@biconomy/core-types';

export const smartAccounts: Record<string, BiconomySmartAccountV2> = {};
export const bundlers: Record<string, Bundler> = {};

export const init = async () => {
  console.log('Generating smart accounts...');

  await Promise.all(
    Object.keys(config.rpcUrls).map(async (chainId) => {
      const wallet = new Wallet(config.ownerPrivateKey, config.provider[chainId]);

      bundlers[chainId] = new Bundler({
        bundlerUrl: config.bundlerUrl[chainId],
        chainId: chainId as unknown as ChainId,
        entryPointAddress: DEFAULT_ENTRYPOINT_ADDRESS,
      });

      const ecdsaOwnershipValidationModule = await ECDSAOwnershipValidationModule.create({
        signer: wallet as any,
      });

      smartAccounts[chainId] = await (
        await BiconomySmartAccountV2.create({
          chainId: chainId as unknown as ChainId,
          bundler: bundlers[chainId],
          entryPointAddress: DEFAULT_ENTRYPOINT_ADDRESS,
          defaultValidationModule: ecdsaOwnershipValidationModule,
          activeValidationModule: ecdsaOwnershipValidationModule,
          rpcUrl: config.rpcUrls[parseInt(chainId) as keyof typeof config.rpcUrls],
        })
      ).init();

      let scwAddress = await smartAccounts[chainId].getAccountAddress({});
      console.log(`SCW address for chainId ${chainId}: ${scwAddress}`);
    })
  );

  console.log('Smart accounts generated!');
};

export const sendUserOp = async (
  txBatch: Transaction[],
  smartAccount: BiconomySmartAccountV2,
  chainId: number
): Promise<{ hash: string; receipt: ContractReceipt }> => {
  console.log('Send User Op: Build user op');
  const userOp = await smartAccount.buildUserOp(txBatch, {
    skipBundlerGasEstimation: false,
  });
  console.log('Send User Op: Sign user op hash');
  userOp.signature = await smartAccount.signUserOpHash(await smartAccount.getUserOpHash(userOp));

  console.log('Send User Op: handle ops');
  const entrypoint = config.entrtyPoint[chainId];
  const { wait, hash } = await entrypoint.handleOps(
    [userOp as any],
    await entrypoint.signer.getAddress(),
    {
      gasLimit: 3000000,
    }
  );
  console.log('user op submit tx hash', hash);
  const receipt = await wait();

  return { hash, receipt };
};
