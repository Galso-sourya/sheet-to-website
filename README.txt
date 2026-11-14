# ReelIndex — Google Sheets Movie Database

## Files
- `index.html` — page structure
- `style.css` — responsive cinematic design
- `script.js` — Google Sheets CSV connection, search, filters and movie details

## Connect your Google Sheet
The spreadsheet ID is already configured in `script.js`.
The website reads the first tab (`gid=0`) using Google's CSV endpoint.

1. Open your Google Sheet.
2. Choose **File → Share → Publish to web**.
3. In the publishing dialog, select the movie-data sheet (not the entire workbook if other tabs contain private data).
4. Select **Comma-separated values (.csv)** if the format option is shown, then click **Publish**.
5. In the published-content settings, keep **Automatically republish when changes are made** enabled.
6. If the sheet tab is not the first tab, change `SHEET_GID` in `script.js` to that tab's `gid` value from its URL.
7. Keep the header row in row 1. Supported column headings include:
   - Movie Name / Movie / Title
   - Actor Name / Actor / Cast
   - Year / Release Year
   - Genre
   - Poster URL / Image URL
   - Description / Plot

The minimum required columns are Movie Name and Actor Name. Other columns are optional.
For multiple actors, separate names with commas, semicolons, or vertical bars.

## Publish the website
Upload all three files to the same folder in a GitHub repository and enable GitHub Pages, or drag the folder into Netlify Drop.

## Refresh behaviour
The page fetches on opening, when the Refresh button is pressed, and every 60 seconds while open. Google may take a few minutes to update a published copy after edits.

## Privacy
Publishing a sheet makes the selected published data visible to people who can access the published URL. Do not publish private or sensitive columns. A published sheet is read-only from this website; edits are made in Google Sheets.
