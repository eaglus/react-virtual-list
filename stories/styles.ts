import styled, { createGlobalStyle } from 'styled-components';

import { VirtualScroll as VirtualScrollUnstyled } from '../src/virtual-scroll';

export const GlobalStyle = createGlobalStyle`
  body, html, #root {
    height: 100%;
  } 
`

export const Root = styled.div`
  display: flex;
  flex-direction: column;
  position: relative;
  gap: 20px;
  height: 100%;
`;

export const Row = styled.div`
  padding: 8px;
  border: 1px solid gray;
  display: flex;
  align-items: center; 
`;

export const VirtualScroll = styled(VirtualScrollUnstyled)`
  flex-grow: 1;
  flex-shrink: 0;
  flex-basis: 0;
  height: 0%;
`;
