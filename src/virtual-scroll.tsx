import {
  ReactNode,
  useRef,
  useState,
  useLayoutEffect,
  CSSProperties,
  ComponentType,
  useCallback,
  
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
const START_LOAD_GAP = 30;
const SCROLL_SHIFT_GAP = 3;

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
  return Math.floor(value * 10) / 10;
}

function getRenderedHeight(rowBottoms: number[]) {
  const rowBottomsLn = rowBottoms.length;

  return rowBottomsLn ? Math.ceil(rowBottoms[rowBottomsLn - 1]) : 0;
}

function getRenderedTopY(rowBottoms: number[], renderRange: [number, number]) {
  return renderRange[0] > 0 ? rowBottoms[renderRange[0] - 1] : 0;
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

  const dataLength = data.length;
  const [updateCnt, setUpdateCnt] = useState(0);
  const [rootElement, setRootElement] = useState<HTMLDivElement | null>(null);
  const [containerElement, setContainerElement] =
    useState<HTMLDivElement | null>(null);
  const [rootHeight, setRootHeight] = useState(0);

  const onLoadMoreRef = useRef(props.onLoadMore);
  const rowBottomsRef = useRef<number[]>([]);
  const renderRangeRef = useRef<[number, number]>([0, 0]);

  const runUpdate = useCallback(() => setUpdateCnt(cnt => cnt + 1), []);

  useLayoutEffect(() => {
    onLoadMoreRef.current = onLoadMore;

    //If data count is changed down we suspect there are new data, new heights, and old range/heights should be reset
    if (data.length < rowBottomsRef.current.length) {
      console.log('Data validation: data length gets shorter: reset all');
      rowBottomsRef.current = [];
      renderRangeRef.current = [0, 0];
      runUpdate();
    }
  }, [data, onLoadMore, runUpdate]);

  const updateRowHeights = useCallback(() => {
    const bottoms = rowBottomsRef.current;

    const [rangeStart, rangeEnd] = renderRangeRef.current;

    const updateEnd = Math.min(rangeEnd, bottoms.length);

    const getRowHeight = (i: number) => {
      const row = containerElement!.querySelector(`[data-index="${i}"]`)!;
      return roundHeight(row.getBoundingClientRect().height);
    };

    const getRangeHeight = () => {
      const rangeTopPx = rangeStart > 0 ? bottoms[rangeStart - 1] : 0;
      const rangeBottomPx = updateEnd > 0 ? bottoms[updateEnd - 1] : rangeTopPx;
      return rangeBottomPx - rangeTopPx;
    };

    const oldRangeHeight = getRangeHeight();

    let heightsUpdated = false;

    for (let i = rangeStart; i < rangeEnd; i++) {
      const rowTop = i > 0 ? bottoms[i - 1] : 0;
      const bottom = rowTop + getRowHeight(i);
      if (i < bottoms.length) {
        heightsUpdated = heightsUpdated || bottoms[i] !== bottom;

        bottoms[i] = bottom;
      } else {
        heightsUpdated = true;

        bottoms.push(bottom);
      }
    }

    const updateDiff = getRangeHeight() - oldRangeHeight;
    if (updateDiff !== 0) {
      heightsUpdated = true;

      console.log(
        'updateRowHeights: updateDiff ',
        updateDiff,
        ' FROM ',
        rangeEnd,
        bottoms
      );

      for (let i = rangeEnd; i < bottoms.length; i++) {
        bottoms[i] = bottoms[i] + updateDiff;
      }
    }

    if (heightsUpdated) {
      console.log('updateRowHeights heights updated!');
    }
    return heightsUpdated;
  }, [containerElement]);

  useLayoutEffect(() => {
    if (!rootElement) {
      return;
    }

    let rootWidth = rootElement.clientWidth;
    let rootHeight = rootElement.clientHeight;

    console.log('Observe root size: init', rootWidth, rootHeight);
    setRootHeight(rootHeight);

    const observer = new ResizeObserver(() => {
      const newRootWidth = rootElement.clientWidth;
      const newRootHeight = rootElement.clientHeight;

      if (newRootWidth !== rootWidth) {
        console.log('Observe root size: root width changed, update row heights');

        rootWidth = newRootWidth;

        const heightsUpdated = updateRowHeights();
        if (heightsUpdated) {
          runUpdate();
        }
      }
      if (newRootHeight !== rootHeight) {
        console.log('Observe root size: root height changed, update rootHeight', newRootHeight);

        rootHeight = newRootWidth;
        setRootHeight(newRootHeight);
      }
    });
    observer.observe(rootElement);
    return () => {
      observer.unobserve(rootElement);
      observer.disconnect();
    };
  }, [rootElement, updateRowHeights, runUpdate]);

  useLayoutEffect(() => {
    console.log('Range validation: start');
    if (!rootElement) {
      console.log('Range validation: root element is null, exit');
      return;
    }

    if (updateRowHeights()) {
      console.log('Range validation: heights changed, rerender');
      runUpdate();
      return;
    }

    const renderRange = renderRangeRef.current;
    const bottoms = rowBottomsRef.current;
    const renderRangeBottom = bottoms.length ? bottoms[renderRange[1] - 1] : 0;

    const scrolledTop = Math.ceil(rootElement.scrollTop ?? 0);
    const clientHeight = Math.ceil(rootHeight ?? 0);
    const scrolledBottom = clientHeight - scrolledTop;

    //If rendered range bottom (in pixels) is near to scroll bottom
    // (we have inversed rows flow - from bottom to top. i.e. bottoms are inversed tops)
    if (renderRangeBottom - START_LOAD_GAP <= scrolledBottom && !loading) {
      console.log('Range validation: renderRange near for scroll end');
      //If there are big array of data, we render it by chunks.
      //Extend range in data array adding more chunk
      if (data.length > renderRange[1]) {
        const rangeEnd = Math.min(
          renderRange[1] + DATA_FETCH_CHUNK,
          data.length
        );
        const extendCount = rangeEnd - renderRange[1];
        if (extendCount > 0) {
          console.log(
            `Range validation: extend render range: ${renderRange[0]} - ${rangeEnd}`
          );
          renderRangeRef.current = [renderRange[0], rangeEnd];
          runUpdate();
        }
        //If there are less data than DATA_FETCH_CHUNK, emit load event, load more data
        if (extendCount < DATA_FETCH_CHUNK && onLoadMoreRef.current) {
          console.log(
            'Range validation: not enough data to extend range: load more'
          );
          onLoadMoreRef.current(data.length);
        }
      } else if (onLoadMoreRef.current) {
        console.log('Range validation: no data to extend range: load more');
        //If there are no data, load more
        onLoadMoreRef.current(data.length);
      }
    }
  }, [
    updateRowHeights,
    runUpdate,
    data,
    updateCnt,
    loading,
    rootHeight,
    rootElement
  ]);

  const onScroll = useCallback((e) => {
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
    const screenTopAtRangeTop = Math.max(0, screenRangeTop - SCROLL_SHIFT_GAP) < rangeTop;
    const screenBottomAtRangeBottom = screenRangeBottom > rangeBottom - SCROLL_SHIFT_GAP;

    if (screenTopAtRangeTop || screenBottomAtRangeBottom) {
      const newRange: [number, number] = [
        Math.max(0, screenRangeTop - overscrollRowsCount),
        Math.min(dataLength, screenRangeBottom + overscrollRowsCount)
      ];

      //edge case check (case at end of data)
      if (
        newRange[0] !== rangeTop ||
        newRange[1] !== rangeBottom ||
        scrollHeight - scrollBottom < 1
      ) {
        //if we are at end of scroll, cause re-render with current range to run
        //useLayoutEffect validating range and calling onLoad/extending range
        console.log('Scroll: set new range: ', newRange.join(' - '));
        renderRangeRef.current = newRange;
        runUpdate();
      }
    }
  }, [overscrollRowsCount, rootElement, dataLength, runUpdate]);

  const renderedHeight = getRenderedHeight(rowBottomsRef.current);

  const renderRange = renderRangeRef.current;
  //move all rendered rows with transform in scroll coordinates by top for first rendered row
  const transformY = getRenderedTopY(rowBottomsRef.current, renderRange);

  const renderRangeData = data.slice(renderRange[0], renderRange[1]);

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
          ref={setContainerElement}
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
