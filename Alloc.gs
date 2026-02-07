/**
 * Webアプリの入り口（共通ルーター）
 * typeパラメータにより機能を振り分け、modeにより本番/テストを切り替える
 * 不明なパラメータ時は安全のため実処理を介さずポータル画面を表示する
 */
function doGet(e) {
  const params = e && e.parameter ?
  e.parameter : {};
  const type = params.type || '';
  const modeParam = params.mode || '';
  // 1. typeが正しく指定されていない場合は、認可コードの有無を含めAnnounce.gsに判定を委ねる
  if (type !== 'weather' && type !== 'pollen' && type !== 'traffic' && type !== 'announce') {
    return renderAnnouncePortal(e);
  }

  // 2. typeが正当な場合のみ、modeを判定して宛先を切り替える
  let mode = 'PROD';
  if (modeParam === 'test') {
    mode = 'TEST';
  }
  
  try {
    setBandDestination(mode);
    const label = (mode === 'TEST') ?
    '🛠️ 【テスト】' : '✅ 【本番】';

    if (type === 'weather') {
      postWeatherToBand();
      return HtmlService.createHtmlOutput(`<h2>${label} 天気予報を投稿しました</h2>`);
    } else if (type === 'traffic') {
      checkGmailAndPostToBand();
      return HtmlService.createHtmlOutput(`<h2>${label} 鉄道運行情報を確認・投稿しました</h2>`);
    } else if (type === 'bousai') {
      checkJmaAndPostToBand();
      return HtmlService.createHtmlOutput(`<h2>${label} 防災情報を確認・投稿しました</h2>`);
    } else if (type === 'announce') {
      MonthlySecPostToBand();
      return HtmlService.createHtmlOutput(`<h2>${label} お知らせを投稿しました</h2>`);
    } 
  } catch (err) {
    return HtmlService.createHtmlOutput(`<h2>❌ エラー</h2><p>${err.toString()}</p>`);
  }
}

// --- 以下、各ファイルから集約したトリガー・デバッグ用関数 ---

/**
 * 【本番用】メール投稿トリガー
 */
function main_ProductionRun() {
  setBandDestination('PROD');
  console.log("ℹ️ 本番モードでメール処理を開始します");
  checkGmailAndPostToBand();
}

/**
 * 【テスト用】メール投稿デバッグ
 */
function debug_TestRun() {
  setBandDestination('TEST');
  console.log("🛠️ テストモードでメール処理を開始します");
  checkGmailAndPostToBand();
}

/**
 * 【本番用】天気予報トリガー
 */
function triggerWeather_Production() {
  setBandDestination('PROD');
  console.log("ℹ️ 本番モードで天気予報処理を開始します");
  postWeatherToBand();
}

/**
 * 【テスト用】天気予報デバッグ
 */
function debug_WeatherTest() {
  setBandDestination('TEST');
  console.log("🛠️ テストモードで天気予報処理を開始します");
  postWeatherToBand();
}


/**
 * 【本番用】防災情報（気象庁API）監視トリガー
 */
function bousai_ProductionRun() {
  setBandDestination('PROD');
  console.log("ℹ️ 本番モードで防災情報収集処理を開始します");
  checkJmaAndPostToBand();
}

/**
 * 【テスト用】防災情報（気象庁API）動作確認
 */
function bousai_TestRun() {
  setBandDestination('TEST');
  console.log("🛠️ テストモードで防災情報収集処理を開始します");
  checkJmaAndPostToBand();
}

/**
 * 【本番用】定期お知らせ投稿トリガー
 */
function triggerAnnounce_Production() {
  setBandDestination('PROD');
  console.log("ℹ️ 本番モードでお知らせ投稿処理を開始します");
  MonthlySecPostToBand();
}

/**
 * 【テスト用】定期お知らせ投稿デバッグ
 */
function debug_AnnounceTest() {
  setBandDestination('TEST');
  console.log("🛠️ テストモードでお知らせ投稿処理を開始します");
  MonthlySecPostToBand();
}

/**
 * 【月次トリガー用】「周辺情報」と「住宅地」の両方のBANDにお知らせを投稿
 */
function triggerAnnounce_MonthlyProduction() {
  // 1. 「周辺情報」BAND（KEY_PROD_MAIN）への投稿
  setBandDestination('PROD');
  console.log("ℹ️ 「周辺情報」BANDへのお知らせ投稿を開始します");
  MonthlySecPostToBand();
  
  // 連続投稿による制限を避けるため20秒待機
  console.log("20秒待機中...");
  Utilities.sleep(20000);
  
  // 2. 「住宅地」BAND（KEY_PROD_EXTRA）への投稿
  // setBandDestination('PROD')を実行すると CONFIG.TARGET_BAND_KEY に MAIN が入るため
  // ここでは明示的に EXTRA のキーをセットして呼び出します
  const subBandKey = PropertiesService.getScriptProperties().getProperty('KEY_PROD_EXTRA');
  if (subBandKey) {
    CONFIG.TARGET_BAND_KEY = subBandKey;
    console.log("ℹ️ 「住宅地」BANDへのお知らせ投稿を開始します");
    MonthlySecPostToBand();
  } else {
    console.warn("⚠️ 「住宅地」BANDのキー（KEY_PROD_EXTRA）が見つからないため、投稿をスキップしました");
  }
}
