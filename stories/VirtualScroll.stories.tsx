import { Children, useCallback, useState } from 'react';
import { ComponentStory, ComponentMeta } from '@storybook/react';

import { getData, DataItem } from './mock-api';
import { VirtualScroll } from '../src/virtual-scroll';

interface StoryProps {
  totalDataCount: number;
  chunkSize: number;
}

export default {
  title: 'VirtualScroll',
  component: StoryContainer
} as ComponentMeta<typeof StoryContainer>;

const LOAD_CHUNK_SIZE = 100;
const TOTAL_DATA_COUNT = 100000;

function StoryContainer(props: StoryProps) {
  const { totalDataCount, chunkSize } = props;
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DataItem[]>([]);

  const onLoadMore = useCallback(async (start: number) => {
    console.log('onLoadMore', start, ' - ', start + chunkSize);
    if (start < totalDataCount) {
      setLoading(true);
      try {
        const chunk = await getData({
          offset: start,
          pageSize: chunkSize
        });
        setData(data => [...data, ...chunk]);
      } finally {
        setLoading(false);
      }
    }
  }, [totalDataCount, chunkSize]);

  const renderRow = useCallback((data: DataItem, index: number) => {
    return (
      <div
        style={{ 
          height: data.height, 
          border: '1px solid gray',
          display: 'flex',
          alignItems: 'center' 
        }}
      >
          {data.description}
      </div>
    );
  }, []);

  return (
    <VirtualScroll<DataItem> 
      data={data}
      loading={loading}
      onLoadMore={onLoadMore} 
      renderRow={renderRow}
      height={400}  
    />
  );
}

const Template = (props: StoryProps) => <StoryContainer {...props} />;

export const VirtualScrollSample: ComponentStory<typeof StoryContainer> = Template.bind({});

VirtualScrollSample.args = {
  totalDataCount: TOTAL_DATA_COUNT,
  chunkSize: LOAD_CHUNK_SIZE
};