import { useRef, useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import { Message } from '@/types/chat';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import ReactMarkdown from 'react-markdown';
import LoadingDots from '@/components/ui/LoadingDots';
import Link from 'next/link';
import { createSupabaseClient } from '@/utils/supabase-auth';

interface Site {
  id: string;
  name: string;
  base_url: string;
  status: 'idle' | 'training' | 'ready' | 'error';
}

export default function SiteChat() {
  const router = useRouter();
  const { siteId } = router.query;
  const [site, setSite] = useState<Site | null>(null);
  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [messageState, setMessageState] = useState<{
    messages: Message[];
    pending?: string;
    history: [string, string][];
  }>({
    messages: [],
    history: [],
  });

  const { messages, pending, history } = messageState;
  const messageListRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const supabase = createSupabaseClient();

  // 認証チェック
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/auth/login');
        return;
      }

      setAuthLoading(false);
    };

    checkAuth();
  }, [router, supabase]);

  // サイト情報を取得
  useEffect(() => {
    if (!siteId || typeof siteId !== 'string' || authLoading) return;
    
    const fetchSite = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      try {
        const response = await fetch('/api/sites', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            router.push('/auth/login');
            return;
          }
          throw new Error('Failed to fetch sites');
        }

        const sites: Site[] = await response.json();
        const found = sites.find((s) => s.id === siteId);
        
        if (found) {
          setSite(found);
          if (found.status !== 'ready') {
            setMessageState({
              messages: [
                {
                  message: `「${found.name}」の学習が完了していません。ステータス: ${found.status}`,
                  type: 'apiMessage',
                },
              ],
              history: [],
            });
          } else {
            setMessageState({
              messages: [
                {
                  message: `「${found.name}」について何かお聞きしたいことはありますか？`,
                  type: 'apiMessage',
                },
              ],
              history: [],
            });
          }
        } else {
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('Error fetching site:', error);
        router.push('/dashboard');
      }
    };

    fetchSite();
  }, [siteId, router, authLoading, supabase]);

  useEffect(() => {
    textAreaRef.current?.focus();
  }, []);

  useEffect(() => {
    messageListRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending]);

  // フォーム送信
  async function handleSubmit(e: any) {
    e.preventDefault();

    if (!query || !siteId || typeof siteId !== 'string') {
      alert('質問を入力してください');
      return;
    }

    if (site?.status !== 'ready') {
      alert('サイトの学習が完了していません');
      return;
    }

    const question = query.trim();

    setMessageState((state) => ({
      ...state,
      messages: [
        ...state.messages,
        {
          type: 'userMessage',
          message: question,
        },
      ],
      pending: undefined,
    }));

    setLoading(true);
    setQuery('');
    setMessageState((state) => ({ ...state, pending: '' }));

    const ctrl = new AbortController();

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/auth/login');
        return;
      }

      fetchEventSource('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          question,
          history,
          site_id: siteId,
        }),
        signal: ctrl.signal,
        onmessage: (event) => {
          if (event.data === '[DONE]') {
            setMessageState((state) => ({
              history: [...state.history, [question, state.pending ?? '']],
              messages: [
                ...state.messages,
                {
                  type: 'apiMessage',
                  message: state.pending ?? '',
                },
              ],
              pending: undefined,
            }));
            setLoading(false);
            ctrl.abort();
          } else {
            const data = JSON.parse(event.data);
            if (data.error) {
              setMessageState((state) => ({
                ...state,
                messages: [
                  ...state.messages,
                  {
                    type: 'apiMessage',
                    message: `エラー: ${data.error}`,
                  },
                ],
                pending: undefined,
              }));
              setLoading(false);
              ctrl.abort();
            } else {
              setMessageState((state) => ({
                ...state,
                pending: (state.pending ?? '') + data.data,
              }));
            }
          }
        },
      });
    } catch (error) {
      setLoading(false);
      console.log('error', error);
    }
  }

  const handleEnter = (e: any) => {
    if (e.key === 'Enter' && query) {
      handleSubmit(e);
    } else if (e.key == 'Enter') {
      e.preventDefault();
    }
  };

  const chatMessages = useMemo(() => {
    return [
      ...messages,
      ...(pending
        ? [
            {
              type: 'apiMessage' as const,
              message: pending,
            },
          ]
        : []),
    ];
  }, [messages, pending]);

  if (authLoading || !site) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg">読み込み中...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col h-screen">
        {/* ヘッダー */}
        <div className="border-b border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href="/dashboard"
                className="text-blue-600 hover:text-blue-800 text-sm mb-1 inline-block"
              >
                ← ダッシュボードに戻る
              </Link>
              <h1 className="text-xl font-semibold">{site.name}</h1>
            </div>
            <div className="text-sm text-gray-500">
              {site.status === 'ready' ? '準備完了' : site.status}
            </div>
          </div>
        </div>

        {/* チャットエリア */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto">
            {chatMessages.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                メッセージがありません
              </div>
            ) : (
              <div className="space-y-4">
                {chatMessages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      message.type === 'userMessage'
                        ? 'justify-end'
                        : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        message.type === 'userMessage'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      {message.type === 'apiMessage' ? (
                        <ReactMarkdown className="prose prose-sm max-w-none">
                          {message.message}
                        </ReactMarkdown>
                      ) : (
                        <p className="whitespace-pre-wrap">{message.message}</p>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-lg px-4 py-2">
                      <LoadingDots />
                    </div>
                  </div>
                )}
                <div ref={messageListRef} />
              </div>
            )}
          </div>
        </div>

        {/* 入力フォーム */}
        <div className="border-t border-gray-200 bg-white px-4 py-4">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <textarea
                ref={textAreaRef}
                disabled={loading || site.status !== 'ready'}
                onKeyDown={handleEnter}
                rows={1}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  site.status === 'ready'
                    ? '質問を入力してください...'
                    : 'サイトの学習が完了していません'
                }
              />
              <button
                type="submit"
                disabled={loading || !query || site.status !== 'ready'}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium"
              >
                送信
              </button>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
}

