import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest } from 'next';

// フロントエンド用のSupabaseクライアント（anon key使用）
let supabaseClientInstance: any = null;

// ビルド時（prerender）用のダミーURL
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const createSupabaseClient = () => {
  if (supabaseClientInstance) {
    return supabaseClientInstance;
  }

  supabaseClientInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  return supabaseClientInstance;
};

// API Routes用のSupabase Adminクライアント（Service Role Key使用）
let supabaseAdminInstance: any = null;

const getSupabaseAdmin = () => {
  if (supabaseAdminInstance) {
    return supabaseAdminInstance;
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

  supabaseAdminInstance = createClient(
    SUPABASE_URL,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
  
  return supabaseAdminInstance;
};

export const getSupabaseAdminClient = () => getSupabaseAdmin();

export async function getAuthUser(req: NextApiRequest) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    throw new Error('Unauthorized');
  }

  const supabaseAdmin = getSupabaseAdmin();
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    throw new Error('Unauthorized');
  }

  return user;
}

// API Routes用：リクエストから認証されたユーザーIDを取得
export async function getUserIdFromRequest(
  req: NextApiRequest,
): Promise<string | null> {
  try {
    const user = await getAuthUser(req);
    return user.id;
  } catch (error) {
    return null;
  }
}

// 許可されたメールアドレスのリスト（環境変数から取得）
const allowedEmails = (process.env.ALLOWED_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean);

// API Routes用：認証チェック（認証されていない場合はエラーを返す）
export async function requireAuth(
  req: NextApiRequest,
): Promise<string> {
  const user = await getAuthUser(req);

  // 許可メールリストが設定されている場合、メールをチェック
  if (allowedEmails.length > 0) {
    const userEmail = user.email?.toLowerCase() || '';
    if (!allowedEmails.includes(userEmail)) {
      throw new Error('AccessDenied');
    }
  }

  return user.id;
}

const adminIds = (process.env.ADMIN_USER_IDS || process.env.NEXT_PUBLIC_ADMIN_USER_IDS || '')
  .split(',')
  .map(id => id.trim())
  .filter(Boolean);

export async function requireAdmin(req: NextApiRequest): Promise<string> {
  const userId = await requireAuth(req);
  if (adminIds.length === 0) {
    throw new Error('AdminNotConfigured');
  }
  if (!adminIds.includes(userId)) {
    throw new Error('Forbidden');
  }
  return userId;
}

/**
 * site_idからspreadsheet_idを取得（予約API用）
 * site_idが無効な場合はnullを返す
 */
export async function getSpreadsheetIdBySiteId(siteId: string): Promise<string | null> {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from('sites')
    .select('spreadsheet_id')
    .eq('id', siteId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.spreadsheet_id;
}

/**
 * site_idが有効かつspreadsheet_idが設定されているか検証
 * 有効な場合はspreadsheet_idを返す、無効な場合はエラーをthrow
 */
export async function requireSiteWithSpreadsheet(siteId: string): Promise<string> {
  if (!siteId) {
    throw new Error('site_id is required');
  }

  const spreadsheetId = await getSpreadsheetIdBySiteId(siteId);

  if (!spreadsheetId) {
    throw new Error('Site not found or spreadsheet not configured');
  }

  return spreadsheetId;
}
