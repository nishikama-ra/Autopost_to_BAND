# Gmail to BAND Announce Bot

Google Apps Script (GAS) を使用して、**Gmailで受信した特定のメールを BAND 掲示板へ自動投稿**する連携システムです。

## 🌟 主な機能

* **自動転送:** 指定した送信元からの未読メールを検出し、BAND掲示板に投稿します。
* **ルールベースの加工:** 送信元ごとにカスタムヘッダーの追加や、不要なフッター文字列の自動カットが可能です。
* **ハッシュタグ対応:** 投稿時に `#防犯` などのタグを自動で付与できます。
* **添付ファイル対応:** メールの添付ファイルを Google ドライブに自動保存し、共有用URLを生成して投稿に記載します。

## ⚙️ セットアップ手順

### 1. BAND API の準備
1. [BAND Developers](https://developers.band.us/) で `Access Token` を取得します。
2. `BandHelper.gs` 内の `getBandList()` 関数を実行し、ログから投稿先 BAND の `band_key` を確認します。

### 2. GAS の設定
1. `Config_sample.gs` をコピーして `Config.gs` を作成します。
2. 以下の項目を自身の環境に合わせて書き換えます：
   - `BAND_ACCESS_TOKEN`: 取得したトークン
   - `TARGET_BAND_KEY`: 投稿先のキー
   - `IMAGE_FOLDER_ID`: 添付ファイルを保存するGoogleDriveのフォルダID
   - `SENDERS`: 送信元アドレスと適応するルールの紐付け（フッタ先頭文字、BAND投稿に設定するタグ）

### 3. トリガー設定
1. GAS エディタの「トリガー」から、`checkGmailAndPostToBand` 関数を時間主導型（5分〜15分おき等）で実行するように設定します。

## 🛠 カスタマイズ (Config.gs)

メールの加工ルールは `RULE_` オブジェクトで定義します。

```javascript
const RULE_EXAMPLE = {
  customHeader: '【自動投稿】',
  cutOffString: '--- 配信停止はこちら ---' // この文字以降を削除
};
