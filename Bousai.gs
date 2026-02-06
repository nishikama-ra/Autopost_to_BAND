/**
 * 気象庁APIを監視し発表情報を照合して投稿を判断する
 */
function checkJmaAndPostToBand() {
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

    if (!cityData) {
      console.log("指定地点のデータが見つかりません。");
      return;
    }

    let activeMessages = [];
    let maxLevel = 3; 
    let hasUpdate = false;

    cityData.warnings.forEach(w => {
      const msg = master.special_warnings[w.code] || 
                  master.warnings[w.code] || 
                  master.advisories[w.code];
      
      if (msg) {
        const statusLabel = (w.status === "解除") ? "（解除）" : "";
        activeMessages.push(msg + statusLabel);

        if (w.status !== "継続") {
          hasUpdate = true;
        }

        if (w.status !== "解除") {
          if (master.special_warnings[w.code]) {
            maxLevel = Math.min(maxLevel, 1);
          } else if (master.warnings[w.code]) {
            maxLevel = Math.min(maxLevel, 2);
          } else if (master.advisories[w.code]) {
            maxLevel = Math.min(maxLevel, 3);
          }
        }
      }
    });

    if (activeMessages.length === 0) {
      console.log("発表中の情報はありません。");
      return;
    }

    if (!hasUpdate) {
      console.log("情報内容に変更がないためスキップします。");
      return;
    }

    const sortedContent = activeMessages.sort().join('\n');
    
    let levelLabel = "注意報";
    if (maxLevel === 1) levelLabel = "特別警報";
    else if (maxLevel === 2) levelLabel = "警報・注意報";

    const header = conf.TITLE_PREFIX + "気象情報" + conf.TITLE_SUFFIX;
    const body = header + "\n" + levelLabel + "が発表されています。\n\n" + sortedContent;

    postToBand(body);
    console.log("投稿処理が完了しました。");

  } catch (e) {
    console.error("処理失敗: " + e.toString());
  }
}
