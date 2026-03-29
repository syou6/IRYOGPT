# Research: nodriver / zendriver / SeleniumBase UC Mode
# VPSでサロンボードを定期スクレイピングする用途向け調査

## 調査日: 2026-03-29

---

## 1. nodriverの基本情報

- **PyPI最新版**: 0.48.1（2025年11月9日リリース）
- **GitHub Stars**: 3.9k
- **開発状況**: Alphaステータス（公式宣言）
- **ライセンス**: GNU AGPL
- **作者**: ultrafunkamsterdam（undetected-chromedriverと同一作者）
- **アーキテクチャ**: WebDriver/Seleniumを廃し、Chrome DevTools Protocol（CDP）で直接通信
- **非同期**: asyncio完全対応（asyncioネイティブ）

---

## 2. headless VPSでの動作

### headless=True の現状
- **動作しない**。brightdata記事: "NODRIVER throws an error when running in headless mode"
- Issue #2182（2025/04）: headless=True で RecursionError（無限ループ）
  - `Tab.send() → _prepare_headless() → _send_oneshot() → send()` の循環
  - v0.46.1（2025/05/16）で修正済み
- Issue #2120: headless=True で TypeError（Chrome 132）
- Issue #1848: headless=True にすると検知される

### headless=False + Xvfb の現状
- 公式ドキュメントでも「headless machineではXvfbを使うことを推奨」と明記
- Xvfb + headless=False の組み合わせは動作報告あり
- ただし VPS の datacenter IP 自体が検知される問題がある（Issue #2249）

### VPSでbot検知される別の理由
- データセンターIPはCloudflareやDataDomeに「既知のVPS IP」として認識される
- 作者自身がコメント: "Datacenter IPs are all known by these protections"
- Dockerコンテナでは全コンテナがホストの同一IPを共有し、さらに検知されやすい

---

## 3. bot検知回避の実態

### Cloudflare
- 「多くの場合は自動でバイパスできる」と公式ドキュメント
- ただしcf_verify()はOpenCV依存、英語のみ対応
- 検証: Substack記事（The Web Scraping Club）では実際のテスト結果はペイウォール内
- 2025年時点でZendriveとの比較ではnodriver 25% vs zendriver 75%の成功率という報告あり

### VPSからの検知回避
- ローカル環境では動いてもVPSでは検知される報告が多数
- datacenter IPブロックが根本原因
- 住宅用プロキシ（residential proxy）を使うと大幅に改善する可能性

### サロンボード(salonboard.com)
- Cloudflareは使っていない可能性が高い（独自ログイン画面）
- 日本のサービスのため独自セキュリティ
- 2.5〜4分間隔のアクセスは「緩やかなレート」なので検知リスクは相対的に低い

---

## 4. async/awaitネイティブ

- 完全asyncio対応: `asyncio.gather()`で複数タブ同時操作可能
- FastAPI/uvicornとの共存: 可能だが注意が必要（イベントループ競合）
  - FastAPIはuvicornが管理するイベントループ上で動く
  - nodriverも独自にイベントループを使う
  - 解決策: `asyncio.create_task()`でバックグラウンドタスクとして実行
- 複数ブラウザ同時起動: 可能

---

## 5. 安定性・メンテナンス

### nodriver本体
- PyPI最終更新: 2025/11/09（v0.48.1）
- GitHubのissue対応: 遅い（PR放置が多い）
- issue trackerはほぼ閉鎖状態（undetected-chromedriverのリポジトリに混在）
- Chrome最新版への追従: 概ね対応しているが、メジャーバージョンアップ時に一時的なバグあり

### zendriver（nodriverのfork）
- GitHub Stars: 1.2k（2026年時点）
- 最新版: v0.15.3（2026年3月12日）
- 40リリース、325コミット
- open issues: 69
- nodriverの未マージPRを取り込んでいる
- Dockerサポートあり（zendriver-docker）
- 開発活発度はnodriverより明らかに高い

---

## 6. 既知の制約・落とし穴

### メモリリーク
- 長時間稼働でメモリ増加（10GB/8時間の報告あり）
- browser.stop()が確実に動かない場合がある
- 回避策: psutilやos.killで明示的にプロセスをkill

### Cookie/セッション管理
- `browser.cookies.save()` / `browser.cookies.load()` が存在する
- `user_data_dir`を指定することでプロファイル永続化も可能
- Issue #1817: 使い方を間違えると動かないが、正しく使えば「perfectly and smooth」
- ログイン→Cookie保存→再利用のパターン: 可能

### プロキシ
- プロキシサポートが弱い（create_context()が不安定）
- brightdata: "Proxy support for NODRIVER is limited at best"

### その他
- 属性取得APIが変更予定
- mouse_click()等の一部メソッドが動作しない場合あり
- fingerprint固定問題（毎回同じcanvas fingerprintになる）

---

## 7. 三者比較

| 項目 | nodriver | zendriver (fork) | SeleniumBase UC Mode |
|------|----------|------------------|----------------------|
| headless=True | バグあり（修正済みv0.46.1+） | 同上 | 使用不可 |
| headless VPS | Xvfb必要 | Xvfb/Docker対応 | Xvfb必要 |
| bot検知回避 | 25% | 75% | Cloudflareは弱い |
| async | ネイティブ | ネイティブ | 非対応（同期） |
| メンテナンス | やや停滞 | 活発 | 非常に活発 |
| Cloudflare bypass | 部分的 | 部分的 | 部分的 |
| Docker対応 | なし | 公式対応 | 限定的 |
| Stars | 3.9k | 1.2k | 10k+ |
| Cookie管理 | あり（バグ注意） | 改善版 | あり |
| プロキシ | 弱い | 改善版 | 普通 |
| 日本語サイト | 問題なし | 問題なし | 問題なし |

---

## 8. 結論・推薦

用途: Ubuntu VPS（画面なし）でサロンボードを2.5〜4分間隔でスクレイピング

### 推薦: zendriver + Xvfb（headless=False）

理由:
1. nodriverより活発にメンテナンスされている
2. nodriverの既知バグ（headlessの再帰エラー等）が修正済み
3. Docker + Wayland仮想ディスプレイの公式サポートあり
4. asyncioネイティブでFastAPIとの統合に適している
5. Cookie保存/読み込みによるセッション再利用が可能
6. サロンボードはCloudflareを使っていない可能性が高く、bot検知ハードルが低い

### サロンボード向け具体的アーキテクチャ

1. 初回: zendriverで手動ログイン → cookies.save()
2. 定期実行: Xvfb起動 → zendriver起動 → cookies.load() → ページアクセス
3. メモリ対策: 10〜20回に1回ブラウザを再起動
4. スケジューラ: APScheduler（asyncioベース）を使用

### 注意事項
- VPSのIPがブロックされる可能性: 住宅用プロキシの検討を
- headless=Trueは使わない（検知・バグのリスク）
- Docker環境ではさらに検知リスクが上がる（bare metalが望ましい）
