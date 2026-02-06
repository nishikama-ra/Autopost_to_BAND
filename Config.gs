const CONFIG = {
  // --- 接続情報 ---
  // プロパティ「BAND_TOKEN」から取得
  BAND_ACCESS_TOKEN: PropertiesService.getScriptProperties().getProperty('BAND_TOKEN'),
  
  // 実行時に注入されるため空でOK
  TARGET_BAND_KEY: '',  
  EXTRA_BAND_KEY: '',   

  // --- 添付ファイルフォルダID（プロパティから取得） ---
  IMAGE_FOLDER_ID: PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID'),
  
  MAX_THREADS_PER_RUN: 15,
  // --- タグ定義 ---
  TAGS: {
    BOUHAN: '#防犯',
    TRAIN: '#鉄道運行情報',
    NONE: null
  },

  // --- 投稿本文の装飾ルール ---
  RULES: {
    KAMAKURA: {
      customHeader: '【鎌倉市防災・安全情報メールからの自動投稿です】',
      cutOffString: '登録の変更・解除は下記ページ'
    },
    POLICE: {
      customHeader: '【ピーガルくん安全メールからの自動投稿です】',
      cutOffString: '※※※※※※※※※※'
    },
    JORUDAN: {
      customHeader: '【ジョルダン運行情報からの自動投稿です】',
      cutOffString: 'メール設定変更・配信解除'
    },
    YAHOO: {
      customHeader: '【Yahoo!路線情報からの自動投稿です】',
      startAfter: 'さん', 
      cutOffString: 'このメールに返信されても', // ここから一旦カットするが…
      keepFrom: 'Copyright'                   // この文字列がある行以降は「救出」して残す
    },
    GENERAL: {
      customHeader: '【自動投稿メールです】',
      cutOffString: null
    }
  },

  // --- メールフィルタ設定 ---
  // 送信元アドレスをキーにして、個別のフィルタ条件を定義します
  MAIL_FILTERS: {
     'alerts-transit@mail.yahoo.co.jp': {
      isYahooTransit: true, // Yahoo特有の広告除去ロジックを有効化
      priorityRoutes: ['湘南モノレール', '江ノ島電鉄'], // 監視したい路線を追加
      criticalKeywords: ['運休', '見合わせ', '折返し運転', '運転再開']
    }
  },
  
  // --- 送信元アドレスと適応ルールの紐付け ---
  SENDERS: {
    'kamakura@sg-p.jp': ['KAMAKURA', 'BOUHAN'],
    'oshirase@kodomoanzen.police.pref.kanagawa.jp': ['POLICE', 'BOUHAN'],
    'alerts-transit@mail.yahoo.co.jp': ['YAHOO', 'TRAIN']
  },

// --- 追加：特定の住所が含まれる場合の転送先設定 ---
  EXTRA_POST_CONFIG: {
  // ※キーは上部の「EXTRA_BAND_KEY」を参照
    ENABLED_SENDERS: ['oshirase@kodomoanzen.police.pref.kanagawa.jp'],
    WATCH_ADDRESSES: [
      // 腰越地区
      '鎌倉市西鎌倉', '鎌倉市腰越', '鎌倉市津', '鎌倉市津西', '鎌倉市七里ガ浜', '鎌倉市七里ガ浜東',
      // 深沢地区
      '鎌倉市鎌倉山', '鎌倉市手広', '鎌倉市梶原', '鎌倉市寺分', '鎌倉市笛田', '鎌倉市常盤', '鎌倉市上町屋', '鎌倉市山崎',
      // 片瀬地区
      '藤沢市片瀬山', '藤沢市片瀬目白山', '藤沢市片瀬', '藤沢市片瀬海岸', '藤沢市江の島'
    ]
  },

  // --- エラー通知メール設定 ---
  ERROR_MAIL: {
    // 宛先をプロパティ「ERROR_MAIL_TO」から取得
    TO: PropertiesService.getScriptProperties().getProperty('ERROR_MAIL_TO'),
    SUBJECT: '【GASエラー通知】Gmail to BAND連携',
    TEMPLATE: `
■発生したエラー:
{errorMessage}

■対象メールの情報:
・受信日時: {date}
・件名: {subject}
・送信元: {sender}

■状況:
このメールは投稿に失敗したため、Gmail上で【未読】のまま保留されています。
エラー原因（API制限など）が解消されれば、次回の実行時に再度処理されます。
`.trim()
  },

// --- 天気予報設定 ---
// LATITUDE: "35.322356",
// LONGITUDE: "139.502873",
  WEATHER_CONFIG: {
    LATITUDE: "35.322356",
    LONGITUDE: "139.502873",
    TITLE: "【西鎌倉 3時間おき天気予報】",
    TAG: "#天気予報",
    FOOTER: "凡例: 🌡️気温 / ☔降水確率 / 💧湿度 / 🚩風速(風向)\n地点: 西鎌倉交差点付近 (北緯35.322356/東経139.502873) / 提供: OpenWeatherMap",
    WEATHER_FORECAST_COUNT: 12,
    
    // 実行制御（10分で見切り、1分弱でリトライ）
    TIMEOUT_MS: 600000, 
    MAX_RETRIES: 12,
    WAIT_TIME_BASE: 50000,
    
    // OpenWeatherMap ID判定用（日本向け表示定義）
    WEATHER_MAP_OWM: [
      { min: 200, max: 299, emoji: "⛈️", label: "雷雨" },
      { min: 300, max: 399, emoji: "☔", label: "弱い雨" },
      { min: 500, max: 501, emoji: "🌦️", label: "小雨" },
      { min: 502, max: 531, emoji: "☔", label: "雨" },
      { min: 600, max: 699, emoji: "❄️", label: "雪" },
      { min: 700, max: 799, emoji: "🌫️", label: "霧" },
      { min: 800, max: 800, emoji: "☀️", label: "快晴" },
      { min: 801, max: 801, emoji: "🌤️", label: "晴れ" },
      { min: 802, max: 804, emoji: "☁️", label: "曇り" }
    ],

    // 方位の定義
    WIND_DIRECTIONS: [
      { label: "北", arrow: "⬇️" },
      { label: "北東", arrow: "↙️" },
      { label: "東", arrow: "⬅️" },
      { label: "南東", arrow: "↖️" },
      { label: "南", arrow: "⬆️" },
      { label: "南西", arrow: "↗️" },
      { label: "西", arrow: "➡️" },
      { label: "北西", arrow: "↘️" }
    ]
  }
};
