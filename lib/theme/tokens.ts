export const colors = {
  canvas: {
    default: '#ffffff',
    subtle: '#f6f8fa',
    inset: '#eaeef2',
  },
  fg: {
    default: '#1f2328',
    muted: '#656d76',
    subtle: '#6e7781',
    onEmphasis: '#ffffff',
  },
  border: {
    default: '#d0d7de',
    muted: '#d8dee4',
  },
  accent: { fg: '#0969da', emphasis: '#0969da', subtle: '#ddf4ff' },
  success: { fg: '#1a7f37', emphasis: '#1f883d', subtle: '#dafbe1' },
  danger:  { fg: '#cf222e', emphasis: '#cf222e', subtle: '#ffebe9' },
  attention: { fg: '#9a6700', emphasis: '#bf8700', subtle: '#fff8c5' },
  done:    { fg: '#8250df', emphasis: '#8250df', subtle: '#fbefff' },
  neutral: { emphasis: '#6e7781', subtle: '#eaeef2' },
} as const;
