# Bruno Collection Import Guide

## ✅ Fixed Import Issues

The collection has been updated with the correct Bruno format:
- Added `collection.bru` files
- Updated `bruno.json` format
- Added folder `collection.bru` files

## 🚀 How to Import (Step-by-Step)

### Method 1: Drag and Drop (Recommended)

1. **Open Bruno application**
2. **Locate the collection folder** in Finder:
   ```
   docs/catervalley/bruno-collection/CaterValley-API-Tests
   ```
3. **Drag the entire `CaterValley-API-Tests` folder** into Bruno
4. The collection should import automatically! ✅

### Method 2: Import Menu

1. **Open Bruno**
2. Click the **⋯** (three dots) in the top-left corner
3. Select **Import Collection**
4. Select **Bruno Collection** from the options
5. **Navigate to and select** the folder:
   ```
   /Users/ealanis/development/current-projects/ready-set/docs/catervalley/bruno-collection/CaterValley-API-Tests
   ```
6. Click **Import**

### Method 3: File → Open Collection

1. **Open Bruno**
2. Go to **File** → **Open Collection** (or ⌘+O on Mac)
3. **Navigate to and select** the folder:
   ```
   /Users/ealanis/development/current-projects/ready-set/docs/catervalley/bruno-collection/CaterValley-API-Tests
   ```
4. Click **Open**

## 📂 Collection Structure

After import, you should see:

```
CaterValley API Tests
├── 📁 Bug Fix Tests (3 requests)
│   ├── 1. Client Reported Issue (1.1 Miles)
│   ├── 2. Minimum Fee Enforcement
│   └── 3. Mileage Rate Verification (15 Miles)
├── 📁 Tier Tests (4 requests)
│   ├── Tier 1 - Small Order (Under 10 Miles)
│   ├── Tier 2 - Medium Order (26 People)
│   ├── Tier 3 - Large Order (50 People)
│   └── Tier 5 - Enterprise (120 People)
└── 📁 Complete Flow (3 requests)
    ├── 1. Create Draft Order
    ├── 2. Update Order
    └── 3. Confirm Order
```

## 🌍 Select Environment

After importing:

1. Click the **environment dropdown** (top-right corner)
2. Choose:
   - **Local** → for `http://localhost:3000`
   - **Production** → for `https://readysetllc.com`

## ✅ Verify Import

To verify the import was successful:

1. **Check environments**
   - You should see "Local" and "Production" in the environment dropdown
   
2. **Open a request**
   - Click "Bug Fix Tests" → "1. Client Reported Issue"
   - You should see the full request with headers and body
   
3. **Check variables**
   - Variables like `{{BASE_URL}}` should be highlighted
   - Headers should include `{{PARTNER}}` and `{{API_KEY}}`

## 🧪 Run a Test

To verify everything works:

1. **Select "Local" environment** (if testing locally)
2. **Make sure your dev server is running**:
   ```bash
   cd /Users/ealanis/development/current-projects/ready-set
   pnpm dev
   ```
3. **Open**: "Bug Fix Tests" → "1. Client Reported Issue (1.1 Miles)"
4. **Click Send**
5. **Expected result**: 
   - Status: 200 OK
   - `deliveryPrice`: 42.50
   - All tests pass ✅

## 🐛 Troubleshooting

### Issue: "Could not find collection"

**Solution:**
- Make sure you're selecting the **folder** `CaterValley-API-Tests`, not individual files
- The folder must contain `collection.bru` file

### Issue: "Invalid collection format"

**Solution:**
- Make sure you're using Bruno **v1.x** or later
- Try updating Bruno to the latest version
- Use drag-and-drop method instead

### Issue: Variables not working ({{BASE_URL}})

**Solution:**
1. Click environment dropdown (top-right)
2. Make sure an environment is selected (Local or Production)
3. If no environments show, check that `environments/` folder was imported

### Issue: "Connection refused" when running tests

**Solution:**
- If using **Local** environment, make sure dev server is running:
  ```bash
  pnpm dev
  ```
- If using **Production** environment, make sure you have network access

## 📊 Expected Test Results

When all tests run successfully, you should see:

| Test Name | Expected Fee | Status |
|-----------|--------------|--------|
| Client Reported Issue | $42.50 | ✅ Pass |
| Minimum Fee Enforcement | $42.50 | ✅ Pass |
| Mileage Rate Verification | $90.50 | ✅ Pass |
| Tier 1 - Small Order | $42.50 | ✅ Pass |
| Tier 2 - Medium Order | $52.50 | ✅ Pass |
| Tier 3 - Large Order | $62.50 | ✅ Pass |
| Tier 5 - Enterprise | $150.00 | ✅ Pass |
| Complete Flow (3 steps) | All succeed | ✅ Pass |

## 📝 Notes

- **Bruno uses file-based collections** - this is perfect for Git!
- **The collection folder is tracked in Git** - team can share
- **Changes to requests are automatically saved** to the files
- **No cloud sync** - all data stays local and private

## 🆘 Still Having Issues?

If you continue to have problems:

1. **Check Bruno version**: Should be v1.0.0 or later
2. **Try the absolute path**:
   ```
   /Users/ealanis/development/current-projects/ready-set/docs/catervalley/bruno-collection/CaterValley-API-Tests
   ```
3. **Verify files exist**:
   ```bash
   ls -la docs/catervalley/bruno-collection/CaterValley-API-Tests/
   ```
   Should show: `collection.bru`, `bruno.json`, `environments/`, folders

4. **Check Bruno logs**: Help → Show Logs

## 📚 Resources

- **Collection README**: `CaterValley-API-Tests/README.md`
- **Bruno Docs**: https://docs.usebruno.com/
- **Fix Summary**: `../BUG_FIX_DELIVERY_FEE_SUMMARY.md`
- **Postman Alternative**: `../POSTMAN_TEST_EXAMPLES.md`

---

**Issue Tracker:** REA-183  
**Branch:** `fix/catervalley-delivery-fee-130`  
**Last Updated:** November 13, 2025

