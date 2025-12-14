# Testing Guide - Vinculum

This guide will help you test the Vinculum application locally.

## Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] npm installed
- [ ] Google account
- [ ] A PDF file to test with

## Step-by-Step Testing Instructions

### Step 1: Set Up Google OAuth Credentials

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/

2. **Create a New Project**
   - Click "Select a project" at the top
   - Click "New Project"
   - Name it "Vinculum Test" or similar
   - Click "Create"

3. **Enable Google Drive API**
   - In the left sidebar, go to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click on it and press "Enable"

4. **Configure OAuth Consent Screen**
   - Go to "APIs & Services" > "OAuth consent screen"
   - Choose "External" (for testing)
   - Click "Create"
   - Fill in required fields:
     - App name: "Vinculum"
     - User support email: your email
     - Developer contact: your email
   - Click "Save and Continue"
   - On "Scopes" page, click "Add or Remove Scopes"
     - Add: `https://www.googleapis.com/auth/drive.file`
     - Add: `https://www.googleapis.com/auth/drive.appdata`
   - Click "Save and Continue"
   - On "Test users", add your Google email
   - Click "Save and Continue"

5. **Create OAuth Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Application type: "Web application"
   - Name: "Vinculum Local"
   - Authorized redirect URIs:
     - Add: `http://localhost:3000/api/auth/callback/google`
   - Click "Create"
   - **IMPORTANT**: Copy your Client ID and Client Secret

### Step 2: Configure Environment Variables

1. **Create `.env.local` file**
   ```bash
   cp .env.example .env.local
   ```

2. **Edit `.env.local`** with your credentials:
   ```env
   # Google OAuth (paste your credentials from Step 1)
   GOOGLE_CLIENT_ID=your_actual_client_id_here.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_actual_client_secret_here

   # NextAuth
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=generate_a_random_secret_here
   ```

3. **Generate NEXTAUTH_SECRET**
   ```bash
   # On Linux/Mac:
   openssl rand -base64 32

   # On Windows (PowerShell):
   -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
   ```
   Copy the output and paste it as your `NEXTAUTH_SECRET`

### Step 3: Start the Application

