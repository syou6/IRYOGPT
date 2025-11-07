import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import Link from 'next/link';
import { createSupabaseClient } from '@/utils/supabase-auth';

interface Site {
  id: string;
  name: string;
  base_url: string;
  sitemap_url: string | null;
  status: 'idle' | 'training' | 'ready' | 'error';
  last_trained_at: string | null;
  created_at: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    baseUrl: '',
    sitemapUrl: '',
  });
  const [trainingSites, setTrainingSites] = useState<Set<string>>(new Set());
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

  // サイト一覧を取得
  useEffect(() => {
    if (authLoading) return;

    const fetchSitesWithAuth = async () => {
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

        const data = await response.json();
        setSites(data);

        // Training中のサイトを追跡
        const training = new Set(
          data.filter((s: Site) => s.status === 'training').map((s: Site) => s.id)
        );
        setTrainingSites(training);
      } catch (error) {
        console.error('Error fetching sites:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSitesWithAuth();

    // 5秒ごとにステータスを更新（Training中のサイトがある場合）
    const interval = setInterval(() => {
      if (trainingSites.size > 0) {
        fetchSitesWithAuth();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [authLoading, trainingSites.size, router, supabase]);

  const fetchSites = async () => {
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
      if (!response.ok) throw new Error('Failed to fetch sites');
      const data = await response.json();
      setSites(data);
      
      // Training中のサイトを追跡
      const training = new Set(
        data.filter((s: Site) => s.status === 'training').map((s: Site) => s.id)
      );
      setTrainingSites(training);
    } catch (error) {
      console.error('Error fetching sites:', error);
    }
  };

  // 新規サイト作成
  const handleCreateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push('/auth/login');
      return;
    }

    try {
      const response = await fetch('/api/sites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          baseUrl: formData.baseUrl,
          sitemapUrl: formData.sitemapUrl || null,
        }),
      });
      if (!response.ok) throw new Error('Failed to create site');
      const newSite = await response.json();
      setSites([newSite, ...sites]);
      setShowModal(false);
      setFormData({ name: '', baseUrl: '', sitemapUrl: '' });
    } catch (error) {
      console.error('Error creating site:', error);
      alert('サイトの作成に失敗しました');
    }
  };

  // 学習開始
  const handleStartTraining = async (siteId: string) => {
    const site = sites.find((s) => s.id === siteId);
    if (!site) return;

    if (!confirm(`「${site.name}」の学習を開始しますか？`)) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push('/auth/login');
      return;
    }

    try {
      const response = await fetch('/api/train/url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          site_id: siteId,
          baseUrl: site.base_url,
          sitemapUrl: site.sitemap_url,
        }),
      });
      if (!response.ok) throw new Error('Failed to start training');
      
      // ステータスを更新
      setSites((prev) =>
        prev.map((s) =>
          s.id === siteId ? { ...s, status: 'training' as const } : s
        )
      );
      setTrainingSites((prev) => new Set(prev).add(siteId));
      
      // 5秒後に再取得
      setTimeout(() => fetchSites(), 5000);
    } catch (error) {
      console.error('Error starting training:', error);
      alert('学習の開始に失敗しました');
    }
  };

  // サイト削除
  const handleDeleteSite = async (siteId: string) => {
    const site = sites.find((s) => s.id === siteId);
    if (!site) return;

    if (!confirm(`「${site.name}」を削除しますか？\n関連するデータもすべて削除されます。`)) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push('/auth/login');
      return;
    }

    try {
      const response = await fetch(`/api/sites/${siteId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to delete site');
      setSites((prev) => prev.filter((s) => s.id !== siteId));
    } catch (error) {
      console.error('Error deleting site:', error);
      alert('サイトの削除に失敗しました');
    }
  };

  // ステータスバッジのスタイル
  const getStatusBadge = (status: Site['status']) => {
    const styles = {
      idle: 'bg-gray-100 text-gray-800',
      training: 'bg-blue-100 text-blue-800 animate-pulse',
      ready: 'bg-green-100 text-green-800',
      error: 'bg-red-100 text-red-800',
    };
    const labels = {
      idle: '未学習',
      training: '学習中',
      ready: '準備完了',
      error: 'エラー',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  // 日付フォーマット
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ja-JP');
  };

  if (authLoading || loading) {
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
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">ダッシュボード</h1>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.push('/auth/login');
              }}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              ログアウト
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              + 新規サイト登録
            </button>
          </div>
        </div>

        {sites.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-500 mb-4">登録されているサイトがありません</p>
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
            >
              最初のサイトを登録する
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sites.map((site) => (
              <div
                key={site.id}
                className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">{site.name}</h2>
                  {getStatusBadge(site.status)}
                </div>

                <div className="space-y-2 mb-4 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">URL:</span>{' '}
                    <a
                      href={site.base_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline break-all"
                    >
                      {site.base_url}
                    </a>
                  </div>
                  {site.last_trained_at && (
                    <div>
                      <span className="font-medium">最終学習:</span>{' '}
                      {formatDate(site.last_trained_at)}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  {site.status === 'ready' && (
                    <Link
                      href={`/dashboard/${site.id}`}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-center text-sm font-medium"
                    >
                      チャット開始
                    </Link>
                  )}
                  {site.status === 'idle' && (
                    <button
                      onClick={() => handleStartTraining(site.id)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      学習開始
                    </button>
                  )}
                  {site.status === 'training' && (
                    <button
                      disabled
                      className="flex-1 bg-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium cursor-not-allowed"
                    >
                      学習中...
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteSite(site.id)}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 新規サイト登録Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold mb-4">新規サイト登録</h2>
              <form onSubmit={handleCreateSite}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      サイト名 *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="例: STRIX 総合型選抜塾"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ベースURL *
                    </label>
                    <input
                      type="url"
                      required
                      value={formData.baseUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, baseUrl: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      サイトマップURL（オプション）
                    </label>
                    <input
                      type="url"
                      value={formData.sitemapUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, sitemapUrl: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://example.com/sitemap.xml"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setFormData({ name: '', baseUrl: '', sitemapUrl: '' });
                    }}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-medium"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
                  >
                    登録
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

