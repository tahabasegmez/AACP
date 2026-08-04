import React from 'react';
import { act, create } from 'react-test-renderer';
import { ScrollableToOffset, useScrollToTopOnChange } from '../useScrollToTopOnChange';

/** Sarma çağrılarını kaydeden sahte liste. */
const makeList = (): ScrollableToOffset & { calls: { offset: number }[] } => {
  const calls: { offset: number }[] = [];
  return { calls, scrollToOffset: params => calls.push(params) };
};

/**
 * Hook'u çalıştıran en küçük bileşen.
 *
 * Ref, gerçek listeye bağlanır gibi elle atanır; hook'un tek işi doğru anda
 * `scrollToOffset` çağırmaktır.
 */
const Harness: React.FC<{
  value: unknown;
  list: ScrollableToOffset;
}> = ({ value, list }) => {
  const ref = useScrollToTopOnChange<ScrollableToOffset>(value);
  ref.current = list;
  return null;
};

describe('useScrollToTopOnChange', () => {
  it('ilk render’da sarmaz — liste zaten baştadır', () => {
    const list = makeList();
    act(() => {
      create(<Harness value="" list={list} />);
    });

    expect(list.calls).toHaveLength(0);
  });

  it('değer değişince listeyi başa sarar', () => {
    const list = makeList();
    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(<Harness value="" list={list} />);
    });

    act(() => {
      tree.update(<Harness value="deprem" list={list} />);
    });

    expect(list.calls).toEqual([{ offset: 0, animated: false }]);
  });

  it('aynı değerle yeniden render sarmaz', () => {
    // Her render’da başa sarmak, kullanıcı kaydırırken listeyi geri çekerdi.
    const list = makeList();
    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(<Harness value="deprem" list={list} />);
    });

    act(() => {
      tree.update(<Harness value="deprem" list={list} />);
    });

    expect(list.calls).toHaveLength(0);
  });

  it('arama temizlenince de sarar', () => {
    // Asıl bildirilen sorun: kutu temizlenince liste aşağı sıçrıyordu.
    const list = makeList();
    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(<Harness value="deprem" list={list} />);
    });

    act(() => {
      tree.update(<Harness value="" list={list} />);
    });

    expect(list.calls).toEqual([{ offset: 0, animated: false }]);
  });
});
