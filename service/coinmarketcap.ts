import axios, { Axios } from 'axios';
import { COINMARKETCAP_API_KEY } from '../config/config';

const axiosClient = new Axios({
  ...axios.defaults,
  baseURL: 'https://pro-api.coinmarketcap.com',
  headers: {
    'X-CMC_PRO_API_KEY': COINMARKETCAP_API_KEY,
  },
});

const cache = new Map<string, number>();

export const getTokenPrice = async (tokenSymbol: string): Promise<number> => {
  if (cache.has(tokenSymbol)) {
    return cache.get(tokenSymbol)!;
  }
  const response = await axiosClient.get('/v2/tools/price-conversion', {
    params: {
      symbol: tokenSymbol,
      amount: 1,
    },
  });
  const price = parseFloat(response.data.data[0].quote.USD.price);
  console.log('price', tokenSymbol, price);
  cache.set(tokenSymbol, price);
  return price;
};
