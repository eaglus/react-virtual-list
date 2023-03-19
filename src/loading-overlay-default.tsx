export function LoadingOverlayDefault() {
  return (
    <div 
      style={{
        position: 'absolute',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
      }}
    >
      <div 
        style={{
          position: 'absolute',
          backgroundColor: 'black',
          opacity: 0.2,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0
        }}
      />
      <div style={{}}>
        Loading...
      </div>
    </div>
  );
}