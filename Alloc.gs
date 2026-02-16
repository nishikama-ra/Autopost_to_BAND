/**
 * Webアプリの入り口（共通ルーター）
 * typeパラメータにより機能を振り分け、modeにより本番/テストを切り替える
 */
function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const type = params.type || '';
  const modeParam = params.mode || '';

  // 1. 有効なタイプ一覧
  if (!['weather', 'email', 'bousai', 'announce'].includes(type)) {
    // Portal.gs 内の関数を呼び出し（認証画面またはシステム説明を表示）
    return renderAnnouncePortal(e);
  }

  // 2. modeを判定して宛先を切り替える
  let mode = (modeParam === 'test') ? 'TEST' : 'PROD';
  
  try {
    setBandDestination(mode);
    const label = (mode === 'TEST') ? '🛠️ 【テスト】' : '✅ 【本番】';

    if (type === 'weather') {
      postWeatherToBand();
      return HtmlService.createHtmlOutput(`<h2>${label} 天気予報を投稿しました</h2>`);
    } else if (type === 'email') {
      checkGmailAndPostToBand();
      return HtmlService.createHtmlOutput(`<h2>${label} 受信メールを確認・投稿しました</h2>`);
    } else if (type === 'bousai') {
      checkJmaAndPostToBand();
      return HtmlService.createHtmlOutput(`<h2>${label} 防災情報を確認・投稿しました</h2>`);
    } else if (type === 'announce') {
      // MonthlyAnnounce.gs 内の関数を呼び出し
      MonthlySecPostToBand();
      return HtmlService.createHtmlOutput(`<h2>${label} お知らせを投稿しました</h2>`);
    }
  } catch (err) {
    console.error(err.toString());
    return HtmlService.createHtmlOutput(`<h2>❌ エラーが発生しました</h2><p>${err.toString()}</p>`);
  }
}

// ============================================================
// 【検証用】テスト実行関数群
// ============================================================

function test_Email() {
  setBandDestination('TEST');
  console.log("🛠️ テストモード：受信メール（運行・防犯等）のチェックを開始します");
  checkGmailAndPostToBand();
}

function test_Weather() {
  setBandDestination('TEST');
  console.log("🛠️ テストモード：天気予報の投稿を開始します");
  postWeatherToBand();
}

function test_Bousai() {
  setBandDestination('TEST');
  console.log("🛠️ テストモード：防災情報の監視を開始します");
  checkJmaAndPostToBand();
}

function test_DailyBousai() {
  setBandDestination('TEST');
  console.log("🛠️ テストモード：防災定期通知（全量）を確認します");
  postDailyWeatherSummary();
}

function test_Announce() {
  setBandDestination('TEST');
  console.log("🛠️ テストモード：定期お知らせ投稿を開始します");
  MonthlySecPostToBand();
}

function test_Announce_MonthlyAll() {
  // 1. テスト用MAIN（KEY_TEST_MAIN）への投稿
  setBandDestination('TEST');
  console.log("🛠️ テストモード：[テスト用MAIN] へのお知らせ投稿を開始します");
  MonthlySecPostToBand();
  
  // 2. テスト用EXTRAへの投稿
  const extraBandKey = PropertiesService.getScriptProperties().getProperty('KEY_TEST_EXTRA');
  if (extraBandKey) {
    console.log("ℹ️ 20秒待機後、テスト用EXTRAへの連続投稿を行います...");
    Utilities.sleep(20000); 
    CONFIG.TARGET_BAND_KEY = extraBandKey;
    console.log("🛠️ テストモード：[テスト用EXTRA] へのお知らせ投稿を開始します");
    MonthlySecPostToBand();
  }
}

// ============================================================
// 【実働用】本番実行・トリガー用関数群
// ============================================================

function run_Email() {
  setBandDestination('PROD');
  console.log("✅ 本番モード：受信メール（運行・防犯等）のチェックを開始します");
  checkGmailAndPostToBand();
}

function run_Weather() {
  setBandDestination('PROD');
  console.log("✅ 本番モード：天気予報の投稿を開始します");
  postWeatherToBand();
}

function run_Bousai() {
  setBandDestination('PROD');
  console.log("✅ 本番モード：防災情報の監視を開始します");
  checkJmaAndPostToBand();
}

function run_DailyBousai() {
  setBandDestination('PROD');
  console.log("✅ 本番モード：防災定期通知（全量）を開始します");
  postDailyWeatherSummary();
}

function run_Announce() {
  setBandDestination('PROD');
  console.log("✅ 本番モード：定期お知らせ投稿を開始します");
  MonthlySecPostToBand();
}

function run_Announce_MonthlyAll() {
  // 1. MAINのBAND（KEY_PROD_MAIN）への投稿
  setBandDestination('PROD');
  console.log("✅ 本番モード：[MAIN] へのお知らせ投稿を開始します");
  MonthlySecPostToBand();
  
  // 2. EXTRAのBAND（KEY_PROD_EXTRA）への投稿
  const extraBandKey = PropertiesService.getScriptProperties().getProperty('KEY_PROD_EXTRA');
  if (extraBandKey) {
    console.log("ℹ️ 20秒待機後、EXTRA(本体)への連続投稿を行います...");
    Utilities.sleep(20000); 
    CONFIG.TARGET_BAND_KEY = extraBandKey; 
    console.log("✅ 本番モード：[EXTRA(本体)] へのお知らせ投稿を開始します");
    MonthlySecPostToBand();
  } else {
    console.warn("⚠️ EXTRA(本体)のキーが見つからないためスキップしました");
  }
}
