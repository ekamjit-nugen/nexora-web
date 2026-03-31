# Asset Preview Feature - Complete Workflow

**Feature:** Asset Preview & Management  
**Version:** 1.0.0  
**Last Updated:** March 31, 2026

---

## Overview

The Asset Preview workflow covers how teams upload, organize, and manage project assets (designs, videos, documents, etc.) and how assets are tracked with metadata and preview capabilities.

---

## Core Workflow: Asset Lifecycle

### Phase 1: Designer Uploads Asset

```
Designer (Sarah) opens Payment Gateway project
  ↓
Clicks on task: "Design payment form UI"
  ↓
Task detail panel shows:
  ├─ Description: "Create responsive payment form"
  ├─ Assets: (none yet)
  └─ [Upload Asset] button
  ↓
Sarah clicks "Upload Asset"
```

### Phase 2: Asset Upload Process

```
┌─────────────────────────────────────────┐
│ Upload Asset                            │
│ Task: Design payment form UI            │
├─────────────────────────────────────────┤
│ Asset Type:                             │
│ ○ Image (PNG, JPG, SVG)                 │
│ ○ Video (MP4, WebM)                     │
│ ● Design File (Figma, XD, Sketch)      │
│ ○ Document (PDF, Word)                  │
│ ○ Other                                 │
│                                         │
│ File: [Browse...] payment-form-v2.figma│
│ Size: 2.4 MB                            │
│                                         │
│ Asset Name:                             │
│ "Payment Form - v2 (Final)"             │
│                                         │
│ URL to Asset (CDN):                     │
│ https://assets.nexora.io/figma/...      │
│                                         │
│ Thumbnail (auto-generated):             │
│ [Preview Image]                         │
│                                         │
│ Metadata:                               │
│ Figma Link: [Link]                      │
│ Version: 2.0                            │
│ Created by: Sarah Chen                  │
│                                         │
│ [Upload]                                │
└─────────────────────────────────────────┘
  ↓
System processes upload
  ├─ Upload to CDN
  ├─ Generate thumbnail
  ├─ Extract metadata
  ├─ Create preview
  └─ Index in database
  ↓
┌─────────────────────────────────────────┐
│ ✓ Asset Uploaded                        │
│                                         │
│ Asset: payment-form-v2.figma            │
│ Size: 2.4 MB                            │
│ Type: Figma Design File                 │
│ URL: https://assets.nexora.io/...       │
│                                         │
│ Preview: [Thumbnail shown]              │
│ Metadata: Auto-extracted                │
│                                         │
│ [View Asset] [Copy Link] [Share]        │
└─────────────────────────────────────────┘
  ↓
Notifications sent
  ├─ Task linked to asset
  ├─ Team notified: "New design available"
  └─ Asset indexed for search
```

### Phase 3: Asset Organization

```
Project has multiple assets now:
  │
  ├─ Figma Design Files:
  │  ├─ Payment Form - v1 (outdated)
  │  ├─ Payment Form - v2 (current)
  │  └─ Payment Summary - v1
  │
  ├─ Wireframes:
  │  ├─ Mobile mockup.pdf
  │  └─ Desktop mockup.pdf
  │
  └─ Prototypes:
     ├─ Interactive prototype.mp4
     └─ Demo video.mp4
  ↓
Developer can view all assets:
  ├─ See thumbnails
  ├─ Filter by type
  ├─ Sort by date
  └─ Preview before opening
```

### Phase 4: Asset Preview

```
Developer (John) clicks on payment form design
  ↓
┌─────────────────────────────────────────┐
│ Asset Preview                           │
│ Payment Form - v2 (Final)               │
├─────────────────────────────────────────┤
│ [Thumbnail / Preview Image]             │
│                                         │
│ Details:                                │
│ Type: Figma Design File                 │
│ Size: 2.4 MB                            │
│ Uploaded: Mar 31, 2026 at 2:15 PM       │
│ Uploaded by: Sarah Chen                 │
│ Task: Design payment form UI            │
│                                         │
│ Dimensions: 1920 x 1080                 │
│ Format: Figma                           │
│ Version: 2.0                            │
│                                         │
│ External Link:                          │
│ [View in Figma] [Copy Link]             │
│ [Download] [View Larger]                │
│                                         │
│ Comments (2):                           │
│ Sarah: "Final version ready for dev"    │
│ John: "Great! Starting implementation"  │
│                                         │
│ [Leave Comment] [Download] [Share]      │
│ [Show Versions]                         │
└─────────────────────────────────────────┘
```

### Phase 5: Video Asset Preview