1. **Install dependencies** (if not already done):
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```

3. **Open your browser**:
   - Navigate to: http://localhost:3000
   - You should see the Vinculum sign-in page

### Step 4: Sign In and Test

1. **Sign In**
   - Click "Sign in with Google"
   - Select your Google account
   - Grant the requested permissions (Drive access)
   - You should be redirected to the main Vinculum interface

2. **Verify the Interface**
   You should see:
   - Top navigation bar with: Library | Document | AI | Settings
   - Your email in the top right
   - "Click Library to get started" message

### Step 5: Upload Test Documents

You have two options:

#### Option A: Upload via Google Drive Web

1. Go to https://drive.google.com
2. The app will have created a folder: `/CodexLink_Data/Books/`
3. Upload a PDF file to this folder
   - You can use any PDF (research paper, book, etc.)
   - Recommended: A PDF with selectable text (not scanned images)

#### Option B: Create Test Folder Manually

If the folder doesn't exist yet:
1. Create folder: `CodexLink_Data`
2. Inside it, create: `Books`
3. Upload a PDF to `Books` folder

### Step 6: Test Core Features

#### Test 1: Browse Library
1. Click "Library" in the top navigation
2. You should see a sidebar panel open
3. Your uploaded PDF should appear in the list
4. Verify the filename is correct

#### Test 2: Open Document
1. Click on a document in the library
2. The library panel should close
3. The PDF should load and display
4. You should see:
   - The PDF on the left
   - A "Notes" panel on the right
   - Page navigation controls (Previous/Next)
   - Zoom controls (+/-)

#### Test 3: Navigate PDF
1. Try clicking "Next" and "Previous" buttons
2. Try the zoom controls (+/-)
3. Verify the PDF renders correctly at different zoom levels

#### Test 4: Create an Anchor
1. Click and drag to select a region of text in the PDF
   - You should see a blue selection rectangle while dragging
2. Release the mouse
3. Check the browser console (F12) - you should see:
   ```
   Anchor created: {page: 1, rect: {...}, quote: "..."}
   ```
4. The Notes panel should now show:
   - "Anchor Quote:" with the selected text
   - The page number
   - A Monaco editor (text area) below

#### Test 5: Write and Save Notes
1. Click in the Monaco editor (white text area)
2. Type some Markdown notes, for example:
   ```markdown
   # Important Finding

   This passage discusses...

   - Point 1
   - Point 2
   ```
3. Click the "Save" button that appears
4. You should see an alert: "Note saved successfully!"

### Step 7: Verify Data Persistence

1. **Check Google Drive**
   - Go to https://drive.google.com
   - Navigate to `/CodexLink_Data/Metadata/`
   - You should see a JSON file: `anchor_[uuid].json`
   - Click to view - it contains your anchor data

2. **Reload the Page**
   - Refresh the browser
   - Sign in again if needed
   - The document should still be in your library
   - (Note: In Phase 1, anchors are created but not re-loaded on page refresh - this is expected)

## Expected Behavior Summary

### ✅ What Should Work

- [x] Google OAuth sign-in
- [x] Library panel opens and shows documents
- [x] PDF loads and displays
- [x] Page navigation (next/previous)
- [x] Zoom in/out
- [x] Text selection (click and drag)
- [x] Anchor creation (logged to console)
- [x] Notes panel appears with anchor info
- [x] Markdown editor loads
- [x] Save button appears when typing
- [x] Anchor persists to Google Drive

### ⚠️ Known Limitations (Phase 1)

- [ ] Text extraction is simplified (shows placeholder quote)
- [ ] Anchors are not re-loaded on page refresh
- [ ] No anchor visualization overlays yet
- [ ] Notes are not fully persisted (API TODO)
- [ ] No dual-document view (Phase 2)
- [ ] No AI features (Phase 2)

## Troubleshooting

### Problem: "Unauthorized" error

**Solution**: Check your `.env.local` file:
- Ensure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Make sure there are no extra spaces or quotes
- Restart the dev server after changing `.env.local`

### Problem: "Failed to load documents"

**Solution**:
1. Verify Google Drive API is enabled in Cloud Console
2. Check that your OAuth consent screen includes Drive scopes
3. Try signing out and signing in again
4. Check browser console for detailed errors

### Problem: PDF doesn't load

**Solution**:
1. Check browser console for errors
2. Verify the PDF is in `/CodexLink_Data/Books/` folder
3. Try a different PDF (ensure it's not corrupted)
4. Clear browser cache and reload

### Problem: Can't select text in PDF

**Solution**:
- Make sure the PDF has selectable text (not a scanned image)
- Try zooming in first
- Check that you're clicking and dragging on the canvas

### Problem: Monaco editor doesn't appear

**Solution**:
1. Wait a few seconds (it loads dynamically)
2. Check browser console for loading errors
3. Try refreshing the page
4. Ensure you have a stable internet connection (CDN dependency)

## Testing Checklist

Complete this checklist to verify all Phase 1 features:

- [ ] Application starts without errors
- [ ] Can sign in with Google
- [ ] Library panel opens
- [ ] Documents appear in library (after uploading to Drive)
- [ ] Can open a PDF document
- [ ] PDF renders correctly
- [ ] Can navigate between pages
- [ ] Can zoom in and out
- [ ] Can select text by clicking and dragging
- [ ] Anchor creation is logged to console
- [ ] Notes panel shows anchor information
- [ ] Monaco editor loads and is editable
- [ ] Can write Markdown in the editor
- [ ] Save button appears when typing
- [ ] Anchor JSON file appears in Google Drive

## Next Steps

After successfully testing Phase 1, you can:

1. **Review the code** in `src/` directory
2. **Check the specifications** in `specs/docs/`
3. **Prepare for Phase 2** features (dual-document view, alignment)
4. **Report any bugs** you find

## Development Tips

### View Application Logs
```bash
# Server logs appear in the terminal where you ran `npm run dev`
# Client logs appear in browser console (F12)
```

### Test with Multiple Documents
1. Upload several PDFs to `/CodexLink_Data/Books/`
2. Test switching between documents
3. Create anchors in different documents

### Test Data Location
All metadata is stored in Google Drive:
```
/CodexLink_Data/
  /Books/          ← Your PDF files
  /Metadata/       ← Anchor JSON files (auto-created)
  /Backups/        ← Future use
```

## Questions or Issues?

If you encounter issues not covered here:
1. Check the main README.md for general information
2. Review the specifications in `specs/docs/`
3. Check browser console and server logs for error messages
