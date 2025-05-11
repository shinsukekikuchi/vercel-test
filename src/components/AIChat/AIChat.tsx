import React, { useState, useRef, useEffect, FormEvent, KeyboardEvent } from 'react';
import { streamChatMessage, DifyMessage, DifyStreamChunk } from 'services/difyService';
import './AIChat.css'; // We'll create this for basic styling

interface Message extends DifyMessage {
  id: string;
  isLoading?: boolean; // To show loading indicator for assistant's streaming message
}

const AIChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: String(Date.now()),
      role: 'assistant',
      content: 'Hello! Need advice on options trading? What kind of trades are you interested in?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e?: FormEvent) => {
    e?.preventDefault();
    if (input.trim() === '' || isLoading) return;

    const userInput: Message = {
      id: String(Date.now()),
      role: 'user',
      content: input.trim(),
    };
    setMessages((prev) => [...prev, userInput]);
    setInput('');
    setIsLoading(true);

    // Prepare for streaming assistant message
    const assistantMessageId = String(Date.now() + 1);
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMessageId,
        role: 'assistant',
        content: '', // Start with empty content
        isLoading: true,
      },
    ]);

    abortControllerRef.current = new AbortController();

    try {
      let currentContent = '';
      const stream = streamChatMessage(
        userInput.content,
        conversationId,
        abortControllerRef.current
      );

      for await (const chunk of stream) {
        if (abortControllerRef.current?.signal.aborted) {
          console.log('Stream aborted by client');
          break;
        }

        if (chunk.event === 'agent_message' || chunk.event === 'message') {
          currentContent += chunk.answer || '';
          setMessages((prevMessages) =>
            prevMessages.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: currentContent, isLoading: true }
                : msg
            )
          );
        } else if (chunk.event === 'agent_message_end' || chunk.event === 'message_end') {
          setConversationId(chunk.conversation_id);
          setMessages((prevMessages) =>
            prevMessages.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: currentContent, isLoading: false, id: chunk.id || assistantMessageId } // Update ID if available from Dify
                : msg
            )
          );
          break; // End of stream for this message
        } else if (chunk.event === 'error') {
          console.error('Streaming Error:', chunk.data);
          setMessages((prevMessages) =>
            prevMessages.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: `Error: ${chunk.data?.message || 'Unknown error'}`, isLoading: false }
                : msg
            )
          );
          break;
        }
      }
    } catch (error: any) {
      console.error('Failed to send message:', error);
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: `Error: ${error.message || 'Failed to get response'}`, isLoading: false }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === assistantMessageId ? { ...msg, isLoading: false } : msg
        )
      );
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  return (
    <div className="ai-chat-container">
      <div className="ai-chat-messages">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`ai-chat-message ${message.role} ${message.isLoading ? 'loading' : ''
              }`}
          >
            <div className="ai-chat-message-avatar">
              {message.role === 'assistant' ? 'AI' : 'You'}
            </div>
            <div className="ai-chat-message-content">
              {message.content}
              {message.isLoading && message.role === 'assistant' && (
                <div className="loading-dots">
                  <span>.</span><span>.</span><span>.</span>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSend} className="ai-chat-input-form">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about options trading..."
          rows={2}
          disabled={isLoading}
        />
        <button type="submit" disabled={input.trim() === '' || isLoading}>
          Send
        </button>
        {isLoading && (
          <button type="button" onClick={handleStopStreaming} className="stop-button">
            Stop
          </button>
        )}
      </form>
      <p className="ai-chat-disclaimer">
        AI responses are for informational purposes only. Always do your own research.
      </p>
    </div>
  );
};

export default AIChat;
