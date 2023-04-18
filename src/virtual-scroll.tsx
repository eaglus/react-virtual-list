import {
  ReactNode,
  useRef,
  useState,
  useLayoutEffect,
  CSSProperties,
  ComponentType,
  useCallback
} from 'react';

import { LoadingOverlayDefault } from './loading-overlay-default';

export interface VirtualScrollProps<T extends { key: string | number }> {
  data: T[];
  loading: boolean;
  onLoadMore?: (start: number) => void;
  renderRow(rowData: T, index: number): ReactNode;
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

function roundHeight(value: number) {
  return Math.floor(value);
}

function getRenderedHeight(rowBottoms: number[]) {
  const rowBottomsLn = rowBottoms.length;

  return rowBottomsLn
    ? Math.ceil(rowBottoms[rowBottomsLn - 1])
    : 0;
}

function getRenderedTopY(rowBottoms: number[], renderRange: number[]) {
  const rowBottomsLn = rowBottoms.length;

  return renderRange[0] < rowBottomsLn && renderRange[0] > 0
    ? rowBottoms[renderRange[0] - 1]
    : 0;
}

export function VirtualScroll<T extends { key: string | number }>(
  props: VirtualScrollProps<T>
) {
  const {
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
  const [rootElement, setRootElement] = useState<HTMLDivElement | null>(null);
  const [rootHeight, setRootHeight] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(props.onLoadMore);
  const rowBottomsRef = useRef<number[]>([]);
  const renderRangeRef = useRef(renderRange);
  const dataRef = useRef(data);

  const getRowHeight = useCallback((i: number) => {
    const row = containerRef.current!.querySelector(`[data-index="${i}"]`)!;
    return roundHeight(row.getBoundingClientRect().height);
  }, []);

  const updateRowHeights = useCallback(() => {
    let bottoms = rowBottomsRef.current;

    let updateDiff = 0;
    const [rangeStart, rangeEnd] = renderRangeRef.current;

    const updateEnd = Math.min(rangeEnd, bottoms.length);
    for (let i = updateEnd - 1; i >= rangeStart; i--) {
      const newHeight = getRowHeight(i);
      const oldHeight = i > 0 ? bottoms[i] - bottoms[i - 1] : bottoms[i];
      const diff = roundHeight(newHeight - oldHeight);
      if (diff !== 0) {
        console.log('DIFF', i, ' => ', diff, oldHeight, '=>', newHeight);
      }
      updateDiff += diff;
      bottoms[i] += diff;
    }

    for (let i = bottoms.length; i < rangeEnd; i++) {
      const rowTop = i > 0 ? bottoms[i - 1] : 0;
      const bottom = rowTop + getRowHeight(i);
      bottoms.push(bottom);
    }

    if (updateDiff !== 0) {
      console.log('UPDATE WIDTH ', updateDiff, ' FROM ', rangeEnd, bottoms);
      for (let i = rangeEnd; i < bottoms.length; i++) {
        bottoms[i] = bottoms[i] + updateDiff;
      }
    }
  }, [getRowHeight]);

  useLayoutEffect(() => {
    if (!rootElement) {
      return;
    }

    let rootWidth = rootElement.clientWidth;
    let rootHeight = rootElement.clientHeight;

    setRootHeight(rootHeight);

    const observer = new ResizeObserver(() => {
      const newRootWidth = rootElement.clientWidth;
      const newRootHeight = rootElement.clientHeight;

      if (newRootWidth !== rootWidth) {
        if (rootWidth !== undefined) {
          console.log('Root width changed, update row heights');
          updateRowHeights();
        }
        rootWidth = newRootWidth;
      }
      if (newRootHeight !== rootHeight) {
        rootHeight = newRootWidth;
        setRootHeight(newRootHeight);
      }
    });
    observer.observe(rootElement);
    return () => {
      observer.unobserve(rootElement);
      observer.disconnect();
    };
  }, [rootElement, updateRowHeights]);

  useLayoutEffect(() => {
    renderRangeRef.current = renderRange;
    dataRef.current = data;
    onLoadMoreRef.current = onLoadMore;

    //If data count is changed down we suspect there are new data, new heights, and old range/heights should be reset
    if (data.length < rowBottomsRef.current.length) {
      rowBottomsRef.current = [];
      renderRangeRef.current = [0, 0];
      setRenderRange(renderRangeRef.current);
    }
  }, [renderRange, data, onLoadMore]);

  useLayoutEffect(() => {
    if (!rootElement) {
      return;
    }

    updateRowHeights();

    const bottoms = rowBottomsRef.current;
    const renderRangeBottom = bottoms.length ? bottoms[renderRange[1] - 1] : 0;

    const scrolledTop = Math.ceil(rootElement.scrollTop ?? 0);
    const clientHeight = Math.ceil(rootHeight ?? 0);
    const scrolledBottom = clientHeight - scrolledTop;

    //If rendered range bottom (in pixels) is near to scroll bottom
    // (we have inversed rows flow - from bottom to top. i.e. bottoms are inversed tops)
    if (renderRangeBottom - START_LOAD_GAP <= scrolledBottom && !loading) {
      //If there are big array of data, we render it by chunks.
      //Extend range in data array adding more chunk
      if (data.length > renderRange[1]) {
        const rangeEnd = Math.min(
          renderRange[1] + DATA_FETCH_CHUNK,
          data.length
        );
        if (rangeEnd !== renderRange[1]) {
          console.log(`Extend render range: ${renderRange[0]} - ${rangeEnd}`);
          setRenderRange([renderRange[0], rangeEnd]);
        }
        //If there are less data than DATA_FETCH_CHUNK, emit load event, load more data
        if (
          rangeEnd - renderRange[1] < DATA_FETCH_CHUNK &&
          onLoadMoreRef.current
        ) {
          onLoadMoreRef.current(data.length);
        }
      } else if (onLoadMoreRef.current) {
        //If there are no data, load more
        onLoadMoreRef.current(data.length);
      }
    }
  }, [getRowHeight, updateRowHeights, data, renderRange, loading, rootHeight, rootElement]);

  const onScroll = useCallback(() => {
    if (!rootElement) {
      return;
    }

    const scrollTop = -rootElement.scrollTop;
    const clientHeight = rootElement.clientHeight;
    const scrollBottom = scrollTop + clientHeight;
    const scrollHeight = rootElement.scrollHeight;

    //Find data row index (last with bottom lower than screen scroll top/start)
    const screenRangeTop = findLowerBound(rowBottomsRef.current, scrollTop);
    let screenRangeCnt = 0;
    while (
      rowBottomsRef.current[screenRangeTop + screenRangeCnt] < scrollBottom
    ) {
      screenRangeCnt++;
    }

    //Last row on screen
    const screenRangeBottom = screenRangeTop + screenRangeCnt;
    
    const [rangeTop, rangeBottom] = renderRangeRef.current;

    //If current rendered range run out of screen range (scrolled to empty, non-rendered scroll space)
    //move range to screen start (in row index units), end extend it with overscrollRowsCount
    if (
      screenRangeTop < rangeTop ||
      screenRangeBottom > rangeBottom - SCROLL_SHIFT_GAP
    ) {
      const newRange = [
        Math.max(0, screenRangeTop - overscrollRowsCount),
        Math.min(
          dataRef.current.length,
          screenRangeBottom + overscrollRowsCount
        )
      ];

      //edge case check (case at end of data)
      if (
        newRange[0] !== rangeTop ||
        newRange[1] !== rangeBottom ||
        scrollHeight - scrollBottom < 1
      ) {
        //if we are at end of scroll, cause re-render with current range to run
        //useLayoutEffect validating range and calling onLoad/extending range
        console.log('set new range: ', newRange.join(' - '));
        setRenderRange(newRange);
      }
    }
  }, [overscrollRowsCount, rootElement]);

  const renderedHeight = getRenderedHeight(rowBottomsRef.current);

  //move all rendered rows with transform in scroll coordinates by top for first rendered row
  const transformY = getRenderedTopY(rowBottomsRef.current, renderRange);

  const renderRangeData = data.slice(renderRange[0], renderRange[1])

  return (
    <div className={className}>
      <div
        style={
          {
            height: '100%',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column-reverse', //achieve reverse row order
            overflowY: 'scroll'
          } as CSSProperties
        }
        onScroll={onScroll}
        ref={setRootElement}
      >
        <div
          style={{
            height: renderedHeight,
            position: 'relative',
            flexGrow: 0,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column-reverse' //achieve reverse row order
          }}
          ref={containerRef}
        >
          {renderRangeData.map((rowData, index) => (
            <div
              key={rowData.key}
              data-index={renderRange[0] + index}
              style={
                transformY
                  ? {
                      transform: `translateY(-${transformY}px)`
                    }
                  : undefined
              }
            >
              {renderRow(rowData, index)}
            </div>
          ))}
        </div>
      </div>
      {loading && <LoadingOverlay />}
    </div>
  );
}
