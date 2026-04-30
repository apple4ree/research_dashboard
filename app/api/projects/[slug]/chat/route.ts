import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentUserLogin } from '@/lib/session';
import { loadProjectChatContext, renderSystemPrompt } from '@/lib/chat/project-context';
import { TOOL_SCHEMAS, executeTool } from '@/lib/chat/tools';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type IncomingMessage = { role: 'user' | 'assistant'; content: string };

const LITELLM_BASE = process.env.LITELLM_BASE_URL || 'http://127.0.0.1:4001';
const LITELLM_KEY = process.env.LITELLM_MASTER_KEY || 'sk-local-only';
const MAX_HISTORY = 16;
const MAX_TOOL_ITERATIONS = 5;

type ToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

type AssistantMessage = {
  role: 'assistant';
  content: string | null;
  tool_calls?: ToolCall[];
};

type ToolMessage = {
  role: 'tool';
  tool_call_id: string;
  name: string;
  content: string;
};

type LitellmMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string }
  | AssistantMessage
  | ToolMessage;

type LitellmChoice = {
  finish_reason?: string;
  message: AssistantMessage;
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  let login: string;
  try {
    login = await getCurrentUserLogin();
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { slug } = await ctx.params;

  const body = (await req.json().catch(() => null)) as { messages?: IncomingMessage[] } | null;
  if (!body || !Array.isArray(body.messages)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const projectCtx = await loadProjectChatContext(slug);
  if (!projectCtx) {
    return NextResponse.json({ error: 'project_not_found' }, { status: 404 });
  }

  const history = body.messages
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_HISTORY)
    .map(m => ({ role: m.role, content: m.content }) as LitellmMessage);

  const messages: LitellmMessage[] = [
    { role: 'system', content: renderSystemPrompt(projectCtx) },
    { role: 'system', content: `current member viewing the chat: ${login}` },
    ...history,
  ];

  let finalText: string | null = null;
  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    let res: Response;
    try {
      res = await fetch(`${LITELLM_BASE}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${LITELLM_KEY}`,
        },
        body: JSON.stringify({
          model: 'chatbot',
          messages,
          tools: TOOL_SCHEMAS,
          tool_choice: 'auto',
          stream: false,
        }),
      });
    } catch (err) {
      console.error('[chat] litellm proxy unreachable', err);
      return NextResponse.json(
        { error: 'litellm_unreachable', hint: `Start the litellm proxy on ${LITELLM_BASE}.` },
        { status: 502 },
      );
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[chat] litellm error', res.status, text);
      return NextResponse.json(
        { error: 'litellm_error', status: res.status, hint: text.slice(0, 400) },
        { status: 502 },
      );
    }

    const data = (await res.json()) as { choices?: LitellmChoice[] };
    const choice = data.choices?.[0];
    if (!choice) {
      return NextResponse.json({ error: 'no_choice' }, { status: 502 });
    }

    const toolCalls = choice.message.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      messages.push({
        role: 'assistant',
        content: choice.message.content ?? '',
        tool_calls: toolCalls,
      });

      for (const tc of toolCalls) {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(tc.function.arguments || '{}');
        } catch {
          parsedArgs = {};
        }
        let result: unknown;
        try {
          result = await executeTool(slug, tc.function.name, parsedArgs);
        } catch (err) {
          result = { error: err instanceof Error ? err.message : String(err) };
        }
        const serialized = typeof result === 'string' ? result : JSON.stringify(result);
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          name: tc.function.name,
          content: serialized.length > 60_000 ? serialized.slice(0, 60_000) + '\n…[truncated]' : serialized,
        });
        console.log(`[chat] tool ${tc.function.name}(${tc.function.arguments}) → ${serialized.length}b`);
      }
      continue;
    }

    finalText = choice.message.content ?? '';
    break;
  }

  if (finalText === null) {
    return NextResponse.json(
      { error: 'too_many_tool_iterations', hint: `model exceeded ${MAX_TOOL_ITERATIONS} tool iterations` },
      { status: 502 },
    );
  }

  return new Response(synthStream(finalText), {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store, no-transform',
      'content-encoding': 'identity',
      'x-accel-buffering': 'no',
    },
  });
}

function synthStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const tokens = text.match(/\S+\s*|\s+/g) ?? [text];
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (const t of tokens) {
          controller.enqueue(encoder.encode(t));
          await new Promise(resolve => setTimeout(resolve, 15));
        }
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });
}
