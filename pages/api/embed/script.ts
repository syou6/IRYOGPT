import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseClient } from '@/utils/supabase-client';

/**
 * GET /api/embed/script?site_id=xxx
 * 
 * 埋め込み用JavaScriptスクリプトを返す
 * sites.is_embed_enabled が true の場合のみ有効なスクリプトを返す
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { site_id } = req.query;

    if (!site_id || typeof site_id !== 'string') {
      return res.status(400).json({ message: 'site_id is required' });
    }

    // サイト情報を取得（is_embed_enabled を確認）
    const { data: site, error: siteError } = await supabaseClient
      .from('sites')
      .select('id, is_embed_enabled, status')
      .eq('id', site_id)
      .single();

    if (siteError || !site) {
      // サイトが見つからない場合、空のスクリプトを返す（エラーを出さない）
      res.setHeader('Content-Type', 'application/javascript');
      return res.status(200).send('// Site not found');
    }

    // is_embed_enabled が false の場合、空のスクリプトを返す
    if (!site.is_embed_enabled) {
      res.setHeader('Content-Type', 'application/javascript');
      return res.status(200).send('// Embedding is not enabled for this site');
    }

    // status が 'ready' でない場合も空のスクリプトを返す
    if (site.status !== 'ready') {
      res.setHeader('Content-Type', 'application/javascript');
      return res.status(200).send('// Site is not ready for embedding');
    }

    // 埋め込みスクリプトを生成
    // リクエストからベースURLを取得（フォールバック付き）
    const protocol = req.headers['x-forwarded-proto'] || (req.headers.referer?.startsWith('https') ? 'https' : 'http');
    const host = req.headers.host || 'localhost:3005';
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${host}`;
    const script = generateEmbedScript(site_id, apiBaseUrl);

    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.status(200).send(script);
  } catch (error) {
    console.error('[Embed Script] Error:', error);
    res.setHeader('Content-Type', 'application/javascript');
    return res.status(200).send('// Error loading embed script');
  }
}

/**
 * 埋め込みスクリプトを生成
 */
