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

  // リトライ設定
  BAND_POST_CONTROL: {
    MAX_ATTEMPTS: 3,        // 合計試行回数（1回目 + リトライ2回）
    RETRY_WAIT_MS: 10000,   // 1003エラー（混雑）検知時の待機時間（10秒）
    ENDPOINT: 'https://openapi.band.us/v2.2/band/post/create'
  },


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
      criticalKeywords: ['運休', '見合わせ', '折返し運転', '運転再開', '直通運転を中止', '全列車各駅停車']
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
    TITLE: "【西鎌倉 天気予報の自動投稿です】",
    TAG: "#天気予報",
    FOOTER: "凡例: 🌡️気温 / ☔降水確率 / 💧湿度 / 🚩風速(風向)\n地点: 西鎌倉交差点付近 (北緯35.322356/東経139.502873)\n提供: OpenWeatherMap",
    WEATHER_FORECAST_COUNT: 12,
    
    // 実行制御（10分で見切り、1分弱でリトライ）
    TIMEOUT_MS: 600000, 
    MAX_RETRIES: 12,
    WAIT_TIME_BASE: 50000,
    
  // OpenWeatherMap ID判定用（日本向け表示定義）
    WEATHER_MAP_OWM: [
      { min: 200, max: 209, emoji: "⛈️", label: "雷雨" },
      { min: 210, max: 221, emoji: "🌩️", label: "雷" },
      { min: 230, max: 299, emoji: "⛈️", label: "雷雨" },
      { min: 300, max: 399, emoji: "☂️", label: "霧雨" },
      { min: 500, max: 500, emoji: "☂️", label: "小雨" },
      { min: 501, max: 501, emoji: "☂️", label: "雨" },
      { min: 502, max: 502, emoji: "☔", label: "強い雨" },
      { min: 503, max: 503, emoji: "☔", label: "激しい雨" },
      { min: 504, max: 504, emoji: "☔", label: "猛烈な雨" },
      { min: 511, max: 511, emoji: "❄️", label: "氷雨" },
      { min: 520, max: 531, emoji: "🌧️", label: "にわか雨" },
      { min: 600, max: 600, emoji: "🌨️", label: "小雪" },
      { min: 601, max: 601, emoji: "☃️", label: "雪" },
      { min: 602, max: 602, emoji: "☃️", label: "強い雪" },
      { min: 611, max: 616, emoji: "❄️", label: "みぞれ" },
      { min: 620, max: 699, emoji: "☃️", label: "にわか雪" },
      { min: 701, max: 762, emoji: "🌫️", label: "霧" },
      { min: 771, max: 771, emoji: "⛈️", label: "スコール" },
      { min: 781, max: 781, emoji: "🌪️", label: "竜巻" },
      { min: 800, max: 800, emoji: "☀️", label: "快晴" },
      { min: 801, max: 801, emoji: "☀️", label: "晴れ" },
      { min: 802, max: 802, emoji: "⛅", label: "時々曇り" },
      { min: 803, max: 804, emoji: "☁️", label: "曇り" }
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
  },
  
  // --- 防災情報（気象庁API）設定 ---
  BOUSAI_CONFIG: {
    URL_WARNING: "https://www.jma.go.jp/bosai/warning/data/warning/140000.json",
  // XMLフィードURLをこちらに集約
    URL_FEED_EQVOL: "https://www.data.jma.go.jp/developer/xml/feed/eqvol_l.xml", 
    //URL_FEED_EQVOL: "https://www.data.jma.go.jp/developer/xml/feed/eqvol.xml", 
  
    CITY_CODE: "1420400", // 鎌倉市
    CITY_NAME: "鎌倉市",
    MIN_INTENSITY: "3",    // 投稿する最小震度
  
    PREF_NAME: "神奈川県",
    WATCH_VOLCANOES: ["富士山", "箱根山", "伊豆東部火山群", "伊豆大島" ],
    WATCH_TSUNAMI_REGION: "相模湾・三浦半島",
    //WATCH_TSUNAMI_REGION: "青森県日本海沿岸",
  
    TITLE_PREFIX: "【鎌倉市：",
    TITLE_SUFFIX: "】",
  
    MASTER: {
      "special_warnings": {
        "31": "暴風雪特別警報：命を守るための最善の行動をとってください。",
        "32": "暴風（雪）特別警報：屋外への外出は極めて危険です。",
        "33": "大雨特別警報：直ちに命を守るための最善の行動をとってください。",
        "34": "暴風特別警報：頑丈な建物内で安全を確保してください。",
        "35": "大雪特別警報：無理な外出を避け、安全を確保してください。",
        "36": "波浪特別警報：海岸付近には絶対に近づかないでください。",
        "37": "高潮特別警報：低い土地での浸水に厳重に警戒してください。"
      },
      "warnings": {
        "02": "暴風雪警報：猛ふぶきや吹きだまりによる交通障害に警戒してください。",
        "03": "大雨警報：低い土地の浸水、土砂災害に警戒してください。",
        "04": "洪水警報：河川の増水や氾濫に警戒してください。",
        "05": "暴風警報：暴風に警戒してください。",
        "06": "大雪警報：大雪による交通障害に警戒してください。",
        "07": "波浪警報：高波に警戒してください。",
        "08": "高潮警報：高潮による浸水に警戒してください。"
      },
      "advisories": {
        "10": "大雨注意報：低い土地の浸水に注意してください。",
        "12": "大雪注意報：降雪、路面凍結に注意してください。",
        "13": "風雪注意報：雪を伴う強風に注意してください。",
        "14": "雷注意報：落雷、突風、急な強い雨に注意してください。",
        "15": "強風注意報：強風による被害や火災の延焼に注意してください。",
        "16": "波浪注意報：高波に注意してください。",
        "17": "融雪注意報：融雪による浸水や土砂災害に注意してください。",
        "18": "洪水注意報：河川の増水に注意してください。",
        "19": "高潮注意報：潮位の上昇による浸水に注意してください。",
        "20": "濃霧注意報：視程障害（見通しの悪化）に注意してください。",
        "21": "乾燥注意報：火災の発生と延焼に注意してください。",
        "22": "なだれ注意報：なだれに注意してください。",
        "23": "低温注意報：水道管の凍結や農作物の被害に注意してください。",
        "24": "霜注意報：農作物の被害に注意してください。",
        "25": "着氷注意報：通信線や船体への着氷に注意してください。",
        "26": "着雪注意報：通信線や樹木への着雪に注意してください。"
      }
    }
  }
};
