/**
 * 気象庁APIを監視し発表情報を照合して投稿を判断する
 */
function checkJmaAndPostToBand() {
  const conf = CONFIG.BOUSAI_CONFIG;
  const master = conf.MASTER;
  const scriptProps = PropertiesService.getScriptProperties();
  const processedEventIds = [];
  
  const lastCheck = scriptProps.getProperty('LAST_JMA_DATETIME') || "";
  const lastPostedContent = scriptProps.getProperty('LAST_JMA_POST_CONTENT') || "";
  // 前回の「警報・特別警報」のコードリストを保持して比較に使用する
  const lastWarningCodesStr = scriptProps.getProperty('LAST_WARNING_CODES') || "";
  const lastWarningCodes = lastWarningCodesStr ? lastWarningCodesStr.split(',') : [];

  let latestDateTime = lastCheck;
  let totalMessage = "";

  try {
    //
    // --- 1. 気象警報・注意報セクション ---
    //
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

      //  新しく発表された警報
      addedWarnings.forEach(c => {
        const name = (master.special_warnings[c] || master.warnings[c] || "").split('：')[0];
        if (name) changeMessages.push(`${name}が発表されました。`);
      });

      //  解除された警報
      removedWarnings.forEach(c => {
        const name = (master.special_warnings[c] || master.warnings[c] || "").split('：')[0];
        if (name) changeMessages.push(`${name}は解除されました。`);
      });

      // 投稿用の気象メッセージ構築（警報・特別警報に変化があった場合のみ）
      if (changeMessages.length > 0) {
        let weatherBody = "🔔西鎌倉の気象情報\n";
        weatherBody += changeMessages.join('\n') + "\n\n";

        if (activeList.length > 0) {
          weatherBody += "現在、以下の情報が発表されています。\n";
          weatherBody += activeList.join('\n');
        } else if (currentWarningCodes.length === 0) {
            weatherBody = "🔔西鎌倉の気象情報\n警報・特別警報はすべて解除されました。";
        }

        totalMessage += weatherBody + "\n\n";
        
        // 次回比較用に現在の警報状態を保存
        scriptProps.setProperty('LAST_WARNING_CODES', currentWarningCodes.join(','));
      }
    }
    //
    // --- 2. 地震・津波・火山セクション ---
    //
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
      // --- テスト差し替え用：すべてのエントリを強制的に指定URLに向ける ---
      //const detailUrl = "https://www.data.jma.go.jp/developer/xml/data/20260420144547_0_VTSE41_010000.xml";

      // a. 地震情報の判定（鎌倉市：震度3以上に限定）
      // 本庁発行(010000)の電文のみ（他の気象台からの重複をスキップ）
      if ((title.includes("震源") || title.includes("震度")) && detailUrl.includes("_010000.xml")) {
        const resDetail = UrlFetchApp.fetch(detailUrl);
        const xmlText = resDetail.getContentText();
        const doc = XmlService.parse(xmlText);
        const root = doc.getRootElement();

        // 名前空間の定義
        const nsSeis = XmlService.getNamespace('http://xml.kishou.go.jp/jmaxml1/body/seismology1/');
        const nsEb = XmlService.getNamespace('http://xml.kishou.go.jp/jmaxml1/elementBasis1/');

        // Body > Intensity > Observation の階層を辿る
        const body = root.getChild('Body', nsSeis);
        if (!body) continue;

        const intensity = body.getChild('Intensity', nsSeis);
        if (!intensity) continue;

        const observation = intensity.getChild('Observation', nsSeis);
        if (!observation) continue;

        // 全地点（City）から鎌倉市を探す
        const cities = observation.getDescendants()
          .filter(node => node.asElement() && node.asElement().getName() === 'City');

        let kamakuraData = null;
        cities.forEach(cityNode => {
          const city = cityNode.asElement();
          const cityName = city.getChildText('Name', nsSeis);
          if (cityName === conf.CITY_NAME) {
            kamakuraData = {
              maxInt: city.getChildText('MaxInt', nsSeis)
            };
          }
        });

        // 鎌倉市があり、かつ震度3以上の場合のみメッセージ
        if (kamakuraData) {
          const kamakuraInt = kamakuraData.maxInt;
          const targetInts = ["3", "4", "5-", "5+", "6-", "6+", "7"];
          
          if (targetInts.includes(kamakuraInt)) {
            // 震源地・マグニチュード・最大震度の取得
            const earthquake = body.getChild('Earthquake', nsSeis);
            const hypocenter = earthquake ? earthquake.getChild('Hypocenter', nsSeis) : null;
            const area = hypocenter ? hypocenter.getChild('Area', nsSeis) : null;
            
            const epicenter = area ? area.getChildText('Name', nsSeis) : "不明";
            const magnitude = earthquake ? earthquake.getChildText('Magnitude', nsEb) : "不明";
            const maxIntAll = observation.getChildText('MaxInt', nsSeis);

            let detailMsg = "【地震情報】\n" + title + "\n";
            detailMsg += "震源地：" + epicenter + "\n";
            detailMsg += "規模：M" + magnitude + "\n";
            detailMsg += "最大震度：" + maxIntAll.replace(/(\d)[\+\-]/, (m, p1) => p1 + (m.includes('+') ? '強' : '弱')) + "\n";
            
            const kamakuraIntJP = kamakuraInt.replace("5-", "5弱").replace("5+", "5強").replace("6-", "6弱").replace("6+", "6強");
            detailMsg += conf.CITY_NAME + "の震度：" + kamakuraIntJP + "\n\n";
            
            totalMessage += detailMsg;
            console.log(`地震情報を集約に追加: ${title}`);
          }
        }
      }

      // b. 津波情報の判定（相模湾・三浦半島）
      else if (title.includes("津波") && detailUrl.includes("_010000.xml")) {
        const resDetail = UrlFetchApp.fetch(detailUrl);
        const xmlText = resDetail.getContentText();
        const doc = XmlService.parse(xmlText);
        const root = doc.getRootElement();
        
        const nsHead = XmlService.getNamespace('http://xml.kishou.go.jp/jmaxml1/informationBasis1/');
        const head = root.getChild('Head', nsHead);
        // EventID（地震ごとの固有ID）を取得
        const eventId = head ? head.getChildText('EventID', nsHead) : detailUrl;

        // 同一のEventIDをすでにこの回で処理していたら重複として飛ばす
        if (processedEventIds.indexOf(eventId) !== -1) continue;

        const allElements = root.getDescendants().filter(n => n.asElement()).map(n => n.asElement());
        
        // 1. 指定地域の情報を特定
        const items = allElements.filter(e => e.getName() === 'Item');
        let targetAreaInfo = "";

        for (const item of items) {
          const area = item.getChild('Area', item.getNamespace());
          if (area && area.getChildText('Name', area.getNamespace()) === conf.WATCH_TSUNAMI_REGION) {
            const ns = item.getNamespace();

            // 区分名 (Kind/Name)
            const kind = item.getChild('Category', ns).getChild('Kind', ns);
            const kindName = kind ? kind.getChildText('Name', ns) : "";
            
            // 津波の高さ (type属性とdescription属性の連結)
            const maxHeight = item.getChild('MaxHeight', ns);
            let heightText = "";
            if (maxHeight) {
              const nsEb = XmlService.getNamespace('jmx_eb', 'http://xml.kishou.go.jp/jmaxml1/elementBasis1/');
              const tHeightNode = maxHeight.getChild('TsunamiHeight', nsEb);
              if (tHeightNode) {
                const typeAttr = tHeightNode.getAttribute('type').getValue();
                const descAttr = tHeightNode.getAttribute('description').getValue();
                heightText = `${typeAttr}：${descAttr}`;
              }
            }

            targetAreaInfo = `■${conf.WATCH_TSUNAMI_REGION}の情報\n`;
            if (kindName) targetAreaInfo += `区分：${kindName}\n`;
            if (heightText) targetAreaInfo += `${heightText}\n`;
            break;
          }
        }

        if (targetAreaInfo) {
          let tsunamiMsg = `【${title}】\n\n${targetAreaInfo}\n`;

          // 2. 地震要素 (Earthquake)
          const eq = allElements.find(e => e.getName() === 'Earthquake');
          if (eq) {
            const nsT = eq.getNamespace();
            const nsEb = XmlService.getNamespace('jmx_eb', 'http://xml.kishou.go.jp/jmaxml1/elementBasis1/');
            
            tsunamiMsg += `(震源)\n`;
            tsunamiMsg += `発生時刻：${eq.getChildText('OriginTime', nsT)}\n`;
            
            const hypoArea = eq.getChild('Hypocenter', nsT).getChild('Area', nsT);
            if (hypoArea) {
              tsunamiMsg += `震源地：${hypoArea.getChildText('Name', nsT)}\n`;
              const coord = hypoArea.getChild('Coordinate', nsEb);
              if (coord) tsunamiMsg += `位置詳細：${coord.getAttribute('description').getValue()}\n`;
              const markName = hypoArea.getChildText('NameFromMark', nsT);
              if (markName) tsunamiMsg += `震源地補足：${markName}\n`;
            }

            const magNode = eq.getChild('Magnitude', nsEb);
            if (magNode) tsunamiMsg += `規模：${magNode.getAttribute('description').getValue()}\n`;
            tsunamiMsg += `\n`;
          }

          // 3. 本文およびコメント（名前空間を使用して抽出）
          const nsSeis = XmlService.getNamespace('http://xml.kishou.go.jp/jmaxml1/body/seismology1/');
          const bodyNode = root.getChild('Body', nsSeis);
          let commentsText = "";
          
          if (bodyNode) {
            // Body直下のText（［海面変動の見通し］等）
            const bodyText = bodyNode.getChildText('Text', nsSeis);
            if (bodyText) commentsText += bodyText + "\n\n";

            const commentsNode = bodyNode.getChild('Comments', nsSeis);
            if (commentsNode) {
              // WarningComment内のTextを取得（＜津波予報＞等）
              const warningCommentNode = commentsNode.getChild('WarningComment', nsSeis);
              if (warningCommentNode) {
                const wText = warningCommentNode.getChildText('Text', nsSeis);
                if (wText) commentsText += wText + "\n\n";
              }
              
              // FreeFormCommentのテキストを取得（［予想される津波の高さの解説］等）
              const freeFormText = commentsNode.getChildText('FreeFormComment', nsSeis);
              if (freeFormText) commentsText += freeFormText + "\n";
            }
          }

          if (commentsText) {
            tsunamiMsg += commentsText;
          }

          totalMessage += tsunamiMsg + "\n";
          // 今回のEventIDを記録
          processedEventIds.push(eventId); 
        }
      }

      // c. 火山情報の判定
      else if (title.includes("火山") || title.includes("降灰")) {
        const resDetail = UrlFetchApp.fetch(detailUrl);
        const xmlDetail = resDetail.getContentText();
        
        // 監視対象の火山、または「神奈川県」＋「噴火・警報」の組み合わせで判定
        const isWatchVolcano = conf.WATCH_VOLCANOES.some(v => xmlDetail.includes(v));
        const isUrgentKanto = xmlDetail.includes(conf.PREF_NAME) && (xmlDetail.includes("噴火") || xmlDetail.includes("警報"));

        if (isWatchVolcano || isUrgentKanto) {
          const root = XmlService.parse(xmlDetail).getRootElement();
          const nsHead = XmlService.getNamespace('http://xml.kishou.go.jp/jmaxml1/informationBasis1/');
          const nsVolc = XmlService.getNamespace('http://xml.kishou.go.jp/jmaxml1/body/volcanology1/');
          const nsEb = XmlService.getNamespace('http://xml.kishou.go.jp/jmaxml1/elementBasis1/');
          
          const head = root.getChild('Head', nsHead);
          const body = root.getChild('Body', nsVolc);
          
          let volcanoMsg = "";
          let headlineText = "";
          let bodyContent = "";
          let obsDetail = "";

          if (head) {
            volcanoMsg += `【自動投稿：${head.getChildText('Title', nsHead)}】\n`;
            const headline = head.getChild('Headline', nsHead);
            if (headline) {
              headlineText = (headline.getChildText('Text', nsHead) || "").trim();
            }
          }

          if (body) {
            // 解説文 (VFVO51/53)
            const infoContent = body.getChild('VolcanoInfoContent', nsVolc);
            if (infoContent) {
              bodyContent = infoContent.getValue().trim();
            }

            // 観測詳細 (VFVO52)
            const observation = body.getChild('VolcanoObservation', nsVolc);
            if (observation) {
              const colorPlume = observation.getChild('ColorPlume', nsVolc);
              if (colorPlume) {
                // 抽出対象の要素（火口上高度、海抜高度、流向）
                const plumeElements = ['PlumeHeightAboveCrater', 'PlumeHeightAboveSeaLevel', 'PlumeDirection'];
                plumeElements.forEach(elName => {
                  const el = colorPlume.getChild(elName, nsEb);
                  if (el) {
                    // type属性から「火口上噴煙高度」等を、descriptionから「火口上1500m」等を取得
                    const type = el.getAttribute('type') ? el.getAttribute('type').getValue() : "";
                    const desc = el.getAttribute('description') ? el.getAttribute('description').getValue() : el.getValue();
                    if (type && desc) {
                      obsDetail += `${type}：${desc}\n`;
                    }
                  }
                });
              }
              const other = observation.getChildText('OtherObservation', nsVolc);
              if (other) obsDetail += other.trim() + "\n";
            }
          }

          // メッセージの組み立て（重複除去ロジック）
          if (bodyContent) {
            // ヘッドラインが本文の冒頭に含まれていない場合のみヘッドラインを表示
            if (headlineText && !bodyContent.startsWith(headlineText)) {
              volcanoMsg += headlineText + "\n\n";
            }
            volcanoMsg += bodyContent + "\n";
          } else {
            if (headlineText) volcanoMsg += headlineText + "\n";
          }

          if (obsDetail) {
            volcanoMsg += "\n" + obsDetail;
          }

          totalMessage += volcanoMsg.trim() + "\n\n";
          console.log(`火山情報を集約に追加: ${title}`);
        }
      }

      if (updated > latestDateTime) {
        latestDateTime = updated;
      }
    }

    //
    // --- 3. マージ投稿判定 ---
    //
    if (totalMessage.trim() !== "") {
      const header = " 【気象情報の自動投稿です】\n──────────────\n\n";
      const finalBody = "#防災\n" + header + totalMessage.trim();
    
      if (finalBody !== lastPostedContent) {
        postToBand(finalBody);
        scriptProps.setProperty('LAST_JMA_POST_CONTENT', finalBody);
        console.log("防災情報のマージ投稿が完了しました。");
      } else {
        console.log("前回投稿内容と同一のため、投稿をスキップしました。");
      }
    } 

    // 最新の更新日時を保存（メッセージの有無に関わらず処理）
    if (latestDateTime !== lastCheck) {
      scriptProps.setProperty('LAST_JMA_DATETIME', latestDateTime);
    }
  } catch (e) {
    console.error("処理失敗: " + e.toString());
  }
}

/**
 * 12時に注意報を含む全情報を投稿する
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

    let body = "🔔西鎌倉の気象情報\n";
    if (activeList.length > 0) {
      body += "現在、以下の情報が発表されています。\n\n";
      body += activeList.join('\n');
    } else {
      body += "現在、警報・注意報は発表されていません。";
    }

    const header = "【気象情報の定期自動投稿です】\n──────\n\n";
    const finalBody = "#防災\n" + header + body;

    // ここでは宛先を固定せず投稿
    postToBand(finalBody);
    
  } catch (e) {
    console.error("定時投稿失敗: " + e.toString());
  }
}
