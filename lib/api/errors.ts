import { NextResponse } from 'next/server';

export type ApiErrorCode =
  | 'missing_token'
  | 'invalid_token'
  | 'expired_token'
  | 'unknown_member'
  | 'invalid_request'
  | 'project_not_found'
  | 'run_not_found'
  | 'entry_not_found'
  | 'milestone_not_found'
  | 'todo_not_found'
  | 'event_already_exists'
  | 'flow_event_not_found'
  | 'entity_not_found'
  | 'github_verify_failed';

export function apiError(status: number, code: ApiErrorCode, hint?: string) {
  const body: { error: ApiErrorCode; hint?: string } = { error: code };
  if (hint) body.hint = hint;
  return NextResponse.json(body, { status });
}
