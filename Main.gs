/**
 * 未読メールをスキャンし、添付ファイルの保存とBANDへの投稿を行います。
 */
function checkGmailAndPostToBand() {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(1000)) {
      console.log("前の処理が実行中のため、今回の実行をスキップします。");
      return;
    }

    const senderEmails = Object.keys(CONFIG.SENDERS);
    if (senderEmails.length === 0) return;

    const query = `(${senderEmails.map(email => `from:${email}`).join(' OR ')}) is:unread`;
    const threads = GmailApp.search(query, 0, 100);
    
    if (threads.length === 0) {
      console.log("処理対象の未読メールはありません。");
      return;
    }

    // 処理効率のため、各スレッドのメッセージをフラットに並める
    let allMessages = [];
    threads.forEach(thread => {
      thread.getMessages().forEach(msg => {
        if (msg.isUnread()) {
          const fromRaw = msg.getFrom().toLowerCase();
          const foundSender = senderEmails.find(email => fromRaw.includes(email.toLowerCase()));

          if (foundSender) {
            allMessages.push({
              message: msg,
              senderKey: foundSender,
              date: msg.getDate()
            });
          }
        }
      });
    });

    if (allMessages.length === 0) return;

    // 日付順にソートして古いものから処理
    allMessages.sort((a, b) => a.date - b.date);

    // 1回の実行制限件数で切り出し
    const targetData = allMessages.slice(0, CONFIG.MAX_THREADS_PER_RUN);
    const totalToProcess = targetData.length;
    console.log(`未読件数: ${allMessages.length} 件。今回の処理対象: ${totalToProcess} 件`);

    let processedCount = 0;

    for (const data of targetData) {
      const message = data.message;
      const senderEmail = data.senderKey;
      const subject = message.getSubject() || "";

      try {
        // --- 汎用フィルタ処理 ---
        const filterConfig = CONFIG.MAIL_FILTERS[senderEmail];
        if (filterConfig) {
          const body = message.getPlainBody() || "";
          let bodyForCheck = body;

          // 1. Yahooメール（転送含む）の場合、判定範囲を限定してフッター・広告を無視する
          if (filterConfig.isYahooTransit) {
            const startMark = "さん";
            const endMark = "このメールに返信されても";
            const startIndex = body.indexOf(startMark);
            const endIndex = body.indexOf(endMark);

            if (startIndex !== -1 && endIndex !== -1) {
              // 「さん」から「このメールに返信〜」の間だけを抽出
              bodyForCheck = body.substring(startIndex + startMark.length, endIndex);
              // その中から広告ブロック（▼遅延・運休〜URL）も削除
              bodyForCheck = bodyForCheck.replace(/▼遅延・運休の情報がすぐ届く[\s\S]*?https:\/\/yahoo\.jp\/[a-zA-Z0-9_-]+/g, "");
            }
          }

          // 2. ルート判定
          const isPriorityRoute = filterConfig.priorityRoutes.some(route => 
            subject.includes(route) || bodyForCheck.includes(route)
          );

          // 3. キーワード判定
          const isCriticalIssue = filterConfig.criticalKeywords.some(kw => 
            bodyForCheck.includes(kw)
          );

          // 優先路線でもなく、重要キーワードも含まれていない場合はスキップ
          if (!isPriorityRoute && !isCriticalIssue) {
            console.log(`フィルタによりスキップ: ${subject}`);
            message.markRead();
            continue; 
          }
        }

        const postBody = createPostBody(message, senderEmail);
        if (!postBody) throw new Error("本文の生成に失敗しました。");

        const attachments = message.getAttachments();
        const fileUrls = attachments
          .filter(file => file && typeof file.getName === 'function')
          .map(file => {
            const url = uploadFileToDrive(file);
            Utilities.sleep(1000); 
            return url;
          })
          .filter(url => url !== null);

        // --- 1. 通常のBAND投稿 ---
        if (postToBand(postBody, fileUrls)) {
          message.markRead();
          processedCount++;
          console.log(`完了(${processedCount}/${totalToProcess}): [${data.date}] ${message.getSubject()}`);

          // --- 2. 特定住所が含まれる場合の別BAND投稿（ピーガルくん用） ---
          if (CONFIG.EXTRA_POST_CONFIG.ENABLED_SENDERS.includes(senderEmail)) {
            const watchAddresses = CONFIG.EXTRA_POST_CONFIG.WATCH_ADDRESSES;
            const plainBody = message.getPlainBody();
            const hasTargetAddress = watchAddresses.some(address => plainBody.includes(address));

            if (hasTargetAddress) {
              console.log("特定住所（近隣地区）を検知したため、別BANDへも投稿します。");
              postToExtraBand(postBody, fileUrls);
            }
          }

        } else {
          throw new Error("BAND APIへの投稿に失敗しました。");
        }

        // 連続投稿によるAPI制限回避
        Utilities.sleep(10000);

      } catch (e) {
        console.error(`エラー: ${e.message} (${message.getSubject()})`);

        if (CONFIG.ERROR_MAIL.TO) {
          const mailBody = CONFIG.ERROR_MAIL.TEMPLATE
            .replace('{errorMessage}', e.message)
            .replace('{date}', data.date.toString())
            .replace('{subject}', message.getSubject())
            .replace('{sender}', senderEmail);

          MailApp.sendEmail({
            to: CONFIG.ERROR_MAIL.TO,
            subject: CONFIG.ERROR_MAIL.SUBJECT,
            body: mailBody
          });
        }
      }
    }
    console.log(`実行完了：処理件数 ${processedCount} 件`);

  } catch (e) {
    console.error(`システムエラー: ${e.message}`);
  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

/**
 * 送信元ごとのルールに基づき、投稿用の本文を生成します。
 */
function createPostBody(message, senderEmail) {
  const configEntry = CONFIG.SENDERS[senderEmail];
  if (!configEntry) return null;
  
  const rule = CONFIG.RULES[configEntry[0]];
  const tag = CONFIG.TAGS[configEntry[1]];

  const subject = message.getSubject() || "無題";
  const fullBody = message.getPlainBody() || "";
  let body = fullBody;
  
  // 1. 指定位置より上をカット
  if (rule.startAfter) {
    const startIndex = body.indexOf(rule.startAfter);
    if (startIndex !== -1) {
      body = body.substring(startIndex + rule.startAfter.length).trim();
    }
  }

  // 2. 「救出」するフッター行の特定（Copyrightなど）
  let savedFooter = "";
  if (rule.keepFrom) {
    const keepIndex = fullBody.indexOf(rule.keepFrom);
    if (keepIndex !== -1) {
      savedFooter = "\n-------------------------\n" + fullBody.substring(keepIndex).trim();
    }
  }

  // 3. 指定位置より下をカット（案内文など）
  if (rule.cutOffString) {
    const cutIndex = body.indexOf(rule.cutOffString);
    if (cutIndex !== -1) {
      body = body.substring(0, cutIndex).trim();
    }
  }

  // 制御文字の除去
  const cleanBody = body.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();

  // 本文組み立て
  let content = "";
  if (tag) content += `${tag}\n`;
  content += `件名：${subject}\n`;
  if (rule.customHeader) content += `${rule.customHeader}\n`;

  content += `\n${cleanBody}`;

  if (savedFooter) {
    content += savedFooter;
  }

  return content;
}
