# 📢 西鎌倉住宅地自治会 BAND自動投稿処理

## 📝 概要
Gmailで受信した地域防災情報や西鎌倉の天気予報を、Google Apps Script (GAS) を用いて BAND 掲示板へ自動投稿する処理です。

アクセストークンやフォルダIDなどの機密情報は、すべてGASの「スクリプトプロパティ」に保存する設計になっています。

## ⚙️ 環境設定（スクリプトプロパティ）
GASエディタの「設定（歯車アイコン）」→「スクリプトプロパティ」に以下の項目を設定してください。

| プロパティ名 | 設定内容 |
| :--- | :--- |
| `BAND_TOKEN` | BAND Developersにて発行したアクセストークン |
| `DRIVE_FOLDER_ID` | 添付画像保存用のGoogleドライブフォルダID |
| `ERROR_MAIL_TO` | システムエラー通知を受信するメールアドレス |
| `KEY_PROD_MAIN` | 【本番環境】投稿先BANDの識別キー |
| `KEY_PROD_EXTRA` | 【本番環境】特定住所検知時の転送先BANDキー |
| `KEY_TEST_MAIN` | 【テスト環境】検証用BANDの識別キー |
| `KEY_TEST_EXTRA` | 【テスト環境】検証用転送先のBANDキー |

## 🚀 実行方法

### 1. 自動実行（タイマートリガー）
以下の関数をトリガーとして設定します。
* **メール監視:** `main_ProductionRun`
* **天気予報:** `triggerWeather_Production`

### 2. 手動テスト（動作確認）
テスト環境（テスト用BAND）へ投稿を確認したい場合は、エディタ上で以下を実行します。
* **メール処理テスト:** `debug_TestRun`
* **天気予報テスト:** `debug_WeatherTest`

### 3. Webアプリ（URI実行）
デプロイ済みのWebアプリURLにパラメータを付与することで、環境の切り替えが可能です。
* **本番環境へ投稿:** `https://.../exec`
* **テスト環境へ投稿:** `https://.../exec?mode=test`

## 📂 構成ファイルおよび主要関数

### 1. `Main.gs`
* `main_ProductionRun()` / `debug_TestRun()`: 実行環境を初期化した後、メール処理を開始。
* `checkGmailAndPostToBand()`: 未読メールのスキャンおよび投稿処理。
* `createPostBody()`: 送信元ごとのルールに基づき本文を構築。

### 2. `Weather.gs`
* `triggerWeather_Production()` / `debug_WeatherTest()`: 天気予報投稿の実行。
* `doGet(e)`: WebアプリURLへのアクセスを処理。
* `postWeatherToBand()`: 気象APIから予報を取得し、BANDへ送信。

### 3. `BandHelper.gs`
* `setBandDestination(mode)`: 指定モードに基づき、宛先設定（Config）を動的に注入。
* `postToBand(content, fileUrls)`: BAND APIを用いた投稿。
* `uploadFileToDrive(blob)`: 添付ファイルをドライブへ保存。

### 4. `Tool.gs`
* `getBandList()`: 連携可能なBANDの名称とキーをログに出力。

### 5. `Announce.gs` / `Config.gs`
* `Announce.gs`: 外部公開・審査用のポータル画面表示用。
* `Config.gs`: 投稿ルール、ハッシュタグ、および住所フィルタの定義。

---
**Contact:**
[itpromotion@nishikamakura-jichikai.com](mailto:itpromotion@nishikamakura-jichikai.com)
