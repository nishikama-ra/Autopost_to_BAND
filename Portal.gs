/**
 * ポータル画面のレンダリング処理
 * Alloc.gsから呼び出される
 */
function renderAnnouncePortal(e) {
  // 1. Case: Response from BAND with Authorization Code
  if (e && e.parameter && e.parameter.code) {
    var successHtml = 
      "<meta charset='UTF-8'>" +
      "<div style='font-family: sans-serif; text-align: center; padding-top: 50px;'>" +
      "<h2 style='color: #4285f4;'>Authentication Successful</h2>" +
      "<p>The authorization code has been received by the Nishikamakura Jichikai system.</p>" +
      "<p>You may now close this window.</p>" +
      "</div>";
    return HtmlService.createHtmlOutput(successHtml).setTitle("Auth Success");
  }

  // 2. Case: Direct access (Reviewers or Public)
  var portalHtml = 
    "<meta charset='UTF-8'>" + // Force UTF-8 encoding
    "<div style='font-family: sans-serif; padding: 20px; border: 2px solid #ccc; border-radius: 10px; max-width: 600px; margin: 40px auto; line-height: 1.6;'>" +
    "<h1 style='color: #2c3e50; border-bottom: 2px solid #2c3e50; padding-bottom: 10px;'>API Integration Portal</h1>" +
    "<h2 style='color: #27ae60;'>Nishikamakura Jichikai (Community Association)</h2>" +
    
    "<p>This system is an official API connector for the domain <strong>nishikamakura-jichikai.com</strong>.</p>" +
    "<p>The purpose of this application is to automatically relay official announcements from our Google Workspace (Gmail) to our BAND group to ensure timely information sharing with community members.</p>" +
    
    "<div style='background-color: #f9f9f9; padding: 15px; border-left: 5px solid #2980b9; margin: 25px 0;'>" +
    "<strong>Administrative Contact:</strong><br>" +
    "If you have any questions regarding the security or technical details of this integration, please contact our IT Promotion Team at:<br>" +
    "<a href='mailto:itpromotion@nishikamakura-jichikai.com' style='color: #2980b9;'>itpromotion@nishikamakura-jichikai.com</a>" +
    "</div>" +
    
    "<p style='font-size: 0.9em; color: #7f8c8d;'>System Status: <span style='color: green; font-weight: bold;'>Operational / Verified</span></p>" +
    "<p style='font-size: 0.8em; color: #95a5a6; border-top: 1px solid #eee; padding-top: 10px;'>© 2024 Nishikamakura Jichikai. All rights reserved.</p>" +
    "</div>";

  return HtmlService.createHtmlOutput(portalHtml).setTitle("Nishikamakura Jichikai API Portal");
}
