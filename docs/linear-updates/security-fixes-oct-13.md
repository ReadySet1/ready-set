# Linear Issue Updates - Security Fixes (October 13, 2025)

This document contains all the update content for Linear issues related to today's security fixes.

---

## 1. REA-156: form-data Unsafe Random Function (CRITICAL)

**Linear Issue**: https://linear.app/ready-set-llc/issue/REA-156/security-critical-fix-form-data-unsafe-random-function-vulnerability

### Status Update: ✅ Done

### Comment to Add:

```markdown
## ✅ RESOLVED - October 13, 2025

### Summary
Successfully fixed the critical form-data vulnerability (CVE-2025-7783) by updating from v4.0.3 to v4.0.4 using pnpm package overrides.

### Changes Implemented
**File**: `package.json`
- Added `"form-data@<4.0.4": ">=4.0.4"` to pnpm.overrides
- Forces all transitive dependencies to use patched version

**Result**: All instances of form-data now use v4.0.4 with cryptographically secure random boundary generation

### Technical Details
- **Before**: form-data used `Math.random()` for multipart boundaries (predictable)
- **After**: Uses `crypto.randomBytes()` (cryptographically secure)
- **Impact**: Eliminates request injection vulnerability

### Affected Dependencies Updated
✅ axios@1.10.0 → form-data@4.0.4
✅ sanity@3.99.0 → form-data@4.0.4
✅ jsdom@25.0.1 → form-data@4.0.4

### Verification
✅ TypeScript check passed
✅ Production build successful
✅ No breaking changes detected
✅ All tests pass (no new failures)

### Time Tracking
- **Estimated**: 2-3 hours
- **Actual**: 2 hours ✅

### Resources
- **PR**: Merged to preview-development (commit a09b78d)
- **GitHub Alert**: [#2](https://github.com/ReadySet1/ready-set/security/dependabot/2) - Will auto-close on merge to main
- **Documentation**: `docs/security-fixes/REA-156-form-data-fix.md`

### Next Steps
- [x] Fix implemented and tested
- [x] Committed to preview-development
- [ ] Deploy to production
- [ ] Verify GitHub alert closes
```

---

## 2. NEW ISSUE NEEDED: axios DoS Vulnerability (HIGH)

**Create New Linear Issue with:**

### Title
```
Security (High): Fix axios DoS via data: URI vulnerability
```

### Description
```markdown
## 🔒 Security Issue: axios DoS Vulnerability

**Severity**: High (CVSS 7.5)
**CVE**: CVE-2025-58754
**GHSA**: GHSA-4hjh-wcwx-xvwj
**GitHub Alert**: [#10](https://github.com/ReadySet1/ready-set/security/dependabot/10)

---

## Vulnerability Description

axios versions < 1.12.0 are vulnerable to denial of service attacks through unvalidated `data:` URI payloads. When axios receives a data: URI, it decodes the entire Base64 payload into memory without respecting `maxContentLength` or `maxBodyLength` settings.

### Attack Scenario
```javascript
// Attacker provides large data: URI
const malicious = 'data:application/octet-stream;base64,' + 'A'.repeat(160_000_000);

// axios decodes entire 120MB into memory, ignoring size limits
await axios.get(malicious, {
  maxContentLength: 8 * 1024,  // ❌ Ignored!
  maxBodyLength: 8 * 1024      // ❌ Ignored!
});

