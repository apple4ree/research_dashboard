import type { LabelTone } from '@/components/badges/LabelChip';

export function statusTone(status: string): LabelTone {
  switch (status) {
    case 'active':      return 'success';
    case 'deprecated':  return 'neutral';
    case 'superseded':  return 'attention';
    default:            return 'neutral';
  }
}
