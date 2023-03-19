import { ReactNode, useRef, useState, useLayoutEffect, useEffect, CSSProperties } from 'react';

import { LoadingOverlay } from './loading-overlay';

export interface VirtualScrollProps<T extends { key: string | number }> {
  data: T[];
  loading: boolean;
  onLoadMore?(start: number): void;
  renderRow(rowData: T, index: number): ReactNode;
  height: number | string;
}

//https://codesandbox.io/s/summer-wood-srthet?file=/index.html

const DATA_FETCH_CHUNK = 20;

function findLowerBound(arr: number[], value: number) {
  let l = 0; 
  let h = arr.length;

  while (l < h) {
    const m = (l + h) >> 1;
    if (arr[m] < value) {
      l = m + 1;
    } else {
      h = m;
    }
  }
  return l;
}

export function VirtualScroll<T extends { key: string | number }>(props: VirtualScrollProps<T>) {
  const { height, data, loading, renderRow } = props;

  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(props.onLoadMore);

  onLoadMoreRef.current = props.onLoadMore;

  const rowBottoms = useRef<number[]>([]);
 
  const [renderRange, setRenderRange] = useState([0, 0]);
  const renderRangeRef = useRef(renderRange);
  useEffect(() => {
    renderRangeRef.current = renderRange;
  }, [renderRange]);

  useLayoutEffect(() => {
    const bottoms = rowBottoms.current;

    let renderedBottom = bottoms.length > 0 ? bottoms[bottoms.length - 1] : 0;
    for (let i = bottoms.length; i < renderRange[1]; i++) {
      const row = containerRef.current?.querySelector(`[data-index="${i}"]`)!;
      const height = row.getBoundingClientRect().height;
      
      renderedBottom += height;
      bottoms.push(renderedBottom);
    }

    const renderRangeBottom = bottoms.length ? bottoms[renderRange[1] - 1] : 0;
    const scrollTop = Math.ceil(rootRef.current?.scrollTop ?? 0);
    const clientHeight = Math.ceil(rootRef.current?.clientHeight ?? 0);

    const scrolledBottom = clientHeight - scrollTop;
    if (renderRangeBottom - 10 <= scrolledBottom && !loading) {
      if (data.length > renderRange[1]) {
        const rangeEnd = Math.min(renderRange[1] + DATA_FETCH_CHUNK, data.length);
        if (rangeEnd !== renderRange[1]) {
          console.log(`Extend render range: ${renderRange[0]} - ${rangeEnd}`);
          setRenderRange([renderRange[0], rangeEnd]);
        }
        if (rangeEnd - renderRange[1] < DATA_FETCH_CHUNK && onLoadMoreRef.current) {
          onLoadMoreRef.current(data.length);
        }
      } else if (onLoadMoreRef.current) {
        onLoadMoreRef.current(data.length);
      }
    }
  }, [data, renderRange, loading]);

  useEffect(() => {
    const onScroll = () => {
      const scrollTop = -rootRef.current!.scrollTop;
      const clientHeight = rootRef.current!.clientHeight;
      const scrollBottom = scrollTop + clientHeight;

      const screenRangeTop = findLowerBound(rowBottoms.current, scrollTop);
      let screenRangeCnt = 0;
      while (rowBottoms.current[screenRangeTop + screenRangeCnt] < scrollBottom) {
        screenRangeCnt++;
      }

      setRenderRange(range => {
        //if (range[0] !== screenRangeTop) {
          return [screenRangeTop, Math.min(data.length, screenRangeTop + screenRangeCnt * 2)];
        //} else {
        //  return range;
        //}
      });
    };
    rootRef.current?.addEventListener('scroll', onScroll);
    return () => {
      rootRef.current?.removeEventListener('scroll', onScroll);
    };
  }, [data]);

  const renderedHeight = rowBottoms.current.length 
    ? Math.ceil(rowBottoms.current[rowBottoms.current.length - 1])
    : 0;

  const renderRangeData = data.slice(renderRange[0], renderRange[1]);

  const transformY = renderRange[0] < rowBottoms.current.length && renderRange[0] > 0
    ? rowBottoms.current[renderRange[0] - 1]    
    : 0;

  return (
    <div         
        style={{ 
        height,
        position: 'relative'
      } as CSSProperties }
    >
      <div 
        style={ { 
          height,
          position: 'relative',
          display: 'flex', 
          flexDirection: 'column-reverse',
          overflowY: 'scroll' 
        } as CSSProperties }

        ref={rootRef}
      >
        <div 
          style={{ 
            height: renderedHeight, 
            position: 'relative',
            flexGrow: 0,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column-reverse'
          }} 
          ref={containerRef}
        >
          {renderRangeData.map((rowData, index) => (
            <div key={rowData.key} data-index={renderRange[0] + index} 
              style={transformY ? {
                transform: `translateY(-${transformY}px)`
              }: undefined}
            >
              {renderRow(rowData, index)}
            </div>
          ))}
        </div>
      </div>
      {loading && <LoadingOverlay />  }
    </div>
  )
}