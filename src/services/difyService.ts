export type DifyMessageRole = "user" | "assistant";

export interface DifyMessage {
  role: DifyMessageRole;
  content: string;
}

export interface DifyApiResponse {
  answer: string;
  conversation_id: string;
  created_at: number;
  id: string;
  // Potentially other fields based on Dify's response
}

export interface DifyStreamChunk {
  event: string; // e.g., 'message', 'agent_message', 'agent_thought', 'error', 'ping'
  id?: string;
  task_id?: string;
  answer?: string;
  conversation_id?: string;
  created_at?: number;
  data?: any; // Could be an error object or other data
}

const DIFY_API_URL = import.meta.env.VITE_DIFY_API_URL;
const DIFY_API_KEY = import.meta.env.VITE_DIFY_API_KEY;

if (!DIFY_API_URL || !DIFY_API_KEY) {
  console.error(
    'Dify API URL or Key is not defined. Please check your .env file for VITE_DIFY_API_URL and VITE_DIFY_API_KEY.'
  );
}

export async function sendChatMessage(
  message: string,
  conversationId?: string
): Promise<DifyApiResponse> {
  const endpoint = `${DIFY_API_URL}/chat-messages`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DIFY_API_KEY}`,
    },
    body: JSON.stringify({
      inputs: {},
      query: message,
      response_mode: 'blocking', // For non-streaming
      conversation_id: conversationId,
      user: 'funoption-user', // Or a dynamic user ID
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Dify API error:', errorData);
    throw new Error(`API error: ${errorData.error?.message || errorData.message || response.statusText}`);
  }

  return response.json();
}

export async function* streamChatMessage(
  message: string,
  conversationId?: string,
  abortController?: AbortController
): AsyncGenerator<DifyStreamChunk, void, unknown> {
  const endpoint = `${DIFY_API_URL}/chat-messages`; // Endpoint for streaming is also /chat-messages, but response_mode changes

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DIFY_API_KEY}`,
    },
    body: JSON.stringify({
      inputs: {},
      query: message,
      response_mode: 'streaming',
      conversation_id: conversationId,
      user: 'funoption-user',
      // stream_tool_calls: true, // If you need tool call streaming
    }),
    signal: abortController?.signal,
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Dify API streaming error:', errorData);
    throw new Error(`API error: ${errorData.error?.message || errorData.message || response.statusText}`);
  }

  if (!response.body) {
    throw new Error('Response body is null for streaming.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep the last partial line in buffer

      for (const line of lines) {
        if (line.trim() === '' || !line.startsWith('data:')) continue;

        const jsonData = line.substring(5).trim(); // Remove 'data: '
        if (jsonData === '[DONE]') { // Dify specific end-of-stream marker for some cases
          return;
        }
        
        try {
          const parsedChunk: DifyStreamChunk = JSON.parse(jsonData);
          yield parsedChunk;
          // For Dify, the 'done' event might be signaled by an event type rather than [DONE]
          if (parsedChunk.event === 'agent_message_end' || parsedChunk.event === 'message_end') {
             // console.log('Stream ended with event:', parsedChunk.event);
             // return; // No need to return here, let the stream close naturally or via abort
          }
        } catch (e) {
          console.error('Error parsing SSE data chunk:', jsonData, e);
          // yield { event: 'error', data: { message: 'Error parsing stream data' } };
        }
      }
    }
  } catch (error: any) { // Cast error to any to access properties like name
    if (error.name === 'AbortError') {
      console.log('Stream reading aborted');
      return;
    }
    console.error('Error reading stream:', error);
    throw error;
  } finally {
    reader.releaseLock();
  }
}
