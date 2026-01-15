/**
 * 認証情報、定数、および投稿ルールの定義
 */

// --- タグの定数定義 ---
const TAG_BOUHAN = '#防犯';
const TAG_NOTAGS = null; // タグを付けない設定

// --- 投稿ルールの定義 ---
const RULE_KAMAKURA = {
  customHeader: '【鎌倉市防災・安全情報メールからの自動投稿です】',
  cutOffString: '登録の変更・解除は下記ページ'
};

const RULE_POLICE = {
  customHeader: '【ピーガルくん安全メールからの自動投稿です】',
  cutOffString: '※※※※※※※※※※'
};

const RULE_GENERAL = {
  customHeader: '【自動投稿メールです】'
};

const CONFIG = {
  // BAND DevelopersのMyAPIで取得したアクセストークン
  BAND_ACCESS_TOKEN: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  // 投稿先のBANDのキー（BandHelper.gsのgetBandList関数で取得可能）
  TARGET_BAND_KEY: 'XXXXXXXXXXXXXXXXXXXXXXXX', 
  // 添付ファイルがあった際の格納先GoogleDriveのフォルダ  
  IMAGE_FOLDER_ID: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',

  // 1回の実行で処理する最大スレッド数（GASの6分制限対策）
  MAX_THREADS_PER_RUN: 15,
  
  // 送信元メールアドレスに対し、[ルール, タグ] の形式で設定
  SENDERS: {
    'XXXXXX@XXXX.XXX': [RULE_KAMAKURA, TAG_BOUHAN],
    'XXXXXX@XXXX.XXX': [RULE_POLICE, TAG_BOUHAN],
    'XXXXXX@XXXX.XXX': [RULE_GENERAL, TAG_BOUHAN],
  }
};
