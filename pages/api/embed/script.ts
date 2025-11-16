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
  
  return `(function() {
  'use strict';
  
  if (window.WebGPTEmbed && window.WebGPTEmbed.loaded) {
    return;
  }

  const siteId = ${escapedSiteId};
  const apiBaseUrl = ${escapedApiBaseUrl};

  const styles = [
    '.sgpt-widget{position:fixed;right:24px;bottom:24px;z-index:9999;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;color:#e2e8f0}',
    '.sgpt-widget *{box-sizing:border-box;font-family:inherit}',
    '.sgpt-fab{width:60px;height:60px;border-radius:999px;background:linear-gradient(120deg,#34d399,#6ee7b7,#22d3ee);color:#0f172a;border:none;box-shadow:0 25px 45px rgba(15,23,42,.35);cursor:pointer;font-weight:600;letter-spacing:.05em;display:flex;align-items:center;justify-content:center;transition:all .3s ease}',
    '.sgpt-fab:hover{transform:translateY(-4px)}',
    '.sgpt-chat-panel{position:absolute;right:0;bottom:80px;width:min(360px,90vw);height:520px;border-radius:28px;border:1px solid rgba(255,255,255,.08);background:rgba(3,7,18,.92);box-shadow:0 45px 120px rgba(1,3,6,.75);backdrop-filter:blur(30px);display:flex;flex-direction:column;opacity:0;pointer-events:none;transform:translateY(20px);transition:all .35s cubic-bezier(.21,1.02,.73,1)}',
    '.sgpt-widget.is-open .sgpt-chat-panel{opacity:1;pointer-events:auto;transform:translateY(0)}',
    '.sgpt-chat-header{padding:20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.06)}',
    '.sgpt-title{font-size:1.1rem;font-weight:600;margin:0;color:#f8fafc}',
    '.sgpt-close-btn{border:none;background:none;color:#94a3b8;font-size:1.4rem;cursor:pointer}',
    '.sgpt-messages{flex:1;padding:20px;overflow-y:auto;display:flex;flex-direction:column;gap:12px}',
    '.sgpt-message{padding:12px 16px;border-radius:18px;font-size:.93rem;line-height:1.5;max-width:92%;box-shadow:0 15px 40px rgba(2,6,23,.35)}',
    '.sgpt-message.user{margin-left:auto;background:linear-gradient(120deg,#34d399,#22d3ee);color:#0f172a}',
    '.sgpt-message.bot{background:rgba(2,6,23,.7);border:1px solid rgba(148,163,184,.2);color:#e2e8f0}',
    '.sgpt-input-bar{padding:16px 20px;border-top:1px solid rgba(255,255,255,.06);display:flex;gap:12px;align-items:center}',
    '.sgpt-input{flex:1;border-radius:16px;border:1px solid rgba(148,163,184,.3);background:rgba(15,23,42,.8);color:#f1f5f9;padding:12px 16px;font-size:.95rem;box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}',
    '.sgpt-input::placeholder{color:#64748b}',
    '.sgpt-send-btn{border:none;border-radius:14px;padding:12px 20px;font-weight:600;background:linear-gradient(120deg,#34d399,#6ee7b7,#22d3ee);color:#0f172a;cursor:pointer;box-shadow:0 20px 45px rgba(15,23,42,.45)}',
    '.sgpt-send-btn:disabled{opacity:.6;cursor:not-allowed}',
    '.sgpt-loading{font-size:.85rem;color:#94a3b8}',
    '.sgpt-widget .sgpt-chip{display:inline-flex;padding:4px 10px;border-radius:999px;background:rgba(52,211,153,.18);color:#a7f3d0;font-size:.75rem;letter-spacing:.15em}',
    '.sgpt-widget .sgpt-footer{padding:0 20px 16px;text-align:center;font-size:.7rem;color:#475569}',
    '.sgpt-sticky-slot{position:sticky;top:0;z-index:5;margin-bottom:12px;display:none;flex-direction:column;gap:6px;padding-bottom:8px;background:linear-gradient(180deg,rgba(3,7,18,0.95),rgba(3,7,18,0))}',
    '.sgpt-sticky-slot.active{display:flex}',
    '.sgpt-sticky-question{display:flex;justify-content:flex-end}',
    '.sgpt-sticky-question .sgpt-message{max-width:80%;font-size:.93rem;box-shadow:0 20px 45px rgba(16,185,129,0.35)}',
    '.sgpt-sticky-question .sgpt-message.user{box-shadow:0 20px 45px rgba(16,185,129,0.45)}',
    '.sgpt-sticky-indicator{align-self:flex-end;font-size:.75rem;color:#a5f3fc;display:none;gap:6px;align-items:center}',
    '.sgpt-sticky-indicator svg{width:14px;height:14px}',
    '.sgpt-scroll-hint{position:absolute;right:24px;bottom:96px;background:rgba(15,23,42,.9);border:1px solid rgba(148,163,184,.4);color:#cbd5f5;padding:8px 14px;border-radius:999px;font-size:.75rem;display:flex;align-items:center;gap:6px;box-shadow:0 15px 40px rgba(2,6,23,.6);opacity:0;pointer-events:none;transition:opacity .25s ease}',
    '.sgpt-scroll-hint svg{width:14px;height:14px}',
    '.sgpt-scroll-hint.is-visible{opacity:1;pointer-events:auto}'
  ].join('');

  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);

  const widgetHTML = [
    '<div class="sgpt-widget" id="webgpt-widget">',
    '  <button class="sgpt-fab" id="webgpt-toggle-btn" type="button" aria-expanded="false" aria-label="WEBGPTと会話する">💬</button>',
    '</div>'
  ].join('');

  const chatPanelTemplate = [
    '<div class="sgpt-panel-slot" id="webgpt-panel-slot">',
    '  <div class="sgpt-chat-panel" id="webgpt-chat-container">',
    '    <div class="sgpt-chat-header">',
    '      <div>',
    '        <p class="sgpt-chip">WEBGPT</p>',
    '        <p class="sgpt-title">WEBGPT サポート</p>',
    '      </div>',
    '      <button class="sgpt-close-btn" id="webgpt-close-btn">×</button>',
    '    </div>',
    '    <div class="sgpt-messages" id="webgpt-messages"></div>',
    '    <div class="sgpt-input-bar">',
    '      <input type="text" id="webgpt-input" class="sgpt-input" placeholder="質問を入力..." />',
    '      <button id="webgpt-send-btn" class="sgpt-send-btn">送信</button>',
    '    </div>',
    '    <div class="sgpt-footer">Powered by WEBGPT</div>',
    '  </div>',
    '</div>'
  ].join('');

  const wrapper = document.createElement('div');
  wrapper.innerHTML = widgetHTML;
  document.body.appendChild(wrapper);

  const widget = document.getElementById('webgpt-widget');
  const toggleBtn = document.getElementById('webgpt-toggle-btn');

  let chatContainer = null;
  let panelSlot = null;
  let closeBtn = null;
  let messagesDiv = null;
  let stickySlot = null;
  let stickyQuestionWrap = null;
  let thinkingIndicator = null;
  let inputField = null;
  let sendBtn = null;
  let scrollHint = null;
  let autoScroll = true;

  function ensureChatMounted() {
    if (!widget || panelSlot) return;
    widget.insertAdjacentHTML('beforeend', chatPanelTemplate);
    panelSlot = document.getElementById('webgpt-panel-slot');
    chatContainer = document.getElementById('webgpt-chat-container');
    closeBtn = document.getElementById('webgpt-close-btn');
    messagesDiv = document.getElementById('webgpt-messages');
    inputField = document.getElementById('webgpt-input');
    sendBtn = document.getElementById('webgpt-send-btn');
    scrollHint = document.createElement('button');
    scrollHint.className = 'sgpt-scroll-hint';
    scrollHint.setAttribute('type', 'button');
    scrollHint.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg><span>下へスクロール</span>';
    chatContainer?.appendChild(scrollHint);

    stickySlot = document.createElement('div');
    stickySlot.className = 'sgpt-sticky-slot';
    stickyQuestionWrap = document.createElement('div');
    stickyQuestionWrap.className = 'sgpt-sticky-question';
    thinkingIndicator = document.createElement('div');
    thinkingIndicator.className = 'sgpt-sticky-indicator';
    thinkingIndicator.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg><span>考えています…</span>';
    stickySlot.appendChild(stickyQuestionWrap);
    stickySlot.appendChild(thinkingIndicator);
    chatContainer?.insertBefore(stickySlot, messagesDiv || null);

    closeBtn && closeBtn.addEventListener('click', () => toggleChat(false));
    sendBtn && sendBtn.addEventListener('click', () => sendMessage());
    if (inputField) {
      inputField.addEventListener('keypress', function (event) {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          sendMessage();
        }
      });
    }
    if (scrollHint) {
      scrollHint.addEventListener('click', () => {
        autoScroll = true;
        scrollHint.classList.remove('is-visible');
        scrollToBottom({ smooth: true });
      });
    }
    messagesDiv && messagesDiv.addEventListener('scroll', updateScrollHint);
  }

  function getInputElement() {
    return inputField && inputField instanceof HTMLInputElement ? inputField : null;
  }

  function updateScrollHint() {
    if (!messagesDiv || !scrollHint) return;
    const nearBottom = messagesDiv.scrollHeight - (messagesDiv.scrollTop + messagesDiv.clientHeight) < 40;
    if (nearBottom) {
      scrollHint.classList.remove('is-visible');
      autoScroll = true;
    } else {
      scrollHint.classList.add('is-visible');
      autoScroll = false;
    }
  }

  function scrollToBottom(options = { smooth: true }) {
    if (!messagesDiv) return;
    const behavior = options.smooth ? 'smooth' : 'auto';
    messagesDiv.scrollTo({ top: messagesDiv.scrollHeight, behavior });
  }

  function toggleChat(open) {
    if (!widget) return;
    const shouldOpen = typeof open === 'boolean' ? open : !widget.classList.contains('is-open');
    if (shouldOpen) {
      ensureChatMounted();
    }
    widget.classList.toggle('is-open', shouldOpen);
    const inputEl = getInputElement();
    if (shouldOpen && inputEl) {
      setTimeout(() => inputEl.focus(), 150);
    }
    updateScrollHint();
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => toggleChat());
  }

  function addMessage(text, isUser, sources) {
    if (!messagesDiv) return;
    const messageDiv = document.createElement('div');
    messageDiv.className = 'sgpt-message ' + (isUser ? 'user' : 'bot');
    
    if (isUser) {
      messageDiv.textContent = text;
      if (stickySlot && stickyQuestionWrap && thinkingIndicator) {
        stickyQuestionWrap.innerHTML = '';
        stickyQuestionWrap.appendChild(messageDiv.cloneNode(true));
        stickySlot.classList.add('active');
        thinkingIndicator.style.display = 'flex';
      }
      messagesDiv.appendChild(messageDiv);
      autoScroll = true;
      scrollHint && scrollHint.classList.remove('is-visible');
      scrollToBottom({ smooth: true });
      return;
    }

    const textNode = document.createTextNode(text);
    messageDiv.appendChild(textNode);
    
    if (sources && sources.length > 0) {
        const sourcesDiv = document.createElement('div');
        sourcesDiv.style.marginTop = '12px';
        sourcesDiv.style.paddingTop = '12px';
        sourcesDiv.style.borderTop = '1px solid rgba(255,255,255,0.1)';
        sourcesDiv.style.fontSize = '0.75rem';
        sourcesDiv.style.color = '#94a3b8';
        
        const sourcesLabel = document.createElement('div');
        sourcesLabel.textContent = '引用元:';
        sourcesLabel.style.marginBottom = '8px';
        sourcesDiv.appendChild(sourcesLabel);
        
        sources.forEach(function(url) {
          const link = document.createElement('a');
          link.href = url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = url;
          link.style.color = '#34d399';
          link.style.textDecoration = 'underline';
          link.style.display = 'block';
          link.style.marginBottom = '4px';
          link.style.wordBreak = 'break-all';
          sourcesDiv.appendChild(link);
        });
        
        messageDiv.appendChild(sourcesDiv);
      }

    messagesDiv.appendChild(messageDiv);
    if (autoScroll) {
      scrollToBottom({ smooth: true });
    } else {
      scrollHint && scrollHint.classList.add('is-visible');
    }
  }

  function showLoading() {
    if (!messagesDiv) return null;
    const loading = document.createElement('div');
    loading.id = 'webgpt-loading';
    loading.className = 'sgpt-message bot sgpt-loading';
    loading.textContent = 'WEBGPT が回答を作成しています...';
    messagesDiv.appendChild(loading);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    return loading;
  }

  function sendMessage() {
    ensureChatMounted();
    const inputEl = getInputElement();
    if (!inputEl) return;
    const question = inputEl.value.trim();
    if (!question) return;

    addMessage(question, true);
    inputEl.value = '';

    const loadingDiv = showLoading();
    let streamingMessageDiv = null;
    let answer = '';
    let sources = [];

    fetch(apiBaseUrl + '/api/embed/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: question,
        site_id: siteId,
        history: [],
      }),
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      
      if (loadingDiv) loadingDiv.remove();
      
      // ストリーミング用のメッセージ要素を作成
      streamingMessageDiv = document.createElement('div');
      streamingMessageDiv.className = 'sgpt-message bot';
      if (messagesDiv) {
        messagesDiv.appendChild(streamingMessageDiv);
        if (autoScroll) {
          scrollToBottom({ smooth: true });
        }
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      function readStream() {
        reader.read().then(({ done, value }) => {
          if (done) {
            // ストリーミング完了
            if (streamingMessageDiv) {
              updateStreamingMessage(streamingMessageDiv, answer, sources);
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
                updateStreamingMessage(streamingMessageDiv, answer, sources);
              }
              return;
            }
            try {
              const parsed = JSON.parse(payload);
        if (parsed.data) {
            answer += parsed.data;
            // リアルタイムで更新
            if (streamingMessageDiv) {
              updateStreamingMessage(streamingMessageDiv, answer, sources);
            }
            thinkingIndicator.style.display = 'none';
          }
              if (parsed.sources && Array.isArray(parsed.sources)) {
                sources = parsed.sources;
                if (streamingMessageDiv) {
                  updateStreamingMessage(streamingMessageDiv, answer, sources);
                }
              }
            } catch (err) {
            console.warn('WEBGPT embed parse error', err);
          }
        }

          readStream();
        }).catch(error => {
          console.error('Stream read error:', error);
          if (loadingDiv) loadingDiv.remove();
          if (streamingMessageDiv) streamingMessageDiv.remove();
          addMessage('エラーが発生しました。しばらくしてから再度お試しください。', false);
        });
      }

      readStream();
    })
    .catch(error => {
      if (loadingDiv) loadingDiv.remove();
      console.error('Chat error:', error);
      addMessage('エラーが発生しました。しばらくしてから再度お試しください。', false);
    });
  }

  function updateStreamingMessage(messageDiv, text, sources) {
    if (!messageDiv) return;
    
    // 既存の内容をクリア
    messageDiv.innerHTML = '';
    
    const textNode = document.createTextNode(text.split('**').join(''));
    messageDiv.appendChild(textNode);
    
    // 引用元URLを追加
    if (sources && sources.length > 0) {
      const sourcesDiv = document.createElement('div');
      sourcesDiv.style.marginTop = '12px';
      sourcesDiv.style.paddingTop = '12px';
      sourcesDiv.style.borderTop = '1px solid rgba(255,255,255,0.1)';
      sourcesDiv.style.fontSize = '0.75rem';
      sourcesDiv.style.color = '#94a3b8';
      
      const sourcesLabel = document.createElement('div');
      sourcesLabel.textContent = '引用元:';
      sourcesLabel.style.marginBottom = '8px';
      sourcesDiv.appendChild(sourcesLabel);
      
      sources.forEach(function(url) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = url;
        link.style.color = '#34d399';
        link.style.textDecoration = 'underline';
        link.style.display = 'block';
        link.style.marginBottom = '4px';
        link.style.wordBreak = 'break-all';
        sourcesDiv.appendChild(link);
      });
      
      messageDiv.appendChild(sourcesDiv);
    }
    if (thinkingIndicator) {
      thinkingIndicator.style.display = 'none';
    }
    if (autoScroll) {
      scrollToBottom({ smooth: false });
    }
    updateScrollHint();
  }

  window.WebGPTEmbed = {
    loaded: true,
    siteId: siteId,
  };
})();`;
}