```
QA wants to review demo video
  ↓
Clicks on "Interactive prototype.mp4"
  ↓
┌─────────────────────────────────────────┐
│ Video Asset                             │
│ Interactive Prototype Demo              │
├─────────────────────────────────────────┤
│ [Video Player]                          │
│ ▶ ────────────○────────────────── 2:15  │
│   Duration: 2 min 15 sec                │
│                                         │
│ Details:                                │
│ Type: Video (MP4)                       │
│ Size: 45 MB                             │
│ Resolution: 1920 x 1080 @ 30fps         │
│ Duration: 2:15                          │
│ Uploaded: Mar 30, 2026                  │
│ Uploaded by: Designer Team              │
│                                         │
│ Preview frames:                         │
│ [Frame 1: 0s] [Frame 2: 45s] [Frame 3: 90s]
│                                         │
│ [Play Fullscreen] [Download] [Share]    │
│ [Leave Comment]                         │
└─────────────────────────────────────────┘
  ↓
QA leaves comment:
  "Demo looks great! One small issue in
   confirmation flow at 1:30 mark"
```

### Phase 6: Asset Versioning

```
Sarah updates the design and uploads v3
  ↓
┌─────────────────────────────────────────┐
│ Asset Versions                          │
│ Payment Form Design                     │
├─────────────────────────────────────────┤
│ ✓ v2.0 (Final) - Current                │
│   - Uploaded: Mar 31, 2:15 PM           │
│   - By: Sarah Chen                      │
│   - Notes: "Ready for dev"              │
│   - Comments: 2                         │
│   [View] [Download] [Restore]           │
│                                         │
│ ○ v1.1 (Previous)                       │
│   - Uploaded: Mar 30, 4:45 PM           │
│   - By: Sarah Chen                      │
│   - Notes: "Feedback incorporated"      │
│   [View] [Download] [Restore]           │
│                                         │
│ ○ v1.0 (Initial)                        │
│   - Uploaded: Mar 28, 10:00 AM          │
│   - By: Sarah Chen                      │
│   - Notes: "First draft"                │
│   [View] [Download] [Restore]           │
│                                         │
│ [Compare Versions]                      │
└─────────────────────────────────────────┘
  ↓
Developer compares v1 → v2
  ├─ Side-by-side view
  ├─ Highlights changes
  └─ Understands evolution
```

### Phase 7: Sharing Assets

```
Sarah wants to share design with client
  ↓
Clicks "Share" on asset
  ↓
┌─────────────────────────────────────────┐
│ Share Asset                             │
│ Payment Form - v2 (Final)               │
├─────────────────────────────────────────┤
│ Sharing Method:                         │
│ ○ Email file                            │
│ ○ Generate shareable link               │
│ ● Share with team members               │
│                                         │
│ Recipients:                             │
│ ☑ John Doe (Developer)                  │
│ ☑ Mike Johnson (QA)                     │
│ ☐ Lisa Park (PM)                        │
│ ☑ Client Stakeholder                    │
│                                         │
│ Permissions:                            │
│ ○ View only                             │
│ ○ View + Download                       │
│ ● View + Download + Comment             │
│                                         │
│ Expiration:                             │
│ ○ Never                                 │
│ ○ 7 days                                │
│ ○ 30 days                               │
│ ● Custom: [Jun 30, 2026]                │
│                                         │
│ Message: "Final design for payment flow"│
│ [Share]                                 │
└─────────────────────────────────────────┘
  ↓
Recipients receive email with:
  ├─ Asset thumbnail
  ├─ Asset details
  ├─ Link to preview/download
  └─ Comment thread
```

---

## Asset Management Workflows

### Workflow A: Design-to-Development Handoff

```
1. Designer creates mockup
   └─ Uploads: Figma design file (v1)

2. PM reviews design
   ├─ Views asset
   ├─ Leaves comments: "Love the layout"
   └─ Approves for development

3. Developer reviews design
   ├─ Opens asset preview
   ├─ Checks specifications
   ├─ Views dimensions & colors
   ├─ Asks questions in comments
   └─ Starts implementation

4. Designer makes adjustments
   ├─ Updates design based on feedback
   └─ Uploads: Figma design file (v2)

5. Developer reviews updated design
   ├─ Views new version
   ├─ Sees what changed (version diff)
   └─ Implements adjustments

6. Feature complete
   └─ Asset remains in task for reference
```

### Workflow B: Video Demo for Stakeholders

```
1. QA creates demo video
   ├─ Records: Feature walkthrough
   ├─ Duration: 3 minutes
   ├─ Resolution: 1080p
   └─ Uploads: Demo.mp4

2. PM reviews video
   ├─ Watches full video
   ├─ Notes: "Looks great for stakeholder demo"
   └─ Approves distribution

3. PM shares with stakeholders
   ├─ Generates: Shareable link (expires 1 month)
   ├─ Sends: Email with link
   └─ Sets: "View only" permissions

4. Stakeholders watch video
   ├─ Client views feature
   ├─ Sees working prototype
   ├─ Provides feedback
   └─ Approves for release

5. Archive after launch
   ├─ Move to "Archive" folder
   ├─ Mark as: Historical reference
   └─ Keep for: Future reference
```

