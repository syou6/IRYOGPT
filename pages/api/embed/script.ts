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
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1時間キャッシュ
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
  
  // 既に読み込まれている場合はスキップ
  if (window.SiteGPTEmbed && window.SiteGPTEmbed.loaded) {
    return;
  }
  
  const siteId = '${siteId}';
  const apiBaseUrl = '${apiBaseUrl}';
  
  // チャットボットウィジェットのHTML
  const widgetHTML = \`
    <div id="sitegpt-widget" style="position: fixed; bottom: 20px; right: 20px; z-index: 9999;">
      <div id="sitegpt-chat-container" style="display: none; width: 400px; height: 600px; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); flex-direction: column;">
        <div style="background: #4F46E5; color: white; padding: 16px; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 18px;">チャットボット</h3>
          <button id="sitegpt-close-btn" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer;">&times;</button>
        </div>
        <div id="sitegpt-messages" style="flex: 1; padding: 16px; overflow-y: auto; height: 400px;"></div>
        <div style="padding: 16px; border-top: 1px solid #e5e7eb;">
          <input type="text" id="sitegpt-input" placeholder="質問を入力..." style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; margin-bottom: 8px;">
          <button id="sitegpt-send-btn" style="width: 100%; padding: 8px; background: #4F46E5; color: white; border: none; border-radius: 4px; cursor: pointer;">送信</button>
        </div>
      </div>
      <button id="sitegpt-toggle-btn" style="width: 60px; height: 60px; border-radius: 50%; background: #4F46E5; color: white; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-size: 24px;">💬</button>
    </div>
  \`;
  
  // ウィジェットをDOMに追加
  const widgetDiv = document.createElement('div');
  widgetDiv.innerHTML = widgetHTML;
  document.body.appendChild(widgetDiv);
  
  // チャットコンテナとボタンの参照を取得
  const chatContainer = document.getElementById('sitegpt-chat-container');
  const toggleBtn = document.getElementById('sitegpt-toggle-btn');
  const closeBtn = document.getElementById('sitegpt-close-btn');
  const messagesDiv = document.getElementById('sitegpt-messages');
  const inputField = document.getElementById('sitegpt-input');
  const sendBtn = document.getElementById('sitegpt-send-btn');
  
  // トグル機能
  toggleBtn.addEventListener('click', function() {
    if (chatContainer.style.display === 'none') {
      chatContainer.style.display = 'flex';
    } else {
      chatContainer.style.display = 'none';
    }
  });
  
  // 閉じる機能
  closeBtn.addEventListener('click', function() {
    chatContainer.style.display = 'none';
  });
  
  // メッセージを追加する関数
  function addMessage(text, isUser) {
    const messageDiv = document.createElement('div');
    messageDiv.style.marginBottom = '12px';
    messageDiv.style.padding = '8px 12px';
    messageDiv.style.borderRadius = '8px';
    messageDiv.style.backgroundColor = isUser ? '#4F46E5' : '#f3f4f6';
    messageDiv.style.color = isUser ? 'white' : 'black';
    messageDiv.style.textAlign = isUser ? 'right' : 'left';
    messageDiv.textContent = text;
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
  
  // 送信機能
  function sendMessage() {
    const question = inputField.value.trim();
    if (!question) return;
    
    // ユーザーメッセージを表示
    addMessage(question, true);
    inputField.value = '';
    
    // ローディング表示
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'sitegpt-loading';
    loadingDiv.textContent = '考え中...';
    loadingDiv.style.padding = '8px 12px';
    messagesDiv.appendChild(loadingDiv);
    
    // API呼び出し（埋め込み用エンドポイントを使用）
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
      // ローディングを削除
      const loading = document.getElementById('sitegpt-loading');
      if (loading) loading.remove();
      
      // SSE形式のレスポンスを処理
      const lines = text.split('\\n');
      let answer = '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          if (data === '[DONE]') {
            break;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.data) {
              answer += parsed.data;
            }
          } catch (e) {
            // JSONパースエラーは無視
          }
        }
      }
      
      if (answer) {
        addMessage(answer, false);
      } else {
        addMessage('申し訳ございません。回答を取得できませんでした。', false);
      }
    })
    .catch(error => {
      // ローディングを削除
      const loading = document.getElementById('sitegpt-loading');
      if (loading) loading.remove();
      
      console.error('Chat error:', error);
      addMessage('エラーが発生しました。しばらくしてから再度お試しください。', false);
    });
  }
  
  // 送信ボタンクリック
  sendBtn.addEventListener('click', sendMessage);
  
  // Enterキーで送信
  inputField.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });
  
  // 読み込み完了フラグ
  window.SiteGPTEmbed = {
    loaded: true,
    siteId: siteId,
  };
})();`;
}

