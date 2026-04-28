# Blog Management Workflow - AIEmployee.vn

**Version:** 1.0
**Date:** 2026-04-09
**Owner:** Content Creator
**Approved by:** CMO Manager

---

## Overview

This document establishes the standard workflow for creating, managing, and publishing blog content for AIEmployee.vn. All blog operations must follow this process to ensure consistent quality, brand alignment, and efficient content production.

---

## 1. Content Ideation Process

### 1.1 Content Pillars

Blog content is organized around these core pillars:

| Pillar | Focus Areas |
|--------|-------------|
| AI Agents & Automation | Practical applications, implementation guides, industry trends |
| Business Productivity | Workflow optimization, team collaboration, ROI stories |
| Vietnamese Market | Local case studies, regional insights, cultural relevance |
| Product Updates | Feature announcements, release notes, how-to guides |

### 1.2 Ideation Sources

Content ideas are generated from:

1. **SEO Specialist** - keyword research, search volume data, competitor analysis
2. **Customer Support** - common questions, pain points, use cases
3. **Ads Manager** - campaign insights, audience interests
4. **Market Research** - industry trends, AI news, technology shifts
5. **Team Brainstorms** - weekly content planning sessions

### 1.3 Idea Submission

Submit ideas using the content idea template:

```
Title: [Working title]
Pillar: [AI Agents / Business Productivity / Vietnamese Market / Product Updates]
Target Audience: [Description]
Main Message: [One-sentence takeaway]
Supporting Points: [3 bullet points]
SEO Keywords: [Primary, Secondary, Long-tail]
Suggested Format: [How-to / Case Study / News / Opinion / Listicle]
Priority: [High / Medium / Low]
```

---

## 2. Editorial Calendar Management

### 2.1 Publishing Schedule

| Day | Content Type | Focus |
|-----|--------------|-------|
| Monday | How-to Guide | Technical tutorials, implementation guides |
| Wednesday | Case Study | Customer stories, ROI demonstrations |
| Friday | Industry News | Market trends, AI updates, company news |

### 2.2 Calendar Structure

The editorial calendar tracks:

- **Publication date** - scheduled publish date
- **Author** - Content Creator or guest contributor
- **Status** - Idea → Draft → Review → Approved → Scheduled → Published
- **Pillar** - Content pillar alignment
- **SEO target** - Primary keyword for the post
- **Promotion plan** - Social channels, newsletter, etc.

### 2.3 Calendar Maintenance

- **Weekly review**: Every Monday, verify upcoming week's content
- **Monthly planning**: Last week of month, plan next month's content
- **Quarterly audit**: Review performance metrics, adjust strategy

---

## 3. Review/Approval Workflow

### 3.1 Draft Submission

When draft is complete, Content Creator:

1. Save draft to `content/drafts/[YYYY-MM-DD]-[slug].md`
2. Update calendar status to "Review"
3. Notify CMO Manager via issue comment

### 3.2 Review Criteria

All content is reviewed for:

| Category | Checklist Items |
|----------|-----------------|
| Accuracy | Factual correctness, source verification, data freshness |
| SEO | Keyword placement, heading structure, meta description, image alt text |
| Brand Voice | Tone consistency, vocabulary alignment, formatting standards |
| Clarity | Clear headlines, scannable structure, action-oriented conclusions |
| Compliance | No harmful claims, proper attributions, privacy considerations |

### 3.3 Review Workflow

```
[Draft Ready]
    → CMO Manager notified
    ↓
[CMO Review]
    → Approve: Move to "Approved"
    → Request Changes: Feedback in comments, back to "Draft"
    → Reject: Archive with explanation
    ↓
[Approved]
    → Schedule publish date
    → Prepare promotion assets
```

### 3.4 Revision Standards

- **Minor revisions**: Same-day turnaround (typos, formatting)
- **Major revisions**: 48-hour turnaround (structural changes, new research)
- **Rejection reason**: Must include specific feedback for improvement

---

## 4. Publishing Checklist

### 4.1 Pre-Publication Checklist

- [ ] Final review by CMO Manager completed
- [ ] SEO metadata filled (title, meta description, URL slug)
- [ ] Featured image selected and optimized (1200x630px, <200KB)
- [ ] Images have alt text and proper attribution
- [ ] Internal links to at least 2 existing posts
- [ ] External links open in new tab
- [ ] Call-to-action included at end
- [ ] Social media snippets prepared
- [ ] Newsletter excerpt written (150 chars max)
- [ ] Publish date and time confirmed
- [ ] Category and tags assigned

### 4.2 Publishing Steps

1. **CMS Setup**
   - Create new post in WordPress/hub
   - Copy content from draft file
   - Apply formatting and layout

2. **SEO Configuration**
   - Set SEO title (60 characters max)
   - Write meta description (155 characters max)
   - Configure URL slug
   - Set featured image
   - Add category and tags

3. **Quality Check**
   - Preview on mobile and desktop
   - Check all links work
   - Verify image display
   - Test social sharing cards

4. **Publish**
   - Set scheduled time (if not immediate)
   - Click Publish
   - Confirm in calendar

### 4.3 Post-Publication Checklist

- [ ] Post published and live
- [ ] Google Search Console notified (if new content)
- [ ] Social media posts scheduled
- [ ] Newsletter sent (if applicable)
- [ ] Internal Slack notification posted
- [ ] Calendar status updated to "Published"

---

## 5. Content Performance & Reporting

### 5.1 Metrics to Track

| Metric | Target | Review Frequency |
|--------|--------|------------------|
| Page Views | >1,000/month | Monthly |
| Time on Page | >3 minutes | Monthly |
| Bounce Rate | <60% | Monthly |
| Social Shares | >50 | Per post |
| Comments | >5 | Per post |
| Conversions | Track CTA clicks | Per post |

### 5.2 Monthly Report

Content Creator provides monthly report including:

- Posts published
- Total page views
- Top 3 performing posts
- Underperforming posts analysis
- Recommended adjustments

---

## 6. File Structure

```
content/
├── published/
│   ├── 2026/
│   │   ├── Q1/
│   │   └── Q2/
│   └── index.md (master list)
├── drafts/
│   └── [YYYY-MM-DD]-[slug].md
├── templates/
│   ├── content-idea-template.md
│   └── blog-post-template.md
├── assets/
│   ├── images/
│   └── social-snippets/
└── BLOG_WORKFLOW.md (this file)
```

---

## 7. Related Documents

- [Brand Voice Guidelines](/PAP/issues/COM-XXX) - TBD
- [SEO Best Practices](/PAP/issues/COM-XXX) - TBD
- [Social Media Strategy](/PAP/issues/COM-XXX) - TBD

---

**Document Control**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-09 | Content Creator | Initial creation |

---

*This workflow is a living document. Updates require CMO Manager approval.*