### Workflow C: Multiple Asset Types in One Task

```
Task: "Implement user dashboard"
  │
  ├─ Assets:
  │  ├─ Dashboard Design (Figma file) - v2
  │  ├─ Dashboard Wireframe (PDF) - v1
  │  ├─ Data Flow Diagram (PNG) - v1
  │  ├─ Demo Video (MP4) - v1
  │  ├─ Technical Spec (PDF) - v3
  │  └─ API Documentation (JSON) - v1
  │
  ├─ Developer workflow:
  │  1. Views wireframe (understand layout)
  │  2. Views design (get pixel-perfect specs)
  │  3. Reviews data flow (understand data model)
  │  4. Watches demo video (see expected behavior)
  │  5. Reads technical spec (understand requirements)
  │  6. Checks API docs (understand endpoints)
  │
  └─ Result: Clear understanding before coding
```

---

## Asset Analytics

### Phase 1: View Asset Statistics

```
PM clicks "Assets" → "Statistics"
  ↓
┌─────────────────────────────────────────┐
│ Asset Statistics                        │
│ Project: Payment Gateway                │
│ Period: March 2026                      │
├─────────────────────────────────────────┤
│ Total Assets: 145                       │
│ Total Size: 512 MB                      │
│                                         │
│ By Type:                                │
│ Images: 45 (31%) - 120 MB               │
│ Videos: 12 (8%) - 280 MB                │
│ Designs: 28 (19%) - 65 MB               │
│ Documents: 35 (24%) - 35 MB             │
│ Other: 25 (17%) - 12 MB                 │
│                                         │
│ Recent Uploads:                         │
│ Today: 3 assets (12 MB)                 │
│ This week: 18 assets (85 MB)            │
│ This month: 45 assets (212 MB)          │
│                                         │
│ Top Uploaders:                          │
│ 1. Sarah Chen: 52 assets (180 MB)       │
│ 2. John Doe: 35 assets (140 MB)         │
│ 3. Mike Johnson: 28 assets (105 MB)     │
│ 4. Lisa Park: 18 assets (72 MB)         │
│ 5. Others: 12 assets (15 MB)            │
│                                         │
│ Most Downloaded:                        │
│ 1. Dashboard Design v2: 23 downloads    │
│ 2. UI Kit PDF: 19 downloads             │
│ 3. Demo Video: 17 downloads             │
│                                         │
│ [Export Statistics] [View Trends]       │
└─────────────────────────────────────────┘
```

### Phase 2: Asset Cleanup

```
Admin reviews old assets
  ├─ Assets older than 90 days: 23
  ├─ Large unused files: 5
  ├─ Deprecated designs: 8
  ↓
Decision: Archive old assets
  ├─ Move to archive folder
  ├─ Reduce active project size
  ├─ Keep for historical reference
  └─ Free up storage space
  ↓
Result: Active project size: 512 MB → 320 MB
```

---

## Error Handling

### Scenario: File Too Large

```
Developer tries to upload 500 MB video
  ↓
System check: Max file size is 100 MB
  ↓
Error: "File too large (500 MB > 100 MB limit)"
  ├─ Suggestion: "Compress video or split into parts"
  ├─ Helpful link: "Video compression guide"
  └─ Alternative: "Request larger quota from admin"
```

### Scenario: Unsupported File Format

```
User tries to upload: unknown.xyz file
  ↓
System check: Format not in supported list
  ↓
Error: "Unsupported file format: .xyz"
  ├─ Supported formats: PNG, JPG, SVG, MP4, WebM, PDF, etc.
  ├─ Suggestion: "Convert file to supported format"
  └─ Help: "File format guide"
```

### Scenario: Asset Link Broken

```
User clicks "View in Figma" link
  ↓
External link returns 404 (file moved)
  ↓
Error: "Cannot access Figma file"
  ├─ Reason: "Link may have expired or been deleted"
  ├─ Options: 
  │  1. Contact asset uploader
  │  2. View cached preview (if available)
  │  3. Download asset if available
  └─ Fallback: Show thumbnail + cached metadata
```

---

## Role-Based Asset Access

| Action | Developer | Designer | PM | Admin |
|--------|-----------|----------|-----|-------|
| View assets | ✅ | ✅ | ✅ | ✅ |
| Upload asset | ✅ | ✅ | ✅ | ✅ |
| Delete asset | ❌ | ✅ | ✅ | ✅ |
| Manage versions | ❌ | ✅ | ✅ | ✅ |
| Share asset | ✅ | ✅ | ✅ | ✅ |
| View statistics | ⚠️* | ✅ | ✅ | ✅ |
| Export assets | ✅ | ✅ | ✅ | ✅ |
| Cleanup/Archive | ❌ | ❌ | ✅ | ✅ |

*Limited to assigned projects only

---

**End of Asset Preview Workflow**
