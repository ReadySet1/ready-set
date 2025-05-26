# Umami Analytics Troubleshooting Guide

## Self-Hosted Setup Configuration

### Current Configuration
- **Umami Host**: `https://analytics.readysetllc.com`
- **Website ID**: `41e73d42-53bf-4b9a-ae31-2e2d22a02a32`
- **Script URL**: `https://analytics.readysetllc.com/script.js`

## Common Issues and Solutions

### 1. No Data Appearing in Dashboard

**Symptoms:**
- Test dashboard shows Umami is loaded and working
- All metrics in Umami dashboard show 0

**Possible Causes & Solutions:**

#### A. Domain Configuration
- **Issue**: Website domain not configured in Umami settings
- **Solution**: 
  1. Log into your Umami dashboard at `https://analytics.readysetllc.com`
  2. Go to Settings → Websites
  3. Edit your website configuration
  4. Ensure the domain matches exactly (e.g., `readysetllc.com` or `www.readysetllc.com`)
  5. Make sure there are no trailing slashes or protocol prefixes

#### B. Website ID Mismatch
- **Issue**: The Website ID in your code doesn't match the one in Umami
- **Solution**:
  1. In Umami dashboard, go to Settings → Websites
  2. Copy the exact Website ID
  3. Update `src/constants.ts` with the correct ID

#### C. CORS Configuration
- **Issue**: Browser blocks requests due to CORS policy
- **Solution**: Ensure your Umami server allows requests from your domain
  
#### D. SSL/Certificate Issues
- **Issue**: HTTPS certificate problems with analytics.readysetllc.com
- **Solution**: Verify SSL certificate is valid and properly configured

### 2. Script Loading Issues

**Symptoms:**
- Script status shows as not loaded
- Console errors related to script loading

**Debugging Steps:**
1. Check browser Network tab for failed requests to `analytics.readysetllc.com/script.js`
2. Verify the script URL is accessible directly in browser
3. Check for CORS errors in console
4. Ensure proper SSL certificate

### 3. Cookie Consent Interference

**Current Behavior:**
- Umami loads by default (privacy-focused, no cookies)
- Only blocks if user explicitly rejects analytics
- User can opt-out through cookie preferences

**If Still Having Issues:**
- Clear browser localStorage: `localStorage.clear()`
- Check cookie preferences in test dashboard
- Verify consent status is not blocking Umami

## Testing and Debugging

### Use the Test Dashboard
1. Navigate to `/highlight-test`
2. Use the Umami Test Component to:
   - Verify configuration
   - Test connectivity to self-hosted instance
   - Send test events
   - Monitor logs

### Browser Console Debugging
Look for these console messages:
- `✅ Umami analytics script loaded successfully from self-hosted instance`
- `🎯 Umami is ready for tracking`
- Any error messages starting with `❌`

### Network Tab Verification
1. Open browser DevTools → Network tab
2. Filter by "analytics.readysetllc.com"
3. Look for:
   - Successful loading of `script.js`
   - POST requests to `/api/send` when events are tracked

## Manual Verification Steps

### 1. Direct Script Access
Visit `https://analytics.readysetllc.com/script.js` directly in browser:
- Should load without errors
- Should show JavaScript code (not 404 or error page)

### 2. Dashboard Access
Visit `https://analytics.readysetllc.com`:
- Should load Umami login/dashboard
- Verify SSL certificate is valid

### 3. Website Configuration in Umami
In your Umami dashboard:
1. Check Settings → Websites
2. Verify domain configuration
3. Copy Website ID and compare with code
4. Check that tracking is enabled

## Advanced Debugging

### Server-Side Logs
If you have access to your Umami server logs:
1. Check for incoming tracking requests
2. Look for errors in processing events
3. Verify database connectivity

### Database Verification
If using direct database access:
```sql
-- Check if events are being recorded
SELECT * FROM event WHERE website_id = '41e73d42-53bf-4b9a-ae31-2e2d22a02a32' 
ORDER BY created_at DESC LIMIT 10;

-- Check website configuration
SELECT * FROM website WHERE website_id = '41e73d42-53bf-4b9a-ae31-2e2d22a02a32';
```

## Environment-Specific Issues

### Development vs Production
- Ensure Umami configuration works in both environments
- Check if localhost is properly configured for development testing

### CDN/Proxy Issues
- If using CDN/proxy in front of analytics.readysetllc.com
- Ensure proper forwarding of tracking requests
- Check for request transformation issues

## Quick Fixes Checklist

- [ ] Website ID matches exactly between code and Umami dashboard
- [ ] Domain is properly configured in Umami website settings
- [ ] Script URL `https://analytics.readysetllc.com/script.js` loads successfully
- [ ] No CORS errors in browser console
- [ ] SSL certificate for analytics.readysetllc.com is valid
- [ ] Cookie preferences are not blocking analytics
- [ ] Test events appear in browser Network tab
- [ ] Umami dashboard login works properly

## Getting Help

If issues persist:
1. Use the connectivity test in the test dashboard
2. Check all items in the troubleshooting checklist
3. Share specific error messages from browser console
4. Provide Umami server logs if available
5. Verify Umami server status and configuration 