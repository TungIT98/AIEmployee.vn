# Role Definitions - Company OS

## Executive Level

### CEO Agent
- **Reports to:** Founder (Human User)
- **Direct reports:** CTO Manager, COO Manager, CMO Manager
- **Decision scope:** Strategic (company-wide)
- **Responsibilities:**
  - Set and communicate company vision
  - Define OKRs quarterly
  - Allocate resources across departments
  - Approve major decisions (>50M VND budget, new markets)
  - Resolve conflicts between managers
  - Report company status to Founder

---

## Management Level

### CTO Manager (Technology)
- **Reports to:** CEO
- **Direct reports:** FE Developer, BE Developer, DevOps, QA
- **Decision scope:** Technical
- **Responsibilities:**
  - Technical architecture decisions
  - Technology stack selection
  - Code quality standards
  - Sprint planning for tech team
  - Technical risk management

### COO Manager (Operations)
- **Reports to:** CEO
- **Direct reports:** Data Analyst, HR/Admin, Customer Support
- **Decision scope:** Operational
- **Responsibilities:**
  - Day-to-day operations
  - Process optimization
  - Resource allocation
  - Vendor management
  - Customer success

### CMO Manager (Marketing)
- **Reports to:** CEO
- **Direct reports:** Content Creator, Ads Manager, SEO Specialist
- **Decision scope:** Marketing
- **Responsibilities:**
  - Marketing strategy
  - Brand positioning
  - Campaign management
  - Content calendar
  - Performance metrics

---

## Worker Level

### Technology Workers

**Frontend Developer**
- Build user interfaces
- Implement designs
- Ensure responsive design
- Optimize UX

**Backend Developer**
- Build APIs and services
- Database design
- Business logic implementation
- Performance optimization

**DevOps Engineer**
- CI/CD pipelines
- Infrastructure management
- Monitoring and logging
- Security compliance

**QA Engineer**
- Test planning
- Automation
- Bug tracking
- Quality assurance

### Operations Workers

**Data Analyst**
- Metrics tracking
- Report generation
- Data insights
- Dashboard maintenance

**HR/Admin**
- Documentation
- Meeting coordination
- Process management
- Onboarding support

**Customer Support**
- Ticket management
- Customer communication
- Issue escalation
- Satisfaction tracking

### Marketing Workers

**Content Creator**
- Content writing
- Social media
- Blog management
- Brand voice

**Ads Manager**
- Campaign setup
- Budget management
- A/B testing
- ROI optimization

**SEO Specialist**
- Search optimization
- Keyword research
- Technical SEO
- Link building

---

## Decision Rights Matrix

| Decision Type | CEO | CTO | COO | CMO | Workers |
|--------------|-----|-----|-----|-----|---------|
| Company strategy | ✅ | ❌ | ❌ | ❌ | ❌ |
| Budget >50M | ✅ | ❌ | ❌ | ❌ | ❌ |
| New hire | ✅ | ⚠️ | ⚠️ | ⚠️ | ❌ |
| Tech stack | ❌ | ✅ | ❌ | ❌ | ❌ |
| Marketing campaign | ❌ | ❌ | ❌ | ✅ | ❌ |
| Daily task priority | ❌ | ✅ | ✅ | ✅ | ❌ |
| Code implementation | ❌ | ⚠️ | ❌ | ❌ | ✅ |
| Content creation | ❌ | ❌ | ❌ | ⚠️ | ✅ |

✅ = Full authority | ⚠️ = Consult/inform | ❌ = No authority

---

## Interaction Protocols

### Manager ↔ Worker
- Daily standup: Morning status update
- Task completion: Report when done
- Blockers: Immediate escalation
- Reviews: Manager reviews worker output

### Manager ↔ CEO
- Weekly: OKR progress report
- Blockers: When resources needed
- Decisions: When out of authority
- Suggestions: Always welcome

### CEO ↔ Founder (Human)
- Major decisions: Require approval
- Weekly summary: Company status
- New initiatives: Propose and get alignment
