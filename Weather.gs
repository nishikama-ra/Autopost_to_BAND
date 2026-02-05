/**
 * 定期実行用
 */
function triggerWeather() {
  postWeatherToBand();
}

/**
 * スマホのブラウザからアクセスされた時に実行される
 */
function doGet() {
  try {
    // 天気予報の投稿処理を実行
    postWeatherToBand();
    
    // 成功時にスマホ画面に表示するメッセージ
    return HtmlService.createHtmlOutput(
      '<html><body style="text-align:center;padding-top:50px;font-family:sans-serif;">' +
      '<h2>✅ 天気予報を投稿しました</h2>' +
      '<p>BANDを確認してください。</p>' +
      '<button onclick="window.close()" style="padding:10px 20px;font-size:16px;">閉じる</button>' +
      '</body></html>'
    );
  } catch (e) {
    return HtmlService.createHtmlOutput('<h2>❌ エラー発生</h2><p>' + e.toString() + '</p>');
  }
}

/**
 * 指定座標の3時間おき予報をBANDに投稿する（リトライ＋エラーメール通知版）
 */
function postWeatherToBand() {
  const startTime = new Date().getTime();
  const conf = CONFIG.WEATHER_CONFIG;
  
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${conf.LATITUDE}&longitude=${conf.LONGITUDE}&hourly=${conf.API_PARAMS}&timezone=Asia%2FTokyo`;
  
  let response;
  let success = false;
  let lastError = "";

  for (let i = 0; i < conf.MAX_RETRIES; i++) {
    const elapsed = new Date().getTime() - startTime;
    if (elapsed > conf.TIMEOUT_MS) {
      lastError = `設定された制限時間(10分)を超えたため中断しました。`;
      console.error(lastError);
      break; 
    }

    try {
      response = UrlFetchApp.fetch(url, { 'muteHttpExceptions': true });
      const resCode = response.getResponseCode();

      if (resCode === 200) {
        success = true;
        console.log(`API取得成功（試行回数: ${i + 1}回目）`);
        break; 
      } else if (resCode === 429) {
        const waitSec = Math.round((conf.WAIT_TIME_BASE + Math.random() * 10000) / 1000);
        lastError = `API制限(429)が発生中`;
        // ★ここを復活させました：ログに出すことで進捗が見えるようになります
        console.warn(`${lastError}。${waitSec}秒後にリトライします (${i + 1}/${conf.MAX_RETRIES})`);
        Utilities.sleep(waitSec * 1000);
      } else {
        throw new Error(`APIエラー (Status: ${resCode})`);
      }
    } catch (e) {
      lastError = e.message;
      console.error(`通信エラー: ${lastError}。5秒後に再試行します。`);
      Utilities.sleep(5000);
    }
  }

  if (!success) {
    sendWeatherErrorMail(lastError);
    return;
  }

  // --- 以降の解析・投稿ロジックは変更なし ---
  try {
    const data = JSON.parse(response.getContentText());
    const hourly = data.hourly;
    const now = new Date();
    let content = `${conf.TAG}\n${conf.TITLE}\n\n`;
    let count = 0;

    for (let i = 0; i < hourly.time.length; i++) {
      const forecastTime = new Date(hourly.time[i]);
      if (forecastTime > now && count < conf.WEATHER_FORECAST_COUNT) {
        if (forecastTime.getHours() % 3 === 0) {
          const timeStr = Utilities.formatDate(forecastTime, "JST", "MM/dd HH:00");
          const temp = hourly.temperature_2m[i].toFixed(1);
          const pop = hourly.precipitation_probability[i];
          const hum = hourly.relative_humidity_2m[i];
          const wind = hourly.wind_speed_10m[i].toFixed(1);
          const dirDeg = hourly.wind_direction_10m[i];
          
          // --- 方位変換の処理 ---
          // APIから届く「0〜360度の数値」を、45度刻みで8方位（北、北東など）のインデックス(0〜7)に変換します
          const dirIdx = Math.round(dirDeg / 45) % 8;
          // CONFIGにあるWIND_DIRECTIONSから、対応する矢印とラベルを取得します
          const dirInfo = conf.WIND_DIRECTIONS[dirIdx];
          
          // 天気コードをアイコン付きの文字列に変換
          const desc = conf.WEATHER_MAP[hourly.weathercode[i]] || "❓";
          
          // --- 本文組み立て（2行の大調整版） ---
          // 1行目：時刻、天気、温度（見やすさのためスペースを調整）
          content += `${timeStr}   ${desc}   🌡️ ${temp}℃\n`;
          
          // 2行目：時刻の下を完全に空けるため、全角スペースを6つ挿入します。
          // これで「02/04 00:00」という文字幅を物理的に飛び越えます。
          content += `　　　　　　☔ ${pop}% / 💧 ${hum}% / 🚩 ${wind}m/s (${dirInfo.arrow}${dirInfo.label})\n\n`;
          
          count++;
        }
      }
    }

    postToBand(content + `---\n${conf.FOOTER}`);
    console.log("BANDへの投稿が完了しました。");
  } catch (e) {
    sendWeatherErrorMail("解析エラー: " + e.message);
  }
}

/**
 * 天気予報専用のエラー通知メール
 */
function sendWeatherErrorMail(errorMessage) {
  const recipient = CONFIG.ERROR_MAIL.TO;
  const subject = "【GAS重要】天気予報の自動投稿に失敗しました";
  const body = `

天気予報の自動投稿処理でエラーが発生しました。
5回のリトライを試みましたが、情報を取得できませんでした。

■発生したエラー内容:
${errorMessage}

■推測される原因:
・Google共有サーバーのIPアドレス制限（429エラー）
・Open-Meteo APIの一時的なダウン

この投稿はスキップされました。次回の定期実行（12時間後）に再度試行されます。
急ぎで投稿が必要な場合は、GASエディタから手動で postWeatherToBand を実行してください。
`.trim();

  try {
    MailApp.sendEmail(recipient, subject, body);
    console.log("管理者へエラー通知メールを送信しました。");
  } catch (e) {
    console.error("エラーメールの送信自体に失敗しました: " + e.message);
  }
}

function triggerWeather() {
  postWeatherToBand();
}
