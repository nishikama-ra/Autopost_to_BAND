/**
 * 【本番用】タイマートリガーにはこの関数をセット
 */
function triggerWeather_Production() {
  setBandDestination('PROD');
  postWeatherToBand();
}

/**
 * 【テスト用】エディタの「実行」ボタンで試す時用
 */
function debug_WeatherTest() {
  setBandDestination('TEST');
  postWeatherToBand();
}

/**
 * Webアプリの入り口
 * URLの末尾に ?mode=test と付いていたらテストモード、なければ本番
 */
function doGet(e) {
  // e.parameter がない場合（直接実行など）のガード
  let mode = 'PROD';
  if (e && e.parameter && e.parameter.mode === 'test') {
    mode = 'TEST';
  }
  
  try {
    setBandDestination(mode);
    postWeatherToBand();
    
    const label = (mode === 'TEST') ? '🛠️ 【テスト】' : '✅ 【本番】';
    return HtmlService.createHtmlOutput(`<h2>${label} 天気予報を投稿しました</h2>`);
  } catch (err) {
    return HtmlService.createHtmlOutput(`<h2>❌ エラー</h2><p>${err.toString()}</p>`);
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

  // --- 解析・本文組み立て ---
  try {
    const data = JSON.parse(response.getContentText());
    const hourly = data.hourly;
    const now = new Date();
    
    let section1 = "【天気・気温】\n";
    let section2 = "【降水確率・湿度・風】\n";
    let count = 0;
    const maxForecast = 6; // 3時間おき×6回＝18時間分

    for (let i = 0; i < hourly.time.length; i++) {
      const forecastTime = new Date(hourly.time[i]);
      
      // 現在時刻より後、かつ3時間おき、かつ18時間分まで
      if (forecastTime > now && count < maxForecast) {
        if (forecastTime.getHours() % 3 === 0) {
          const timeStr = Utilities.formatDate(forecastTime, "JST", "MM/dd HH:00");
          const temp = hourly.temperature_2m[i].toFixed(1);
          const pop = hourly.precipitation_probability[i];
          const hum = hourly.relative_humidity_2m[i];
          const wind = hourly.wind_speed_10m[i].toFixed(1);
          const dirDeg = hourly.wind_direction_10m[i];
          const dirIdx = Math.round(dirDeg / 45) % 8;
          const dirInfo = conf.WIND_DIRECTIONS[dirIdx];
          const desc = conf.WEATHER_MAP[hourly.weathercode[i]] || "❓";

          // ブロック1: 天気と気温
          section1 += `${timeStr}   ${desc}   🌡️ ${temp}℃\n`;
          // ブロック2: 降水確率、湿度、風速（空行なし）
          section2 += `${timeStr}   ☔ ${pop}% / 💧 ${hum}% / 🚩 ${wind}m/s (${dirInfo.arrow}${dirInfo.label})\n`;
          
          count++;
        }
      }
    }

    const finalContent = `${conf.TAG}\n${conf.TITLE}\n\n${section1}\n${section2}\n---\n${conf.FOOTER}`;
    postToBand(finalContent);
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
リトライを試みましたが、情報を取得できませんでした。

■発生したエラー内容:
${errorMessage}

■推測される原因:
・Google共有サーバーのIPアドレス制限（429エラー）
・Open-Meteo APIの一時的なダウン

この投稿はスキップされました。
急ぎで投稿が必要な場合は、GASエディタから手動で debug_WeatherTest を実行してください。
`.trim();

  try {
    MailApp.sendEmail(recipient, subject, body);
    console.log("管理者へエラー通知メールを送信しました。");
  } catch (e) {
    console.error("エラーメールの送信自体に失敗しました: " + e.message);
  }
}
