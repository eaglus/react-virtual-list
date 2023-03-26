import { useCallback, useState } from 'react';
import { ComponentStory, ComponentMeta } from '@storybook/react';

import { getData, DataItem } from './mock-api';
import { Root, Row, VirtualScroll, GlobalStyle } from './styles'; 

interface StoryProps {
  totalDataCount: number;
  loadChunkSize: number;
  overscrollRowsCount: number;
  onLoadMore: (start: number) => void;
}

const LOAD_CHUNK_SIZE = 100;
const TOTAL_DATA_COUNT = 100000;

export default {
  title: 'VirtualScroll',
  component: StoryContainer,
  argTypes: {
    onLoadMore: { action: 'onLoadMore' },
    totalDataCount: { control: { type: 'number', min: 0, max: TOTAL_DATA_COUNT, step: 10 } },
    loadChunkSize: { control: { type: 'number', min: 1, step: 10 } },
    overscrollRowsCount: { control: { type: 'number', min: 1 } },
  }
} as ComponentMeta<typeof StoryContainer>;

function StoryContainer(props: StoryProps) {
  const { totalDataCount, loadChunkSize, onLoadMore: onLoadMoreProp } = props;
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DataItem[]>([]);

  const onLoadMore = useCallback(async (start: number) => {
    console.log('onLoadMore', start, ' - ', start + loadChunkSize);
    if (start < totalDataCount) {
      onLoadMoreProp?.(start);
      setLoading(true);
      try {
        const chunk = await getData({
          offset: start,
          pageSize: loadChunkSize
        });
        setData(data => [...data, ...chunk]);
      } finally {
        setLoading(false);
      }
    }
  }, [totalDataCount, loadChunkSize, onLoadMoreProp]);

  const renderRow = useCallback((data: DataItem) => {
    return (
      <Row
        style={{ 
          minHeight: data.height, 
        }}
      >
        {data.description}
      </Row>
    );
  }, []);

  const onClearClick = useCallback(() => {
    setData([]);
  }, []);

  return (
    <>
      <GlobalStyle />
      <Root>
        <VirtualScroll 
          data={data}
          loading={loading}
          onLoadMore={onLoadMore} 
          renderRow={renderRow}
        />

        <button onClick={onClearClick}>Clear data</button>
      </Root>
    </>
  );
}

const Template = (props: StoryProps) => <StoryContainer {...props} />;

export const VirtualScrollSample: ComponentStory<typeof StoryContainer> = Template.bind({});

VirtualScrollSample.args = {
  totalDataCount: TOTAL_DATA_COUNT,
  loadChunkSize: LOAD_CHUNK_SIZE,
  overscrollRowsCount: 10
}; 