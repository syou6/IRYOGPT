import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest } from 'next';

// フロントエンド用のSupabaseクライアント（anon key使用）
let supabaseClientInstance: any = null;

export const createSupabaseClient = () => {
  if (supabaseClientInstance) {
    return supabaseClientInstance;
  }
  
  supabaseClientInstance = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  );
  
  return supabaseClientInstance;
};

// API Routes用のSupabase Adminクライアント（Service Role Key使用）
let supabaseAdminInstance: any = null;

const getSupabaseAdmin = () => {
  if (supabaseAdminInstance) {
    return supabaseAdminInstance;
  }
  
  supabaseAdminInstance = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
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

// API Routes用：認証チェック（認証されていない場合はエラーを返す）
export async function requireAuth(
  req: NextApiRequest,
): Promise<string> {
  const user = await getAuthUser(req);
  return user.id;
}

const adminIds = (process.env.ADMIN_USER_IDS || '')
  .split(',')
  .map((id) => id.trim())
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
