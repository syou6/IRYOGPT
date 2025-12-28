import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import Link from 'next/link';
import { createSupabaseClient } from '@/utils/supabase-auth';
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { ja } from 'date-fns/locale';

interface Appointment {
  date: string;
  time: string;
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  symptom?: string;
  status: string;
  bookedVia: string;
}

interface AppointmentsResponse {
  appointments: Appointment[];
  clinic: {
    name: string;
    startTime: string;
    endTime: string;
  };
  dateRange: {
    start?: string;
    end?: string;
  };
  total: number;
}

export default function AppointmentsPage() {
  const router = useRouter();
  const { siteId } = router.query;
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AppointmentsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'today' | 'week' | 'all'>('week');
  const [includeCancel, setIncludeCancel] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const supabase = createSupabaseClient();

  const fetchAppointments = useCallback(async () => {
    if (!siteId || typeof siteId !== 'string') return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push('/auth/login');
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams({
        site_id: siteId,
        view,
        include_cancel: includeCancel.toString(),
      });

      const response = await fetch(`/api/appointments/list?${params}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch appointments');
      }

      const result: AppointmentsResponse = await response.json();
      setData(result);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching appointments:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [siteId, view, includeCancel, router, supabase]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const handleCancel = async (date: string, time: string) => {
    if (!siteId || typeof siteId !== 'string') return;
    if (!confirm('この予約をキャンセルしますか？')) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return;

    setCancelling(`${date}-${time}`);

    try {
      const response = await fetch('/api/appointments/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          site_id: siteId,
          date,
          time,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel appointment');
      }

      // 再読み込み
      await fetchAppointments();
    } catch (err: any) {
      alert('キャンセルに失敗しました: ' + err.message);
    } finally {
      setCancelling(null);
    }
  };

  // 日付でグループ化
  const groupedAppointments = data?.appointments.reduce(
    (acc, appointment) => {
      if (!acc[appointment.date]) {
        acc[appointment.date] = [];
      }
      acc[appointment.date].push(appointment);
      return acc;
    },
    {} as Record<string, Appointment[]>
  );

  if (loading && !data) {
    return (
      <Layout>
        <div className="flex min-h-screen items-center justify-center">
          <div className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-xs uppercase tracking-[0.25em] text-slate-200">
            読み込み中...
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="relative mx-auto max-w-6xl px-4 py-8 text-slate-100">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-emerald-500/20 to-transparent blur-3xl" />
        </div>

        <div className="relative space-y-6">
          {/* ヘッダー */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link
                href={`/dashboard/${siteId}`}
                className="mb-2 inline-flex items-center text-[11px] uppercase tracking-[0.35em] text-emerald-200/80"
              >
                ← サイトに戻る
              </Link>
              <h1 className="text-3xl font-semibold text-white">予約一覧</h1>
              {data?.clinic && (
                <p className="mt-1 text-slate-300">{data.clinic.name}</p>
              )}
            </div>

            {/* 表示切り替え */}
            <div className="flex gap-2">
              {(['today', 'week', 'all'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                    view === v
                      ? 'bg-gradient-to-r from-emerald-400 to-cyan-300 text-slate-900'
                      : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {v === 'today' ? '今日' : v === 'week' ? '今週' : '全件'}
                </button>
              ))}
            </div>
          </div>

          {/* フィルター */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={includeCancel}
                onChange={(e) => setIncludeCancel(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
              />
              キャンセル済みを表示
            </label>
            {data?.dateRange.start && data?.dateRange.end && (
              <span className="text-sm text-slate-400">
                {data.dateRange.start} 〜 {data.dateRange.end}
              </span>
            )}
            <span className="text-sm text-slate-400">
              {data?.total || 0}件
            </span>
          </div>

          {/* エラー表示 */}
          {error && (
            <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4">
              <p className="text-sm text-rose-100">{error}</p>
            </div>
          )}

          {/* 予約一覧 */}
          <div className="space-y-6">
            {groupedAppointments &&
              Object.entries(groupedAppointments).map(([date, appointments]) => {
                // 日付をパースして曜日を取得
                const [year, month, day] = date.split('/').map(Number);
                const dateObj = new Date(year, month - 1, day);
                const dayOfWeek = format(dateObj, 'E', { locale: ja });

                return (
                  <div
                    key={date}
                    className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden"
                  >
                    {/* 日付ヘッダー */}
                    <div className="border-b border-white/10 bg-white/5 px-6 py-4">
                      <h2 className="text-lg font-semibold text-white">
                        {date}（{dayOfWeek}）
                        <span className="ml-3 text-sm font-normal text-slate-400">
                          {appointments.length}件
                        </span>
                      </h2>
                    </div>

                    {/* 予約リスト */}
                    <div className="divide-y divide-white/5">
                      {appointments.map((appointment, idx) => (
                        <div
                          key={`${date}-${appointment.time}-${idx}`}
                          className={`flex items-center gap-4 px-6 py-4 ${
                            appointment.status === 'キャンセル'
                              ? 'opacity-50'
                              : ''
                          }`}
                        >
                          {/* 時間 */}
                          <div className="w-16 shrink-0">
                            <span className="text-lg font-semibold text-emerald-300">
                              {appointment.time}
                            </span>
                          </div>

                          {/* 患者情報 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white truncate">
                                {appointment.patientName}
                              </span>
                              {appointment.status === 'キャンセル' && (
                                <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-xs text-rose-300">
                                  キャンセル
                                </span>
                              )}
                              {appointment.bookedVia && (
                                <span className="rounded-full bg-slate-500/20 px-2 py-0.5 text-xs text-slate-400">
                                  {appointment.bookedVia}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-4 text-sm text-slate-400">
                              <span>{appointment.patientPhone}</span>
                              {appointment.patientEmail && (
                                <span className="truncate">
                                  {appointment.patientEmail}
                                </span>
                              )}
                            </div>
                            {appointment.symptom && (
                              <p className="mt-1 text-sm text-slate-300 truncate">
                                {appointment.symptom}
                              </p>
                            )}
                          </div>

                          {/* アクション */}
                          {appointment.status !== 'キャンセル' && (
                            <button
                              onClick={() =>
                                handleCancel(appointment.date, appointment.time)
                              }
                              disabled={
                                cancelling ===
                                `${appointment.date}-${appointment.time}`
                              }
                              className="shrink-0 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                            >
                              {cancelling ===
                              `${appointment.date}-${appointment.time}`
                                ? '処理中...'
                                : 'キャンセル'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

            {/* 予約がない場合 */}
            {(!groupedAppointments ||
              Object.keys(groupedAppointments).length === 0) && (
              <div className="rounded-3xl border border-dashed border-white/20 bg-white/5 p-12 text-center">
                <p className="text-slate-300">
                  {view === 'today'
                    ? '今日の予約はありません'
                    : view === 'week'
                      ? '今週の予約はありません'
                      : '予約がありません'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