// Result: Out of memory crash (DoS)
```

### Impact
- **Affected**: All server-side axios HTTP requests
- **Risk**: Attackers can crash Node.js process via large data: URIs
- **Scope**: API layer, external integrations (SendGrid, Sanity)

---

## ✅ Resolution

**Fixed**: October 13, 2025
**Method**: Direct version update

### Changes
- Updated axios from **1.10.0** → **1.12.2**
- File: `package.json` dependencies

### Fix Details
The patched version now enforces size limits for data: URIs:
- Validates payload size before decoding
- Respects `maxContentLength` setting
- Rejects oversized payloads with error

### Verification
✅ axios@1.12.2 installed and verified
✅ TypeScript check passed
✅ Production build successful
✅ No breaking changes detected

---

## 📊 Time Tracking
- **Estimated**: 3-4 hours
- **Actual**: 1 hour ✅

---

## 📚 Resources
- **Branch**: `security/high-severity-dependabot-fixes`
- **PR**: [#49](https://github.com/ReadySet1/ready-set/pull/49)
- **Documentation**: `docs/security-fixes/HIGH-SEVERITY-axios-tarfs-fixes.md`
- **CVE Details**: https://nvd.nist.gov/vuln/detail/CVE-2025-58754
- **GitHub Advisory**: https://github.com/advisories/GHSA-4hjh-wcwx-xvwj

---

## 📋 Checklist
- [x] Vulnerability analyzed
- [x] Fix implemented (axios@1.12.2)
- [x] Tests passed
- [x] Build successful
- [x] Documentation created
- [x] Committed and pushed
- [ ] PR merged to preview-development
- [ ] Deployed to production
- [ ] GitHub alert verified closed
```

### Labels
- `security`
- `high-priority`
- `dependabot`

### Project
Add to: **Security Alerts Resolution - Critical**

