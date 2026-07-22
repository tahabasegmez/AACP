import { MmkvKeyValueStorage } from '../MmkvKeyValueStorage';

/**
 * react-native-mmkv, __mocks__/react-native-mmkv.js ile bellek-içi taklit edilir;
 * bu test adaptörün port sözleşmesine uyduğunu doğrular (get/set/delete + null davranışı).
 */
describe('MmkvKeyValueStorage', () => {
  it('set edilen değeri getString ile döner', () => {
    const storage = new MmkvKeyValueStorage('test');
    storage.set('k', 'v');
    expect(storage.getString('k')).toBe('v');
  });

  it('olmayan anahtar için null döner (undefined değil)', () => {
    const storage = new MmkvKeyValueStorage('test');
    expect(storage.getString('yok')).toBeNull();
  });

  it('delete anahtarı kaldırır', () => {
    const storage = new MmkvKeyValueStorage('test');
    storage.set('k', 'v');
    storage.delete('k');
    expect(storage.getString('k')).toBeNull();
  });
});
