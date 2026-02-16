/**
 * 気象庁APIを監視し発表情報を照合して投稿を判断する
 */
function checkJmaAndPostToBand() {
  const conf = CONFIG.BOUSAI_CONFIG;
  const master = conf.MASTER;
  const scriptProps = PropertiesService.getScriptProperties();
  
  const lastCheck = scriptProps.getProperty('LAST_JMA_DATETIME') || "";
  const lastPostedContent = scriptProps.getProperty('LAST_JMA_POST_CONTENT') || "";
  // 前回の「警報・特別警報」のコードリストを保持して比較に使用する
  const lastWarningCodesStr = scriptProps.getProperty('LAST_WARNING_CODES') || "";
  const lastWarningCodes = lastWarningCodesStr ? lastWarningCodesStr.split(',') : [];

  let latestDateTime = lastCheck;
  let totalMessage = "";

  try {
    // --- 1. 気象警報・注意報セクション ---
    const resWarning = UrlFetchApp.fetch(conf.URL_WARNING);
    const dataWarning = JSON.parse(resWarning.getContentText());
    
    let cityData = null;
    const areaTypes = dataWarning.areaTypes || [];
    for (let i = areaTypes.length - 1; i >= 0; i--) {
      const found = areaTypes[i].areas.find(a => a.code === conf.CITY_CODE);
      if (found && found.warnings) {
        cityData = found;
        break;
      }
    }

    if (cityData) {
      let currentWarningCodes = []; // 今回の警報・特別警報コード
      let activeList = [];         // 現在有効な全情報の表示用
      let changeMessages = [];      // 冒頭に表示する「解除/発表」の変化メッセージ

      cityData.warnings.forEach(w => {
        const code = w.code;
        const isSpecial = !!master.special_warnings[code];
        const isWarning = !!master.warnings[code];
        
        // 警報・特別警報であれば現在のコードリストに追加
        if (isSpecial || isWarning) {
          currentWarningCodes.push(code);
        }

        // 現在「発表」または「継続」中のものをリストアップ
        if (w.status === "発表" || w.status === "継続") {
          const masterText = master.special_warnings[code] || master.warnings[code] || master.advisories[code];
          if (masterText) {
            activeList.push(masterText);
          }
        }
      });

      // --- 変化の判定（警報・特別警報のみ） ---
      const addedWarnings = currentWarningCodes.filter(c => !lastWarningCodes.includes(c));
      const removedWarnings = lastWarningCodes.filter(c => !currentWarningCodes.includes(c));

      // 1. 新しく発表された警報
      addedWarnings.forEach(c => {
        const name = (master.special_warnings[c] || master.warnings[c] || "").split('：')[0];
        if (name) changeMessages.push(`${name}が発表されました。`);
      });

      // 2. 解除された警報
      removedWarnings.forEach(c => {
        const name = (master.special_warnings[c] || master.warnings[c] || "").split('：')[0];
        if (name) changeMessages.push(`${name}は解除されました。`);
      });

      // 投稿用の気象メッセージ構築（警報・特別警報に変化があった場合のみ）
      if (changeMessages.length > 0) {
        let weatherBody = "西鎌倉の気象情報\n";
        weatherBody += changeMessages.join('\n') + "\n\n";

        if (activeList.length > 0) {
          weatherBody += "現在、以下の情報が発表されています。\n";
          weatherBody += activeList.join('\n');
        } else if (currentWarningCodes.length === 0) {
          // ★こちら側のタイトルも変更
          weatherBody = "西鎌倉の気象情報\n警報・特別警報はすべて解除されました。";
        }

        totalMessage += weatherBody + "\n\n";
        
        // 次回比較用に現在の警報状態を保存
        scriptProps.setProperty('LAST_WARNING_CODES', currentWarningCodes.join(','));
      }
    }

    // --- 2. 地震・津波・火山セクション（元のロジックを完全維持） ---
    const resFeed = UrlFetchApp.fetch(conf.URL_FEED_EQVOL);
    const xmlFeed = resFeed.getContentText();
    const entries = xmlFeed.split("<entry>");

    for (let i = 1; i < entries.length; i++) {
      const entry = entries[i];
      const updatedMatch = entry.match(/<updated>(.*?)<\/updated>/);
      if (!updatedMatch) continue;
      const updated = updatedMatch[1];
      if (updated <= lastCheck) continue;

      const titleMatch = entry.match(/<title>(.*?)<\/title>/);
      const linkMatch = entry.match(/<link\s+type="application\/xml"\s+href="(.*?)"/);
      if (!titleMatch || !linkMatch) continue;

      const title = titleMatch[1];
      const detailUrl = linkMatch[1];

      // A. 地震情報の判定（鎌倉市：震度3以上に限定）
      if (title.includes("震源") || title.includes("震度")) {
        const resDetail = UrlFetchApp.fetch(detailUrl);
        const xmlDetail = resDetail.getContentText();
        const kamakuraMatch = xmlDetail.match(new RegExp(`<Area>.*?<Name>${conf.CITY_NAME}<\/Name>.*?<MaxInt>(.*?)<\/MaxInt>`, "s"));

        if (kamakuraMatch) {
          const kamakuraInt = kamakuraMatch[1];
          const targetInts = ["3", "4", "5-", "5+", "6-", "6+", "7"];
          if (targetInts.includes(kamakuraInt)) {
            const epicenterMatch = xmlDetail.match(/<Hypocenter>.*?<Name>(.*?)<\/Name>/);
            const magnitudeMatch = xmlDetail.match(/<jmx_eb:Magnitude.*?>(.*?)<\/jmx_eb:Magnitude>/);
            const maxIntMatch = xmlDetail.match(/<MaxInt>(.*?)<\/MaxInt>/);

            let detailMsg = "【地震情報】\n" + title + "\n";
            if (epicenterMatch) detailMsg += "震源地：" + epicenterMatch[1] + "\n";
            if (magnitudeMatch) detailMsg += "規模：M" + magnitudeMatch[1] + "\n";
            if (maxIntMatch) detailMsg += "最大震度：" + maxIntMatch[1].replace(/(\d)[\+\-]/, (m, p1) => p1 + (m.includes('+') ? '強' : '弱')) + "\n";
            const kamakuraIntJP = kamakuraInt.replace("5-", "5弱").replace("5+", "5強").replace("6-", "6弱").replace("6+", "6強");
            detailMsg += conf.CITY_NAME + "の震度：" + kamakuraIntJP + "\n\n";
            totalMessage += detailMsg;
            console.log(`地震情報を集約に追加: ${title}`);
          }
        }
      }
      // B. 津波情報の判定
      else if (title.includes("津波")) {
        const resDetail = UrlFetchApp.fetch(detailUrl);
        const xmlDetail = resDetail.getContentText();
        
        // 監視海域（相模湾・三浦半島）が含まれていれば、レベルに関わらず投稿
        if (xmlDetail.includes(conf.WATCH_TSUNAMI_REGION)) {
          const contentMatch = entry.match(/<content.*?>(.*?)<\/content>/);
          const headline = contentMatch ? contentMatch[1] : title;
          totalMessage += "津波の情報\n" + headline + "\n\n";
          console.log(`津波情報を集約に追加: ${title}`);
        }
      }

      // C. 火山情報の判定
      // 「定時」が含まれる予報はスキップし、緊急性のあるものに絞る
      else if ((title.includes("火山") || title.includes("降灰")) && !title.includes("定時")) {
        const resDetail = UrlFetchApp.fetch(detailUrl);
        const xmlDetail = resDetail.getContentText();
        
        // 監視対象の火山、または「神奈川県」＋「噴火・警報」の組み合わせで判定
        const isWatchVolcano = conf.WATCH_VOLCANOES.some(v => xmlDetail.includes(v));
        const isUrgentKanto = xmlDetail.includes(conf.PREF_NAME) && (xmlDetail.includes("噴火") || xmlDetail.includes("警報"));

        if (isWatchVolcano || isUrgentKanto) {
          const contentMatch = entry.match(/<content.*?>(.*?)<\/content>/);
          const headline = contentMatch ? contentMatch[1] : title;
          totalMessage += "火山の情報\n" + headline + "\n\n";
          console.log(`火山情報を集約に追加: ${title}`);
        }
      }
      
      if (updated > latestDateTime) {
        latestDateTime = updated;
      }
    }

    // --- 3. 統合投稿判定 ---
    if (totalMessage.trim() !== "") {
      const header = " 防災情報の自動通知\n──────────────\n\n";
      const finalBody = "#防災\n" + header + totalMessage.trim();
    
      if (finalBody !== lastPostedContent) {
        postToBand(finalBody);
        scriptProps.setProperty('LAST_JMA_POST_CONTENT', finalBody);
        console.log("防災情報の統合投稿が完了しました。");
      } else {
        console.log("前回投稿内容と同一のため、投稿をスキップしました。");
      }
    } 

    // 最新の更新日時を保存（これはメッセージの有無に関わらず実行すべき処理）
    if (latestDateTime !== lastCheck) {
      scriptProps.setProperty('LAST_JMA_DATETIME', latestDateTime);
    }
  } catch (e) {
    console.error("処理失敗: " + e.toString());
  }
}

