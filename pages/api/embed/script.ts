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
  return `(function() {
  'use strict';
  
  if (window.WebGPTEmbed && window.WebGPTEmbed.loaded) {
    return;
  }

  const siteId = '${siteId}';
  const apiBaseUrl = '${apiBaseUrl}';

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
    '.sgpt-widget .sgpt-footer{padding:0 20px 16px;text-align:center;font-size:.7rem;color:#475569}'
  ].join('');

  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);

  const widgetHTML = [
    '<div class="sgpt-widget" id="webgpt-widget">',
    '  <div class="sgpt-chat-panel" id="webgpt-chat-container">',
    '    <div class="sgpt-chat-header">',
    '      <div>',
    '        <p class="sgpt-chip">WEBGPT</p>',
    '        <p class="sgpt-title">Neon Assistant</p>',
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
    '  <button class="sgpt-fab" id="webgpt-toggle-btn">💬</button>',
    '</div>'
  ].join('');

  const wrapper = document.createElement('div');
  wrapper.innerHTML = widgetHTML;
  document.body.appendChild(wrapper);

  const widget = document.getElementById('webgpt-widget');
  const chatContainer = document.getElementById('webgpt-chat-container');
  const toggleBtn = document.getElementById('webgpt-toggle-btn');
  const closeBtn = document.getElementById('webgpt-close-btn');
  const messagesDiv = document.getElementById('webgpt-messages');
  const inputField = document.getElementById('webgpt-input');
  const sendBtn = document.getElementById('webgpt-send-btn');

  function getInputElement() {
    const el = document.getElementById('webgpt-input');
    return el && el instanceof HTMLInputElement ? el : null;
  }

  function toggleChat(open) {
    if (!widget || !chatContainer) return;
    const shouldOpen = typeof open === 'boolean' ? open : !widget.classList.contains('is-open');
    widget.classList.toggle('is-open', shouldOpen);
    const inputEl = getInputElement();
    if (shouldOpen && inputEl) {
      setTimeout(() => inputEl.focus(), 150);
    }
  }

  toggleBtn?.addEventListener('click', () => toggleChat());
  closeBtn?.addEventListener('click', () => toggleChat(false));

  function addMessage(text, isUser) {
    if (!messagesDiv) return;
    const messageDiv = document.createElement('div');
    messageDiv.className = \'sgpt-message \'+ (isUser ? 'user' : 'bot');
    messageDiv.textContent = text;
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  function showLoading() {
    if (!messagesDiv) return null;
    const loading = document.createElement('div');
    loading.id = 'webgpt-loading';
    loading.className = 'sgpt-message bot sgpt-loading';
    loading.textContent = 'Neon assistant is thinking...';
    messagesDiv.appendChild(loading);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    return loading;
  }

  function sendMessage() {
    const inputEl = getInputElement();
    if (!inputEl) return;
    const question = inputEl.value.trim();
    if (!question) return;

    addMessage(question, true);
    inputEl.value = '';

    const loadingDiv = showLoading();

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
      return response.text();
    })
    .then(text => {
      if (loadingDiv) loadingDiv.remove();

      const lines = text.split('\\n');
      let answer = '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.substring(6);
        if (payload === '[DONE]') break;
        try {
          const parsed = JSON.parse(payload);
          if (parsed.data) answer += parsed.data;
        } catch (err) {
          console.warn('WEBGPT embed parse error', err);
        }
      }

      if (answer) {
        addMessage(answer, false);
      } else {
        addMessage('申し訳ございません。回答を取得できませんでした。', false);
      }
    })
    .catch(error => {
      if (loadingDiv) loadingDiv.remove();
      console.error('Chat error:', error);
      addMessage('エラーが発生しました。しばらくしてから再度お試しください。', false);
    });
  }
  
  sendBtn?.addEventListener('click', sendMessage);
  inputField?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  });

  window.WebGPTEmbed = {
    loaded: true,
    siteId: siteId,
  };
})();`;
}
