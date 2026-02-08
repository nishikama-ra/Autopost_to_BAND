/**
 * 添付ファイルをGoogleドライブに保存し、共有用URLを生成する
 */
function uploadFileToDrive(blob) {
  // blob自体が空、または必要なメソッドを持っていない場合のガード
  if (!blob || typeof blob.getName !== 'function') {
    console.warn("無効な添付ファイルデータをスキップしました");
    return null;
  }

  try {
    const folder = DriveApp.getFolderById(CONFIG.IMAGE_FOLDER_ID);
    
    // ファイル名の取得。取得できない場合はデフォルト名を使用
    let originalName = "attached_file";
    try {
      originalName = blob.getName() || "attached_file";
    } catch (e) {
      console.warn("ファイル名の取得に失敗したため、デフォルト名を使用します");
    }

    const timestamp = Utilities.formatDate(new Date(), "JST", "yyyyMMdd_HHmmss");
    const fileName = `${timestamp}_${originalName}`;
    
    const file = folder.createFile(blob);
    file.setName(fileName);
    
    // 外部閲覧権限の付与
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return file.getUrl();
  } catch (e) {
    console.error(`ドライブ保存エラー: ${e.message}`);
    return null;
  }
}

/**
 * BAND APIへ投稿内容を送信する
 */
function postToBand(content, fileUrls = []) {
  const control = CONFIG.BAND_POST_CONTROL;
  let finalContent = content;

  if (fileUrls.length > 0) {
    finalContent += "\n\n------------------\n添付資料\n" + fileUrls.join('\n');
  }

  const payload = {
    'access_token': CONFIG.BAND_ACCESS_TOKEN,
    'band_key': CONFIG.TARGET_BAND_KEY,
    'content': finalContent,
    'do_push': true
  };

  for (let i = 0; i < control.MAX_ATTEMPTS; i++) {
    try {
      const response = UrlFetchApp.fetch(control.ENDPOINT, {
        'method': 'post',
        'payload': payload,
        'muteHttpExceptions': true
      });

      const resText = response.getContentText();
      const json = JSON.parse(resText);

      if (json.result_code === 1) {
        return true;
      } 
      
      if (json.result_code === 1003 && i < control.MAX_ATTEMPTS - 1) {
        console.warn(`⚠️ BAND API衝突(1003)を検知。${control.RETRY_WAIT_MS / 1000}秒後にリトライします (${i + 1}/${control.MAX_ATTEMPTS})`);
        Utilities.sleep(control.RETRY_WAIT_MS);
        continue;
      }

      throw new Error(`コード=${json.result_code}, 内容=${resText}`);

    } catch (e) {
      if (i === control.MAX_ATTEMPTS - 1) {
        console.error(`BAND APIエラー: ${e.message}`);
        return false;
      }
      Utilities.sleep(control.RETRY_WAIT_MS);
    }
  }
}

/**
 * 特定住所検知時に別のBANDへ投稿する専用関数（文言加工なし版）
 */
function postToExtraBand(content, fileUrls = []) {
  const control = CONFIG.BAND_POST_CONTROL;
  let finalContent = content;

  if (fileUrls.length > 0) {
    finalContent += "\n\n------------------\n添付資料\n" + fileUrls.join('\n');
  }

  const payload = {
    'access_token': CONFIG.BAND_ACCESS_TOKEN,
    'band_key': CONFIG.EXTRA_BAND_KEY,
    'content': finalContent,
    'do_push': true
  };

  for (let i = 0; i < control.MAX_ATTEMPTS; i++) {
    try {
      const response = UrlFetchApp.fetch(control.ENDPOINT, {
        'method': 'post',
        'payload': payload,
        'muteHttpExceptions': true
      });

      const resText = response.getContentText();
      const json = JSON.parse(resText);

      if (json.result_code === 1) {
        console.log("★成功：別BANDへの転送投稿が完了しました。");
        return;
      }
      
      if (json.result_code === 1003 && i < control.MAX_ATTEMPTS - 1) {
        console.warn(`⚠️ 転送投稿で制限(1003)発生。リトライします。`);
        Utilities.sleep(control.RETRY_WAIT_MS);
        continue;
      }

      throw new Error(`コード=${json.result_code}, 内容=${resText}`);

    } catch (e) {
      if (i === control.MAX_ATTEMPTS - 1) {
        console.error(`★失敗：別BAND投稿エラー: ${e.message}`);
        return;
      }
      Utilities.sleep(control.RETRY_WAIT_MS);
    }
  }
}

/**
 * 実行モード（本番/テスト）に応じて宛先キーをConfigにセットする
 * @param {string} mode - 'PROD' または 'TEST'
 */
function setBandDestination(mode) {
  const props = PropertiesService.getScriptProperties();
  if (mode === 'PROD') {
    CONFIG.TARGET_BAND_KEY = props.getProperty('KEY_PROD_MAIN');
    CONFIG.EXTRA_BAND_KEY = props.getProperty('KEY_PROD_EXTRA');
  } else {
    CONFIG.TARGET_BAND_KEY = props.getProperty('KEY_TEST_MAIN');
    CONFIG.EXTRA_BAND_KEY = props.getProperty('KEY_TEST_EXTRA');
  }

  if (!CONFIG.TARGET_BAND_KEY) {
    throw new Error(`設定エラー: モード ${mode} の宛先キーがプロパティに見つかりません。`);
  }
}
