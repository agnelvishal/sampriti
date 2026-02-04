// -----------------------------------------------------------------------------
// Google Apps Script Code for Sampriti Buy Now Feature
// -----------------------------------------------------------------------------
// Instructions:
// 1. Go to https://sheets.google.com/ and create a new Sheet.
// 2. Name the sheet (e.g., "Sampriti Orders").
// 3. Rename the first tab to "Orders".
// 4. In the first row (Header), add these columns: 
//    A1: Date, B1: Product, C1: Name, D1: Email, E1: Phone, F1: Address
// 5. Go to Extensions > Apps Script.
// 6. Delete any code in 'Code.gs' and paste all the code below.
// 7. Click 'Deploy' > 'New deployment'.
// 8. Select type: 'Web app'.
// 9. Description: "Orders API".
// 10. Execute as: "Me" (your email).
// 11. Who has access: "Anyone". (CRITICAL)
// 12. Click 'Deploy'.
// 13. Copy the "Web app URL" provided.
// 14. Paste this URL into your 'script.js' file where it says 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE'.
// -----------------------------------------------------------------------------

function doPost(e) {
    try {
        // 1. Parse the incoming data
        // The data comes in as a JSON string in the post body
        var requestData = JSON.parse(e.postData.contents);

        // 2. Open the Spreadsheet
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var sheet = ss.getSheetByName("Orders");

        // If "Orders" sheet doesn't exist, use the first one
        if (!sheet) {
            sheet = ss.getSheets()[0];
        }

        // 3. Append Row
        // [Date, Product, Name, Email, Phone, Address]
        sheet.appendRow([
            new Date(),
            requestData['product-name'],
            requestData['name'],
            requestData['email'],
            requestData['phone'],
            requestData['address']
        ]);

        // 4. Return Success Response
        // We return JSONResult to be clean, though no-cors on client might ignore it.
        return ContentService.createTextOutput(JSON.stringify({ 'result': 'success' }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        // Return Error
        return ContentService.createTextOutput(JSON.stringify({ 'result': 'error', 'error': error.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}
