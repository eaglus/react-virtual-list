export interface GetDataParams {
  offset: number;
  pageSize: number;
}

export interface DataItem {
  key: number;
  description: string;
  height: number;
}

const TIMEOUT = 1500;

function delay<T>(value: T) {
  return new Promise<T>(resolve => {
    setTimeout(() => resolve(value), TIMEOUT);
  });
}

export function getData(params: GetDataParams) {
  const textToWrap = ' --- some text to wrap --- long text to wrap --- ';
  return delay(params).then(({ offset, pageSize }) => {
    const result: DataItem[] = Array(pageSize).fill(0).map((_, index) => {
      const key = offset + index;
      return {
        key,
        description: 'Data item ' + key + textToWrap + textToWrap + textToWrap,
        height: Math.floor(Math.random() * 20) + 20
      };
    });
    return result;
  });
}