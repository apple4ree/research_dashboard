import type { RunStatus, ExperimentEventAction } from './types';

/** Map an ExperimentRun status to the appropriate event action. */
export function runStatusToEventAction(status: RunStatus): ExperimentEventAction {
  switch (status) {
    case 'success': return 'succeeded';
    case 'failure': return 'failed';
    case 'cancelled': return 'cancelled';
    case 'in_progress':
    case 'queued':
    default:
      return 'started';
  }
}
