import { httpsCallable } from 'firebase/functions';
import { message } from 'antd';
import { functions } from './firebase';

export async function call<T = { success: boolean }>(name: string, data: object): Promise<T> {
  // Forms include undefined optional values; omit them at the callable boundary.
  const result = await httpsCallable<object, T>(functions, name)(JSON.parse(JSON.stringify(data)));
  return result.data;
}

export function saveCatalog(collection: string, values: object, id?: string) {
  return call<{ id: string }>('saveCatalog', { collection, values, id });
}

export async function deleteCatalog(collection: string, id: string) {
  try {
    await call('deleteCatalog', { collection, id });
    message.success('Deleted successfully');
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Could not delete');
  }
}
