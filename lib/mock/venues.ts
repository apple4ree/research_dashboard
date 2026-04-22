import type { Venue } from '@/lib/types';

export const venues: Venue[] = [
  { id: 'v-neurips-26-abs', name: 'NeurIPS 2026', deadline: '2026-05-04T23:59:00Z', kind: 'abstract' },
  { id: 'v-neurips-26-full', name: 'NeurIPS 2026', deadline: '2026-05-11T23:59:00Z', kind: 'full' },
  { id: 'v-icml-26-cr', name: 'ICML 2026', deadline: '2026-05-13T23:59:00Z', kind: 'camera_ready' },
  { id: 'v-acl-26-rb', name: 'ACL 2026', deadline: '2026-05-20T23:59:00Z', kind: 'rebuttal' },
  { id: 'v-emnlp-26', name: 'EMNLP 2026', deadline: '2026-06-15T23:59:00Z', kind: 'full' },
  { id: 'v-colm-26', name: 'COLM 2026', deadline: '2026-07-01T23:59:00Z', kind: 'full' },
  { id: 'v-iclr-27', name: 'ICLR 2027', deadline: '2026-09-28T23:59:00Z', kind: 'full' },
];