### Status
**Done** (since it's already fixed)

---

## 3. NEW ISSUE NEEDED: tar-fs Symlink Bypass (HIGH)

**Create New Linear Issue with:**

### Title
```
Security (High): Fix tar-fs symlink validation bypass vulnerability
```

### Description
```markdown
## 🔒 Security Issue: tar-fs Symlink Bypass

**Severity**: High (CVSS 8.7)
**CVE**: CVE-2025-59343
**GHSA**: GHSA-vj76-c3g6-qr5v
**GitHub Alerts**: [#7](https://github.com/ReadySet1/ready-set/security/dependabot/7), [#8](https://github.com/ReadySet1/ready-set/security/dependabot/8)

---

## Vulnerability Description

tar-fs versions < 3.1.1 / < 2.1.4 have a symlink validation bypass vulnerability. Specially crafted tarballs with predictable destination directories can exploit symlink handling to write files outside the intended extraction directory (path traversal).

### Attack Scenario
```bash
# Attacker creates malicious tarball with symlink
tar -czf malicious.tar.gz \
  --add-file=../../etc/passwd \
  --transform='s|.*/||'

# When extracted, symlinks escape destination directory
# Allowing arbitrary file writes on the filesystem
```

### Impact
- **Affected**: Sanity CMS archive imports, build tools
- **Risk**: Path traversal, arbitrary file writes
- **Scope**: Archive extraction operations

---

## ✅ Resolution

**Fixed**: October 13, 2025
**Method**: pnpm package overrides (transitive dependency)

### Changes
Updated tar-fs to **3.1.1** via pnpm overrides:

```json
// package.json
{
  "pnpm": {
    "overrides": {
      "tar-fs@<2.1.4": ">=2.1.4",
      "tar-fs@>=3.0.0 <3.1.1": ">=3.1.1",
      "tar-fs": ">=3.1.1"
    }
  }
}
```

### Before
- tar-fs@2.1.3 (vulnerable)
- tar-fs@3.1.0 (vulnerable)

### After
- All tar-fs dependencies → 3.1.1 ✅

### Fix Details
The patched version adds strict symlink validation:
- Validates symlink targets stay within destination
- Rejects symlinks pointing outside extraction directory
- Prevents path traversal attacks

### Dependency Tree (all updated to 3.1.1)
```
sanity@3.99.0
├── @sanity/import@3.38.3 → tar-fs@3.1.1 ✅
└── tar-fs@3.1.1 ✅
```

### Verification
✅ tar-fs@3.1.1 installed across all dependencies
✅ TypeScript check passed
✅ Production build successful
✅ No breaking changes detected

---

## 📊 Time Tracking
- **Estimated**: 2-3 hours
- **Actual**: 2 hours ✅

---

## 📚 Resources
- **Branch**: `security/high-severity-dependabot-fixes`
- **PR**: [#49](https://github.com/ReadySet1/ready-set/pull/49)
- **Documentation**: `docs/security-fixes/HIGH-SEVERITY-axios-tarfs-fixes.md`
- **CVE Details**: https://nvd.nist.gov/vuln/detail/CVE-2025-59343
- **GitHub Advisory**: https://github.com/advisories/GHSA-vj76-c3g6-qr5v

---

## 📋 Checklist
- [x] Vulnerability analyzed
- [x] Fix implemented (tar-fs@3.1.1)
- [x] Tests passed
- [x] Build successful
- [x] Documentation created
- [x] Committed and pushed
- [ ] PR merged to preview-development
- [ ] Deployed to production
- [ ] GitHub alerts verified closed (both #7 and #8)
```

### Labels
- `security`
- `high-priority`
- `dependabot`

### Project
Add to: **Security Alerts Resolution - Critical**

### Status
**Done** (since it's already fixed)

---

## 4. UPDATE: Security Alerts Resolution Project

**Project**: https://linear.app/ready-set-llc/project/security-alerts-resolution-critical-b088d4f0e516/overview

### Project Description Update

Add this to the project description:

```markdown
## ✅ Progress Update - October 13, 2025

### Completed Today
Successfully resolved **ALL Critical and High severity Dependabot alerts**:

1. ✅ **REA-156** - form-data unsafe random function (Critical)
   - CVE-2025-7783 (CVSS 9.4)
   - Fixed: form-data@4.0.3 → 4.0.4
   - Time: 2 hours

2. ✅ **axios DoS vulnerability** (High)
   - CVE-2025-58754 (CVSS 7.5)
   - Fixed: axios@1.10.0 → 1.12.2
   - Time: 1 hour

3. ✅ **tar-fs symlink bypass** (High)
   - CVE-2025-59343 (CVSS 8.7)
   - Fixed: tar-fs → 3.1.1
   - Time: 2 hours

### Security Status
- **Before**: 8 total alerts (1 Critical, 2 High, 5 Low)
- **After**: 5 total alerts (0 Critical, 0 High, 5 Low)
- **Reduction**: 63% overall, 100% Critical+High resolved! 🎉

### Pull Requests
- **PR #49**: High severity fixes (axios + tar-fs)
- **Branch**: Critical fix already in preview-development

### Next Steps
1. Review and merge PR #49
2. Deploy to production
3. Verify all GitHub alerts auto-close
4. Address remaining Low severity alerts (optional)

### Documentation
- `docs/security-fixes/REA-156-form-data-fix.md`
- `docs/security-fixes/HIGH-SEVERITY-axios-tarfs-fixes.md`
- `docs/to-implement/dependabot-critical-high-milestones.md`
```

---

## Summary of Linear Actions Needed

### Immediate Actions:

1. **Update REA-156** ✅
   - Status: Change to "Done"
   - Add comment with resolution details (see above)

2. **Create New Issue: axios** 📝
   - Copy title and description from above
   - Add labels: `security`, `high-priority`, `dependabot`
   - Add to Security Alerts project
   - Set status: "Done"

3. **Create New Issue: tar-fs** 📝
   - Copy title and description from above
   - Add labels: `security`, `high-priority`, `dependabot`
   - Add to Security Alerts project
   - Set status: "Done"

4. **Update Project Description** 📝
   - Add progress update to project overview
   - Update milestone status

---

## Quick Copy-Paste Checklist

```
☐ REA-156 → Status: Done → Add resolution comment
☐ Create axios issue → Status: Done
☐ Create tar-fs issue → Status: Done
☐ Update Security Alerts project description
☐ Link PR #49 to all issues
☐ Update milestone progress
```

---

All content is ready to copy-paste into Linear! 🎯