function generateEmbedScript(siteId: string, apiBaseUrl: string): string {
  // 変数を安全にエスケープ
  const escapedSiteId = JSON.stringify(siteId);
  const escapedApiBaseUrl = JSON.stringify(apiBaseUrl);
  const iconUrl = `${apiBaseUrl}/icons/bee-icon.png?v=2`;
  const escapedIconUrl = JSON.stringify(iconUrl);
  // バッククォートを含む正規表現パターンをエスケープ
  const backtick3 = '```';
  const backtick1 = '`';
  
  return `(function() {
  'use strict';
  
  if (window.WebGPTEmbed && window.WebGPTEmbed.loaded) {
    return;
  }

  const siteId = ${escapedSiteId};
  const apiBaseUrl = ${escapedApiBaseUrl};
  const iconUrl = ${escapedIconUrl};

  const styles = [
    '.sgpt-widget{position:fixed;right:24px;bottom:24px;z-index:9999;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;color:#e2e8f0}',
    '.sgpt-widget *{box-sizing:border-box;font-family:inherit}',
    '.sgpt-fab{width:60px;height:60px;border-radius:999px;background:linear-gradient(135deg,#34d399,#6ee7b7,#22d3ee);color:#0f172a;border:none;box-shadow:0 20px 40px rgba(15,23,42,.3);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .3s ease}',
    '.sgpt-fab:hover{transform:translateY(-4px)}',
    '.sgpt-chat-panel{position:absolute;right:0;bottom:80px;width:min(360px,90vw);height:520px;border-radius:28px;border:1px solid rgba(255,255,255,.08);background:rgba(3,7,18,.92);box-shadow:0 45px 120px rgba(1,3,6,.75);backdrop-filter:blur(30px);display:flex;flex-direction:column;opacity:0;pointer-events:none;transform:translateY(20px);transition:all .35s cubic-bezier(.21,1.02,.73,1)}',
    '.sgpt-widget.is-open .sgpt-chat-panel{opacity:1;pointer-events:auto;transform:translateY(0)}',
    '.sgpt-chat-header{padding:20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.06)}',
    '.sgpt-title{font-size:1.1rem;font-weight:600;margin:0;color:#f8fafc}',
    '.sgpt-close-btn{border:none;background:none;color:#94a3b8;font-size:1.4rem;cursor:pointer}',
    '.sgpt-messages{flex:1;padding:20px;overflow-y:auto;display:flex;flex-direction:column;gap:0}',
    '.sgpt-quick-buttons{display:flex;flex-wrap:wrap;gap:8px;padding:12px 0}',
    '.sgpt-quick-btn{border:1px solid rgba(52,211,153,.4);background:rgba(52,211,153,.1);color:#a7f3d0;padding:8px 14px;border-radius:16px;font-size:.85rem;cursor:pointer;transition:all .2s ease}',
    '.sgpt-quick-btn:hover{background:rgba(52,211,153,.2);border-color:rgba(52,211,153,.6);transform:translateY(-1px)}',
    '.sgpt-thread{display:flex;flex-direction:column;gap:12px;padding:16px 0;border-bottom:1px solid rgba(255,255,255,.06)}',
    '.sgpt-question-box{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.05);border:1px solid rgba(148,163,184,.25);border-radius:16px;padding:12px 14px}',
    '.sgpt-question-box span{font-size:.72rem;letter-spacing:.25em;text-transform:uppercase;color:rgba(226,232,240,.65)}',
    '.sgpt-question-text{color:#f8fafc;font-size:1rem;font-family:"IBM Plex Sans",Inter,sans-serif;overflow-wrap:break-word;word-break:break-word;max-width:100%}',
    '.sgpt-answer{background:rgba(2,6,23,.7);border:1px solid rgba(148,163,184,.2);border-radius:20px;padding:16px;box-shadow:0 25px 70px rgba(1,8,4,.45);display:flex;flex-direction:column;gap:10px;overflow-wrap:break-word;word-break:break-word;max-width:100%}',
    '.sgpt-answer-header{display:flex;align-items:center;gap:10px;margin-bottom:8px}',
    '.sgpt-answer-header span{font-size:.72rem;letter-spacing:.25em;text-transform:uppercase;color:rgba(226,232,240,.65)}',
    '.sgpt-answer-tagline{font-size:.78rem;color:rgba(226,232,240,.7);font-family:"IBM Plex Mono",monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.sgpt-answer-body{color:#e2e8f0;font-size:.95rem;line-height:1.7;padding-right:6px;overflow-wrap:break-word;word-break:break-word;max-width:100%}',
    '.sgpt-input-bar{padding:16px 20px;border-top:1px solid rgba(255,255,255,.06);display:flex;gap:12px;align-items:center}',
    '.sgpt-input{flex:1;border-radius:16px;border:1px solid rgba(148,163,184,.3);background:rgba(15,23,42,.8);color:#f1f5f9;padding:12px 16px;font-size:.95rem;box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}',
    '.sgpt-input::placeholder{color:#64748b}',
    '.sgpt-send-btn{border:none;border-radius:14px;padding:12px 20px;font-weight:600;background:linear-gradient(120deg,#34d399,#6ee7b7,#22d3ee);color:#0f172a;cursor:pointer;box-shadow:0 20px 45px rgba(15,23,42,.45)}',
    '.sgpt-send-btn:disabled{opacity:.6;cursor:not-allowed}',
    '.sgpt-loading{font-size:.85rem;color:#94a3b8}',
    '.sgpt-widget .sgpt-chip{display:inline-flex;padding:4px 10px;border-radius:999px;background:rgba(52,211,153,.18);color:#a7f3d0;font-size:.75rem;letter-spacing:.15em}',
    '.sgpt-widget .sgpt-footer{padding:0 20px 16px;text-align:center;font-size:.7rem;color:#475569}',
    '.sgpt-scroll-hint{position:absolute;right:24px;bottom:96px;background:rgba(15,23,42,.9);border:1px solid rgba(148,163,184,.4);color:#cbd5f5;padding:8px 14px;border-radius:999px;font-size:.75rem;display:flex;align-items:center;gap:6px;box-shadow:0 15px 40px rgba(2,6,23,.6);opacity:0;pointer-events:none;transition:opacity .25s ease}',
    '.sgpt-scroll-hint svg{width:14px;height:14px}',
    '.sgpt-scroll-hint.is-visible{opacity:1;pointer-events:auto}'
  ].join('');

  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);

  const widgetHTML = [
    '<div class="sgpt-widget" id="webgpt-widget">',
    '  <div class="sgpt-chat-panel" id="webgpt-chat-container">',
    '    <div class="sgpt-chat-header">',
    '      <div>',
    '        <p class="sgpt-chip">よやくらく</p>',
    '        <p class="sgpt-title">💬 よやくらく サポート</p>',
    '      </div>',
    '      <button class="sgpt-close-btn" id="webgpt-close-btn">×</button>',
    '    </div>',
    '    <div class="sgpt-messages" id="webgpt-messages"></div>',
    '    <div class="sgpt-input-bar">',
    '      <input type="text" id="webgpt-input" class="sgpt-input" placeholder="質問を入力..." />',
    '      <button id="webgpt-send-btn" class="sgpt-send-btn">送信</button>',
    '    </div>',
    '    <div class="sgpt-footer">Powered by よやくらく</div>',
    '  </div>',
    '  <button class="sgpt-fab" id="webgpt-toggle-btn"></button>',
    '</div>'
  ].join('');

  const wrapper = document.createElement('div');
  wrapper.innerHTML = widgetHTML;
  document.body.appendChild(wrapper);

  const widget = document.getElementById('webgpt-widget');
  const chatContainer = document.getElementById('webgpt-chat-container');
  const toggleBtn = document.getElementById('webgpt-toggle-btn');
  
  // アイコンを設定（bee-icon.pngを使用）
  if (toggleBtn) {
    const iconImg = document.createElement('img');
    iconImg.src = iconUrl;
    iconImg.alt = 'よやくらく';
    iconImg.style.width = '36px';
    iconImg.style.height = '36px';
    iconImg.style.objectFit = 'contain';
    iconImg.onerror = function() {
      toggleBtn.innerHTML = '💬';
    };
    toggleBtn.appendChild(iconImg);
  }
  
  const closeBtn = document.getElementById('webgpt-close-btn');
  const messagesDiv = document.getElementById('webgpt-messages');
  // sticky UI removed; messages appear only in list
  const inputField = document.getElementById('webgpt-input');
  const sendBtn = document.getElementById('webgpt-send-btn');
  const scrollHint = document.createElement('button');
  scrollHint.className = 'sgpt-scroll-hint';
  scrollHint.setAttribute('type', 'button');
  scrollHint.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg><span>下へスクロール</span>';
  chatContainer?.appendChild(scrollHint);

  function getInputElement() {
    const el = document.getElementById('webgpt-input');
    return el && el instanceof HTMLInputElement ? el : null;
  }

  let autoScroll = false;

  // 会話履歴を保存（[question, answer] のタプル形式）
  let chatHistory = [];

  function updateScrollHint() {
    if (!messagesDiv) return;
    const nearBottom = messagesDiv.scrollHeight - (messagesDiv.scrollTop + messagesDiv.clientHeight) < 40;
    if (nearBottom) {
      scrollHint.classList.remove('is-visible');
      autoScroll = true;
    } else {
      scrollHint.classList.add('is-visible');
      autoScroll = false;
    }
  }

  if (messagesDiv) {
    messagesDiv.addEventListener('scroll', updateScrollHint);
  }

  function scrollToBottom(options = { smooth: true }) {
    if (!messagesDiv) return;
    const behavior = options.smooth ? 'smooth' : 'auto';
    messagesDiv.scrollTo({ top: messagesDiv.scrollHeight, behavior });
  }

  scrollHint.addEventListener('click', () => {
    scrollHint.classList.remove('is-visible');
    scrollToBottom({ smooth: true });
  });

  let hasShownInitialMessage = false;

  // クイック選択ボタンの定義
  const quickReplies = [
    { label: '予約したい', type: 'static', response: 'ご予約を承ります。ご希望の日時はございますか？（例：明日の午前中、来週の月曜日など）' },
    { label: '空き状況を確認', type: 'api', message: '空き状況を教えてください' },
    { label: '診療時間', type: 'api', message: '診療時間を教えてください' },
    { label: 'キャンセル', type: 'static', response: 'ご予約のキャンセルにつきましては、お手数ですがお電話にてご連絡をお願いいたします。' }
  ];

  // クイックボタンを作成
  function createQuickButtons() {
    const container = document.createElement('div');
    container.className = 'sgpt-quick-buttons';
    container.id = 'webgpt-quick-buttons';

    quickReplies.forEach(function(item) {
      const btn = document.createElement('button');
      btn.className = 'sgpt-quick-btn';
      btn.textContent = item.label;
      btn.addEventListener('click', function() {
        handleQuickReply(item);
      });
      container.appendChild(btn);
    });

    return container;
  }

  // クイックボタンを非表示にする
  function hideQuickButtons() {
    const quickBtns = document.getElementById('webgpt-quick-buttons');
    if (quickBtns) {
      quickBtns.style.display = 'none';
    }
  }

  // クイックボタンの処理
  function handleQuickReply(item) {
    hideQuickButtons();

    if (item.type === 'static') {
      // 固定応答：ユーザーの質問として表示し、即座に回答
      const answerContainer = addMessage(item.label, true);
      if (answerContainer) {
        updateStreamingMessage(answerContainer, item.response, null);
      }
      lastAnswerBody = null;
    } else {
      // API呼び出し：通常の送信処理
      const inputEl = getInputElement();
      if (inputEl) {
        inputEl.value = item.message;
        sendMessage();
      }
    }
  }

  function toggleChat(open) {
    if (!widget || !chatContainer) return;
    const shouldOpen = typeof open === 'boolean' ? open : !widget.classList.contains('is-open');
    widget.classList.toggle('is-open', shouldOpen);
    const inputEl = getInputElement();
    if (shouldOpen && inputEl) {
      setTimeout(() => inputEl.focus(), 150);
      // 初回のみ初期メッセージとクイックボタンを表示
      if (!hasShownInitialMessage && messagesDiv && messagesDiv.children.length === 0) {
        hasShownInitialMessage = true;
        const initialMessage = addMessage('こんにちは！ご予約やお問い合わせを承ります。', false);
        if (initialMessage) {
          // クイックボタンを追加
          const quickBtns = createQuickButtons();
          if (initialMessage.parentElement) {
            initialMessage.parentElement.appendChild(quickBtns);
          }
          scrollToBottom({ smooth: false });
        }
      }
    }
    updateScrollHint();
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => toggleChat());
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', () => toggleChat(false));
  }

  let lastAnswerBody = null;

  function addMessage(text, isUser) {
    if (!messagesDiv) return null;

    if (isUser) {
      const thread = document.createElement('div');
      thread.className = 'sgpt-thread';

      const questionBox = document.createElement('div');
      questionBox.className = 'sgpt-question-box';
      const questionLabel = document.createElement('span');
      questionLabel.textContent = 'Q';
      const questionBody = document.createElement('div');
      questionBody.className = 'sgpt-question-text';
      questionBody.textContent = text;
      questionBox.appendChild(questionLabel);
      questionBox.appendChild(questionBody);

      const answerDiv = document.createElement('div');
      answerDiv.className = 'sgpt-answer';
      const answerHeader = document.createElement('div');
      answerHeader.className = 'sgpt-answer-header';
      const answerLabel = document.createElement('span');
      answerLabel.textContent = 'A';
      answerHeader.appendChild(answerLabel);
      const answerBody = document.createElement('div');
      answerBody.className = 'sgpt-answer-body';
      answerDiv.appendChild(answerHeader);
      answerDiv.appendChild(answerBody);

      thread.appendChild(questionBox);
      thread.appendChild(answerDiv);
      messagesDiv.appendChild(thread);
      lastAnswerBody = answerBody;
      scrollHint.classList.add('is-visible');
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
      return answerBody;
    }

    if (lastAnswerBody) {
      return lastAnswerBody;
    }

    // 初期メッセージ用のスレッドを作成（Aラベルなし）
    const thread = document.createElement('div');
    thread.className = 'sgpt-thread';

    const messageDiv = document.createElement('div');
    messageDiv.className = 'sgpt-answer';
    const messageBody = document.createElement('div');
    messageBody.className = 'sgpt-answer-body';
    messageBody.textContent = text; // テキストを設定
    messageDiv.appendChild(messageBody);

    thread.appendChild(messageDiv);
    messagesDiv.appendChild(thread);
    lastAnswerBody = messageBody;
    scrollHint.classList.add('is-visible');
    return messageBody;
  }

  function showLoading(target) {
    if (!target) return null;
    target.textContent = '▌ よやくらく が回答を準備しています...';
    return target;
  }

  function sendMessage() {
    const inputEl = getInputElement();
    if (!inputEl) return;
    const question = inputEl.value.trim();
    if (!question) return;

    const answerContainer = addMessage(question, true);
    inputEl.value = '';

    const loadingDiv = showLoading(answerContainer);
    let streamingMessageDiv = null;
    let answer = '';
    let bestSource = null;

    // 現在の質問を保存（履歴追加用）
    const currentQuestion = question;

    fetch(apiBaseUrl + '/api/embed/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: question,
        site_id: siteId,
        history: chatHistory,
      }),
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      
      // Keep placeholder text until streaming updates
      
      // ストリーミング用のメッセージ要素を作成
      streamingMessageDiv = answerContainer || addMessage('', false);
      scrollHint.classList.add('is-visible');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      function readStream() {
        reader.read().then(({ done, value }) => {
          if (done) {
            // ストリーミング完了
            if (streamingMessageDiv) {
              updateStreamingMessage(streamingMessageDiv, answer, bestSource);
            }
            // 会話履歴に追加
            if (answer) {
              chatHistory.push([currentQuestion, answer]);
            }
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\\n');
          buffer = lines.pop() || ''; // 最後の不完全な行を保持

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.substring(6);
            if (payload === '[DONE]') {
              if (streamingMessageDiv) {
                updateStreamingMessage(streamingMessageDiv, answer, bestSource);
              }
              // 会話履歴に追加
              if (answer) {
                chatHistory.push([currentQuestion, answer]);
              }
              return;
            }
            try {
              const parsed = JSON.parse(payload);
              if (parsed.data) {
                answer += parsed.data;
                // リアルタイムで更新
                if (streamingMessageDiv) {
                  updateStreamingMessage(streamingMessageDiv, answer, bestSource);
                }
              }
              if (parsed.source && parsed.source.url) {
                bestSource = parsed.source;
                if (streamingMessageDiv) {
                  updateStreamingMessage(streamingMessageDiv, answer, bestSource);
                }
              }
            } catch (err) {
            console.warn('WEBGPT embed parse error', err);
          }
        }

          readStream();
        }).catch(error => {
          console.error('Stream read error:', error);
          if (loadingDiv) updateStreamingMessage(loadingDiv, 'エラーが発生しました。しばらくしてから再度お試しください。', null);
        });
      }

      readStream();
    })
    .catch(error => {
      if (loadingDiv) updateStreamingMessage(loadingDiv, 'エラーが発生しました。しばらくしてから再度お試しください。', null);
      console.error('Chat error:', error);
    });
  }

  // マークダウンをHTMLに変換する関数（シンプルな正規表現ベース）
  function markdownToHtml(text) {
    if (!text) return '';
    let html = String(text);
    
    // XSS対策: まずHTMLエスケープ
    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // コードブロック（バッククォート3つ）を先に処理（URL変換の前に処理）
    const codeBlockPattern = new RegExp(${JSON.stringify('```')} + '([\\s\\S]+?)' + ${JSON.stringify('```')}, 'g');
    const codeBlocks = [];
    html = html.replace(codeBlockPattern, function(match, content) {
      const placeholder = '___CODE_BLOCK_' + codeBlocks.length + '___';
      codeBlocks.push({placeholder: placeholder, content: content});
      return placeholder;
    });
    
    // インラインコード（バッククォート1つ）も一時的にプレースホルダーに置換
    const inlineCodePattern = new RegExp(${JSON.stringify('`')} + '([^' + ${JSON.stringify('`')} + ']+?)' + ${JSON.stringify('`')}, 'g');
    const inlineCodes = [];
    html = html.replace(inlineCodePattern, function(match, content) {
      const placeholder = '___INLINE_CODE_' + inlineCodes.length + '___';
      inlineCodes.push({placeholder: placeholder, content: content});
      return placeholder;
    });
    
    // マークダウンリンク [テキスト](URL) を処理
    html = html.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, function(match, text, url) {
      // URLがhttp://またはhttps://で始まる場合のみリンクに変換
      if (url.indexOf('http://') === 0 || url.indexOf('https://') === 0) {
        const escapedUrl = url.replace(/"/g, '&quot;');
        return '<a href="' + escapedUrl + '" target="_blank" rel="noopener noreferrer" style="color: #34d399; text-decoration: underline;">' + text + '</a>';
      }
      return match;
    });
    
    // プレーンテキストのURLをリンクに変換（コードブロック・インラインコード以外）
    // https://... または http://... で始まるURLを検出
    const urlPattern = /(https?:\\/\\/[^\\s<>"']+)/g;
    html = html.replace(urlPattern, function(match, url) {
      // プレースホルダー内のURLは変換しない
      if (match.indexOf('___CODE_BLOCK_') !== -1 || match.indexOf('___INLINE_CODE_') !== -1) {
        return match;
      }
      // URLの末尾の句読点を除外
      const cleanUrl = url.replace(/[.,;:!?]+$/, '');
      const punctuation = url.slice(cleanUrl.length);
      const escapedUrl = cleanUrl.replace(/"/g, '&quot;');
      return '<a href="' + escapedUrl + '" target="_blank" rel="noopener noreferrer" style="color: #34d399; text-decoration: underline;">' + cleanUrl + '</a>' + punctuation;
    });
    
    // インラインコードを元に戻す
    inlineCodes.forEach(function(item) {
      html = html.replace(item.placeholder, '<code>' + item.content + '</code>');
    });
    
    // コードブロックを元に戻す
    codeBlocks.forEach(function(item) {
      html = html.replace(item.placeholder, '<code>' + item.content + '</code>');
    });
    
    // **太字** → <strong>太字</strong>
    html = html.replace(/\\*\\*([^*]+?)\\*\\*/g, '<strong>$1</strong>');
    
    // *斜体* → <em>斜体</em>（**の後に処理、単独の*のみ）
    html = html.replace(/(^|[^*])\\*([^*]+?)\\*([^*]|$)/g, '$1<em>$2</em>$3');
    
    // ## 見出し記法を削除（行頭の##を削除）
    html = html.replace(/^##+\\s*/gm, '');
    
    // 改行処理（2つの改行は段落区切り、1つは改行）
    html = html.replace(/\\n\\n/g, '<br><br>');
    html = html.replace(/\\n/g, '<br>');
    
    return html;
  }

  function updateStreamingMessage(messageDiv, text, source) {
    if (!messageDiv) return;
    
    // 既存の内容をクリア
    messageDiv.innerHTML = '';
    
    // マークダウンをHTMLに変換して表示
    const htmlContent = markdownToHtml(text);
    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = htmlContent;
    // 長いURLやテキストがはみ出ないように折り返し設定
    contentDiv.style.overflowWrap = 'break-word';
    contentDiv.style.wordBreak = 'break-word';
    contentDiv.style.maxWidth = '100%';
    // リンクやコードブロックにも折り返しを適用
    const links = contentDiv.querySelectorAll('a, code');
    links.forEach(function(el) {
      el.style.overflowWrap = 'break-word';
      el.style.wordBreak = 'break-word';
      el.style.maxWidth = '100%';
    });
    messageDiv.appendChild(contentDiv);
    
    // 最も関連性の高い引用元をカード型で表示（1つだけ）
    if (source && source.url) {
      const sourceCard = document.createElement('a');
      sourceCard.href = source.url;
      sourceCard.target = '_blank';
      sourceCard.rel = 'noopener noreferrer';
      sourceCard.style.display = 'block';
      sourceCard.style.marginTop = '16px';
      sourceCard.style.padding = '12px 16px';
      sourceCard.style.borderRadius = '12px';
      sourceCard.style.border = '1px solid rgba(52,211,153,0.3)';
      sourceCard.style.background = 'rgba(52,211,153,0.1)';
      sourceCard.style.textDecoration = 'none';
      sourceCard.style.transition = 'all 0.2s ease';
      sourceCard.style.cursor = 'pointer';
      
      // ホバー効果
      sourceCard.onmouseenter = function() {
        sourceCard.style.borderColor = 'rgba(52,211,153,0.5)';
        sourceCard.style.background = 'rgba(52,211,153,0.15)';
        sourceCard.style.transform = 'translateY(-1px)';
      };
      sourceCard.onmouseleave = function() {
        sourceCard.style.borderColor = 'rgba(52,211,153,0.3)';
        sourceCard.style.background = 'rgba(52,211,153,0.1)';
        sourceCard.style.transform = 'translateY(0)';
      };
      
      // タイトルまたはURLのドメイン名を表示
      const cardTitle = document.createElement('div');
      cardTitle.style.fontSize = '0.875rem';
      cardTitle.style.fontWeight = '600';
      cardTitle.style.color = '#34d399';
      cardTitle.style.marginBottom = '4px';
      cardTitle.textContent = source.title || new URL(source.url).hostname;
      sourceCard.appendChild(cardTitle);
      
      // URLを表示
      const cardUrl = document.createElement('div');
      cardUrl.style.fontSize = '0.75rem';
      cardUrl.style.color = '#94a3b8';
      cardUrl.style.wordBreak = 'break-all';
      cardUrl.textContent = source.url;
      sourceCard.appendChild(cardUrl);
      
      messageDiv.appendChild(sourceCard);
    }
    updateScrollHint();
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
  }
  let isComposing = false;
  if (inputField) {
    inputField.addEventListener('compositionstart', () => {
      isComposing = true;
    });
    inputField.addEventListener('compositionend', () => {
      isComposing = false;
    });
    inputField.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        if (isComposing) {
          return;
        }
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          sendMessage();
          return;
        }
        if (e.shiftKey) {
          return;
        }
        e.preventDefault();
        sendMessage();
      }
    });
  }

  window.WebGPTEmbed = {
    loaded: true,
    siteId: siteId,
  };
})();`;
}
