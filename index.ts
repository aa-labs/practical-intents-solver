import { rollupAxiosClient } from "./config/config";
import { init } from "./config/smart-account";
import { execute } from "./interpreter";

type Intent = {
  id: number;
  byteCode: string;
  programCounter: number;
};

const getAllIntents = async (): Promise<Intent[]> => {
  const response = await rollupAxiosClient.get("");
  const intents = response.data.currentCount.byteCodes;
  // console.log(`Received Intents: ${JSON.stringify(intents)}`);
  return intents;
};

const map: any = [];

(async () => {
  await init();
  // const bytecode =
  //   '0x0D125Df38bFd6eAA2478052ABB7d7E62d2CF604B_01_3131_415242_42415345_7a6b45564d_415242_3_02_415242_32303030_55534443_414e59_03_415242_30_a14481940000000000000000000000000d125df38bfd6eaa2478052abb7d7e62d2cf604b0000000000000000000000000000000000000000000000000000000000000001_9CaeFEb398C3F2601Fb09E232f0a7eB37724b361_04';
  // await execute('0x1234', bytecode);

  const interval = setInterval(async () => {
    const intents = await getAllIntents();

    const intentsToProcess = intents.filter(
      ({ programCounter, id }) => programCounter === 0 && !map[id]
    );

    for (const intent of intentsToProcess) {
      console.log(`Received Intents: ${JSON.stringify(intent)}`);
      map[intent.id] = true;
      await execute(intent.id, intent.byteCode);
    }
  }, 5000);
})();
