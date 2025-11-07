import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest } from 'next';

// フロントエンド用のSupabaseクライアント（anon key使用）
let supabaseClientInstance: ReturnType<typeof createClient> | null = null;

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
let supabaseAdminInstance: ReturnType<typeof createClient> | null = null;

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

// API Routes用：リクエストから認証されたユーザーIDを取得
export async function getUserIdFromRequest(
  req: NextApiRequest,
): Promise<string | null> {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  
  if (!token) {
    return null;
  }

  // Service Role Keyを使ったクライアントでJWTを検証
  const supabaseAdmin = getSupabaseAdmin();

  try {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return user.id;
  } catch (error) {
    return null;
  }
}

// API Routes用：認証チェック（認証されていない場合はエラーを返す）
export async function requireAuth(
  req: NextApiRequest,
): Promise<string> {
  const userId = await getUserIdFromRequest(req);
  
  if (!userId) {
    throw new Error('Unauthorized');
  }
  
  return userId;
}