/**
 * 12時に注意報を含む全情報を投稿する（宛先設定は呼び出し側で行う）
 */
function postDailyWeatherSummary() {
  const conf = CONFIG.BOUSAI_CONFIG;
  const master = conf.MASTER;
  
  try {
    const resWarning = UrlFetchApp.fetch(conf.URL_WARNING);
    const dataWarning = JSON.parse(resWarning.getContentText());
    
    let cityData = null;
    const areaTypes = dataWarning.areaTypes || [];
    for (let i = areaTypes.length - 1; i >= 0; i--) {
      const found = areaTypes[i].areas.find(a => a.code === conf.CITY_CODE);
      if (found && found.warnings) {
        cityData = found;
        break;
      }
    }

    let activeList = [];
    if (cityData) {
      cityData.warnings.forEach(w => {
        if (w.status === "発表" || w.status === "継続") {
          const name = master.special_warnings[w.code] || 
                       master.warnings[w.code] || 
                       master.advisories[w.code];
          if (name) activeList.push(name);
        }
      });
    }

    let body = "西鎌倉の気象情報\n";
    if (activeList.length > 0) {
      body += "現在、以下の情報が発表されています。\n\n";
      body += activeList.join('\n');
    } else {
      body += "現在、警報・注意報は発表されていません。";
    }

    const header = "防災情報の定期通知\n──────\n\n";
    const finalBody = "#防災\n" + header + body;

    // ここでは宛先を固定せず投稿
    postToBand(finalBody);
    
  } catch (e) {
    console.error("定時投稿失敗: " + e.toString());
  }
}
