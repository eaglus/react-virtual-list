import { ReactNode, useRef, useState, useLayoutEffect, useEffect, CSSProperties, ComponentType } from 'react';

import { LoadingOverlayDefault } from './loading-overlay-default';

export interface VirtualScrollProps<T extends { key: string | number }> {
  data: T[];
  loading: boolean;
  onLoadMore?: (start: number) => void;
  renderRow(rowData: T, index: number): ReactNode;
  height: number | string;
  className?: string;
  loadingOverlayComponent?: ComponentType;
  overscrollRowsCount?: number;
}

const DATA_FETCH_CHUNK = 20;
const OVERSCROLL_ROWS_COUNT = 10;
const SCROLL_SHIFT_GAP = 3;
const START_LOAD_GAP = 30;

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
  const { 
    height, 
    data, 
    loading, 
    renderRow, 
    onLoadMore, 
    className, 
    loadingOverlayComponent,
    overscrollRowsCount = OVERSCROLL_ROWS_COUNT 
  } = props;

  const LoadingOverlay = loadingOverlayComponent ?? LoadingOverlayDefault;

  const [renderRange, setRenderRange] = useState([0, 0]);

  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(props.onLoadMore);
  const rowBottoms = useRef<number[]>([]);
  const renderRangeRef = useRef(renderRange);
  const dataRef = useRef(data);

  useEffect(() => {
    renderRangeRef.current = renderRange;
    dataRef.current = data;
    onLoadMoreRef.current = onLoadMore;

    //If data count is changed down we suspect there are new data, new heights, and old range/heights should be reset
    if (data.length < rowBottoms.current.length) {
      rowBottoms.current = [];
      renderRangeRef.current = [0, 0];
      setRenderRange(renderRangeRef.current);
    }
  }, [renderRange, data, onLoadMore]);

  useLayoutEffect(() => {
    const bottoms = rowBottoms.current;

    let renderedBottom = bottoms.length > 0 ? bottoms[bottoms.length - 1] : 0;

    //Cache new-rendered row bottom borders
    for (let i = bottoms.length; i < renderRange[1]; i++) {
      const row = containerRef.current?.querySelector(`[data-index="${i}"]`)!;
      const height = row.getBoundingClientRect().height;
      
      renderedBottom += height;
      bottoms.push(renderedBottom);
    }

    const renderRangeBottom = bottoms.length ? bottoms[renderRange[1] - 1] : 0;

    const scrolledTop = Math.ceil(rootRef.current?.scrollTop ?? 0);
    const clientHeight = Math.ceil(rootRef.current?.clientHeight ?? 0);
    const scrolledBottom = clientHeight - scrolledTop;

    //If rendered range bottom (in pixels) is near to scroll bottom 
    // (we have inversed rows flow - from bottom to top. i.e. bottoms are inversed tops)
    if (renderRangeBottom - START_LOAD_GAP <= scrolledBottom && !loading) {

      //If there are big array of data, we render it by chunks.
      //Extend range in data array adding more chunk
      if (data.length > renderRange[1]) {
        const rangeEnd = Math.min(renderRange[1] + DATA_FETCH_CHUNK, data.length);
        if (rangeEnd !== renderRange[1]) {
          console.log(`Extend render range: ${renderRange[0]} - ${rangeEnd}`);
          setRenderRange([renderRange[0], rangeEnd]);
        }
        //If there are less data than DATA_FETCH_CHUNK, emit load event, load more data
        if (rangeEnd - renderRange[1] < DATA_FETCH_CHUNK && onLoadMoreRef.current) {
          onLoadMoreRef.current(data.length);
        }
      } else if (onLoadMoreRef.current) { //If there are no data, load more
        onLoadMoreRef.current(data.length);
      }
    }
  }, [data, renderRange, loading]);

  useEffect(() => {
    const onScroll = () => {
      const scrollTop = -rootRef.current!.scrollTop;
      const clientHeight = rootRef.current!.clientHeight;
      const scrollBottom = scrollTop + clientHeight;
      const scrollHeight = rootRef.current!.scrollHeight;

      //Find data row index (last with bottom lower than screen scroll top/start)
      const screenRangeTop = findLowerBound(rowBottoms.current, scrollTop);
      let screenRangeCnt = 0;
      while (rowBottoms.current[screenRangeTop + screenRangeCnt] < scrollBottom) {
        screenRangeCnt++;
      }

      //Last row on screen
      const screenRangeBottom = screenRangeTop + screenRangeCnt;

      const [rangeTop, rangeBottom] = renderRangeRef.current;

      //If current rendered range run out of screen range (scrolled to empty, non-rendered scroll space)
      //move range to screen start (in row index units), end extend it with overscrollRowsCount 
      if (screenRangeTop < rangeTop || (screenRangeBottom > rangeBottom - SCROLL_SHIFT_GAP)) {
        const newRange = [
          Math.max(0, screenRangeTop - overscrollRowsCount),
          Math.min(dataRef.current.length, screenRangeBottom + overscrollRowsCount)
        ];

        //edge case check (case at end of data)
        if (newRange[0] !== rangeTop || newRange[1] !== rangeBottom) {
          console.log('set new range: ', newRange.join(' - '));
          setRenderRange(newRange);
        }
      } else if (Math.floor(scrollBottom) === Math.floor(scrollHeight)) {
        //if we are at end of scroll, cause re-render with current range to run
        //useLayoutEffect validating range and calling onLoad/extending range 
        setRenderRange([rangeTop, rangeBottom]);
      }
    };
    rootRef.current?.addEventListener('scroll', onScroll);
    return () => {
      rootRef.current?.removeEventListener('scroll', onScroll);
    };
  }, [data, overscrollRowsCount]);

  const renderedHeight = rowBottoms.current.length 
    ? Math.ceil(rowBottoms.current[rowBottoms.current.length - 1])
    : 0;

  const renderRangeData = data.slice(renderRange[0], renderRange[1]);

  //move all rendered rows with transform in scroll coordinates by top for first rendered row
  const transformY = renderRange[0] < rowBottoms.current.length && renderRange[0] > 0
    ? rowBottoms.current[renderRange[0] - 1]    
    : 0;

  return (
    <div         
      style={{ 
        height,
        position: 'relative'
      } as CSSProperties }
      className={className}
    >
      <div 
        style={ { 
          height,
          position: 'relative',
          display: 'flex', 
          flexDirection: 'column-reverse',//achieve reverse row order
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
            flexDirection: 'column-reverse'//achieve reverse row order
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
  );
}