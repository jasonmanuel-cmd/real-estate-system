# CA Off-Market Deal Engine

A private, mobile-first real estate investment platform for finding off-market properties in California using public records data and sophisticated signal stacking.

## 🎯 Mission

Find investor-friendly properties (SFR, Land, Multifamily, Commercial) in California by analyzing public records to identify motivated sellers through distress signals, ownership patterns, and market indicators.

## ✨ Key Features

### Core Capabilities
- **Signal Stacking Engine**: 10+ signals derived from public records (non-owner occupied, long ownership, recent deeds, code violations, etc.)
- **Scoring Algorithm**: 0-100 scoring with configurable weights and top reasons
- **Multi-Strategy Deal Calculator**: Wholesale, BRRRR, Rental, Multifamily, Commercial, and Land analysis
- **Mini-CRM**: Track leads through pipeline (New → Researched → Mailed → Called → Under Contract)
- **Export Tools**: Generate mailing lists, call sheets, and property data exports
- **ETL Framework**: Modular data ingestion from county assessor/recorder offices

### Investment Analysis
- **Wholesale MAO**: Calculate Maximum Allowable Offer based on ARV, rehab, and margins
- **BRRRR Strategy**: Determine max purchase price for refinance scenarios
- **Rental Analysis**: DSCR-based pricing for buy-and-hold investors
- **Multifamily/Commercial**: Cap rate and NOI-based valuations
- **Land Deals**: Percentage-of-market offers adjusted for characteristics

### Privacy & Compliance
- **No MLS Scraping**: All data from public records or lawful sources
- **No Unauthorized Contact Harvesting**: Owner names and mailing addresses only
- **Optional Enrichment**: Gated phone/email enrichment with compliance checks
- **DNC Management**: Built-in Do Not Call list and suppression tracking
- **Audit Logging**: All actions logged for compliance

## 🏗️ Architecture

### Tech Stack
- **Backend**: Node.js + Express + TypeScript + Prisma ORM
- **Database**: PostgreSQL
- **Frontend**: Next.js 14 + React + TypeScript + Tailwind CSS
- **Authentication**: JWT + TOTP (2FA)
- **Scheduler**: node-cron for ETL jobs
- **Deployment**: Docker + Docker Compose

### Database Schema

**Core Tables:**
- `parcels`: Property data (APN, address, characteristics, assessed values)
- `owners`: Owner information (name, mailing address, entity type)
- `deeds`: Recorder data (sales, transfers, deed types)
- `signals`: Generated investment signals
- `scores`: Calculated 0-100 scores with explanations
- `leads`: CRM records wrapping parcels
- `outreach_logs`: Contact attempt tracking

**Supporting Tables:**
- `users`: Authentication and MFA
- `audit_logs`: Compliance and security
- `etl_jobs`: Data pipeline tracking
- `score_weights`: Configurable scoring parameters

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- npm or yarn
- (Optional) Docker and Docker Compose

### Option 1: Docker (Recommended)

1. **Clone and configure:**
```bash
git clone <repository-url>
cd real-estate-system
cp .env.example .env
```

2. **Edit `.env` with your settings:**
```env
# Database
DB_PASSWORD=your_secure_password

# Authentication
JWT_SECRET=your_super_secret_jwt_key_minimum_32_chars

# Optional: Enable ETL scheduler
ETL_ENABLED=true
ETL_SCHEDULE="0 2 * * *"  # 2 AM daily

# API URL (for production)
API_URL=https://your-domain.com
```

3. **Start services:**
```bash
docker-compose up -d
```

4. **Run database migrations:**
```bash
docker-compose exec backend npx prisma migrate deploy
```

5. **Create first user:**
```bash
docker-compose exec backend npx ts-node scripts/create-admin.ts
```

6. **Access the application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Health: http://localhost:3001/health

### Option 2: Local Development

1. **Install dependencies:**
```bash
npm install
```

2. **Set up environment:**
```bash
cp .env.example .env
# Edit .env with your database credentials and secrets
```

3. **Set up database:**
```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

4. **Start development servers:**
```bash
# From root directory
npm run dev

# Or individually:
npm run dev:backend  # API on :3001
npm run dev:frontend # Web on :3000
```

## 📊 Data Ingestion (ETL)

### Kern County Setup (Example)

The system includes a template adapter for Kern County assessor data. Customize based on your data source:

**Option A: CSV Upload**
1. Download assessor data from Kern County website
2. Place CSV in `./data/kern_assessor.csv`
3. Run ETL:
```bash
npm run etl:run -- kern_county_assessor
```

**Option B: Automated Download**
1. Set `KERN_COUNTY_DATA_SOURCE_URL` in `.env`
2. ETL will download automatically

**Option C: API Integration**
1. Modify `backend/src/etl/adapters/kernCountyAssessorAdapter.ts`
2. Implement `extract()` method for API calls

### Field Mapping

Update the `transform()` method in the adapter to map county-specific fields:

```typescript
// Common assessor field names:
APN, SITUS_ADDRESS, OWNER_NAME, MAIL_ADDRESS
ASSESSED_VALUE, LAND_USE, YEAR_BUILT, SQUARE_FEET
```

### Adding More Counties

1. Create new adapter: `backend/src/etl/adapters/[county]AssessorAdapter.ts`
2. Implement `EtlAdapter` interface
3. Register in `backend/src/etl/scheduler.ts`
4. Run: `npm run etl:run -- [county]_assessor`

### ETL Schedule

Modify `ETL_SCHEDULE` in `.env` using cron syntax:
- `0 2 * * *` = 2 AM daily
- `0 0 * * 0` = Midnight every Sunday
- `0 */6 * * *` = Every 6 hours

## 🔐 Authentication & Security

### First-Time Setup

1. **Create admin user:**
```bash
cd backend
npx ts-node scripts/create-admin.ts --email damon@example.com --password YourSecurePassword --name "Damon"
```

2. **Enable MFA (Recommended):**
- Log in to the app
- Go to Settings → Security
- Scan QR code with authenticator app (Google Authenticator, Authy, etc.)
- Enter 6-digit code to verify

### Security Features
- bcrypt password hashing (12 rounds)
- JWT tokens with 7-day expiry
- TOTP-based 2FA
- Rate limiting (100 requests per 15 minutes)
- Helmet.js security headers
- CORS configuration
- Audit logging for all sensitive actions

## 📱 Using the App

### Lead Feed (Main Screen)

**Filters:**
- County / City / ZIP
- Property Type: SFR, Land, Multifamily, Commercial
- Score range (0-100)
- Status: New, Researched, Mailed, Called, etc.
- Signals: Non-owner occupied, Long ownership, Code cases, etc.

**Sort By:**
- Score (highest first)
- Newest data
- Recently updated

**Each card shows:**
- Property address and APN
- Score with top 2 reasons
- Property type and characteristics
- Owner occupancy status
- Quick actions: View, Save, Hide

### Property Profile

**Overview Tab:**
- Property details (address, APN, size, year built)
- Owner name and mailing address
- Map pin and Street View link

**Signals Tab:**
- All triggered signals with dates
- Severity levels (1-5)
- Signal explanations

**Deal Snapshot Tab:**
- ARV estimate (from comps)
- Rent estimate
- Rehab heuristic (light/medium/heavy)
- Offer ranges for each strategy:
  - Wholesale MAO
  - BRRRR max buy
  - Rental max price (DSCR-based)
  - Multifamily/Commercial (cap rate)
  - Land offer range

**Outreach Tab:**
- Status pipeline
- Contact logs (calls, letters, meetings)
- Next action reminder
- DNC status

**Notes Tab:**
- Freeform notes
- Tags (e.g., "tired landlord", "vacant", "probate")
- Attachments (photos, docs)

### Deal Calculator

Access standalone calculator for "what-if" scenarios:

**Inputs by Strategy:**
- **Wholesale**: ARV, Rehab, Buyer Margin, Wholesale Fee
- **BRRRR**: ARV, Rehab, Target LTV (75%), Buffer
- **Rental**: Rent, Expenses, DSCR (1.25x), Down Payment, Interest Rate
- **Multifamily**: Units, Rent/Unit, Vacancy Rate, OpEx Ratio, Cap Rate
- **Commercial**: NOI, Cap Rate
- **Land**: Market Value, Zoning, Utilities, Access, Offer %

**Outputs:**
- Max Offer / Target Price
- Offer Range (Min - Max)
- Explanation of calculation
- Key assumptions listed

### Exports

**Mailing List:**
- Owner name + mailing address
- Property address
- Score and top reason
- Filterable by status, score, tags

**Call Sheet:**
- Owner name + phone (when enriched)
- Property address
- Call script notes (top signals)

**Property Data:**
- Full parcel details
- Owner info
- All signals
- Scores and reasons

## 🛠️ Advanced Configuration

### Adjust Score Weights

1. Go to Admin panel (if admin route implemented)
2. Or use API:
```bash
curl -X PUT http://localhost:3001/api/admin/weights/NON_OWNER_OCCUPIED \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"weight": 20, "description": "Increased weight for investor properties"}'
```

**Default Weights:**
- Non-owner occupied: 15
- Long ownership (10-15 yrs): 10, (15-20 yrs): 15, (20+ yrs): 20
- Recent deed: 15 (higher for quitclaims/trustee deeds)
- Portfolio owner: 15 (scales with property count)
- Code case: 20
- Tax delinquency: 25
- Foreclosure-related: 25

### Comps Module (Optional)

Implement ARV estimation using public records:

1. Add comp data to `comps` table (from recorder sales data)
2. System automatically uses comps within radius + time window
3. Calculates median $/sqft and confidence levels

## 📈 Data Pipeline Flow

```
1. EXTRACT → Download/fetch county data (CSV, API, bulk download)
2. TRANSFORM → Normalize APNs, addresses, owner names, property types
3. LOAD → Upsert parcels and owners to database
4. SIGNALS → Generate investment signals from data patterns
5. SCORING → Calculate 0-100 scores with weighted algorithm
6. LEADS → Surface high-scoring properties in feed
```

## 🔍 Troubleshooting

### Database Connection Issues
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# View logs
docker-compose logs postgres

# Reset database
docker-compose down -v
docker-compose up -d postgres
npm run db:migrate
```

### ETL Job Failures
```bash
# View ETL job logs
docker-compose logs backend | grep ETL

# Check job history
curl http://localhost:3001/api/admin/jobs \
  -H "Authorization: Bearer YOUR_TOKEN"

# Run manually for debugging
docker-compose exec backend npm run etl:run -- kern_county_assessor
```

### Frontend Not Loading
```bash
# Check frontend logs
docker-compose logs frontend

# Verify backend is accessible
curl http://localhost:3001/health

# Check NEXT_PUBLIC_API_URL is set correctly
```

### Authentication Issues
```bash
# Verify JWT_SECRET is set in .env
# Check token expiry (default 7 days)
# Clear localStorage and re-login
```

## 📋 Maintenance Tasks

### Daily/Weekly
- Monitor ETL job success rate
- Review new leads in feed
- Check disk space (logs, database)

### Monthly
- Review and tune score weights based on deal outcomes
- Add new counties/data sources
- Update comps data if available

### Quarterly
- Backup database
- Review audit logs
- Update dependencies (`npm audit fix`)

## 🚨 Compliance Notes

### Data Sources
- ✅ County assessor/recorder public records
- ✅ City open data (code enforcement, permits)
- ❌ Do not scrape personal contact info from websites
- ❌ Do not use paywalled/ToS-restricted sources

### Contact Enrichment
- Only enrich leads scoring 75+
- Use reputable vendors (skip tracing services)
- Respect DNC lists
- Track opt-outs in `dnc_list` table

### Best Practices
- Always send physical mail first (no permission needed)
- Log all contact attempts
- Honor unsubscribe requests immediately
- Never cold-call cell phones without consent (TCPA)

## 🎓 Training & Onboarding

### For Damon (Primary User)

**Week 1: Data Setup**
1. Set up Kern County data source
2. Run first ETL job
3. Understand signal generation
4. Review lead feed filters

**Week 2: Deal Analysis**
5. Practice using calculators for each strategy
6. Review top 50 scored properties
7. Export mailing list
8. Send first batch of letters

**Week 3: Tracking**
9. Log outreach attempts
10. Move leads through pipeline
11. Tag properties with notes
12. Export call sheet for high-priority leads

**Week 4: Optimization**
13. Review which signals correlate with deals
14. Adjust score weights
15. Add more counties
16. Set up automated exports

## 🛣️ Roadmap

### Phase 1 (MVP) - ✅ Complete
- [x] Database schema
- [x] Auth with MFA
- [x] Signals engine
- [x] Scoring algorithm
- [x] Deal calculators
- [x] Lead feed & CRM
- [x] Export tools
- [x] ETL framework
- [x] Kern County adapter template

### Phase 2 (Expansion)
- [ ] Add 5+ more CA counties
- [ ] Recorder/deed data integration
- [ ] Code enforcement data (where available)
- [ ] Portfolio owner linking
- [ ] CA Secretary of State entity lookup

### Phase 3 (Power Features)
- [ ] Comps module (public records-based ARV)
- [ ] Mobile app (React Native)
- [ ] Saved searches & alerts
- [ ] Bulk actions (tag/export/update)
- [ ] Calendar integration for follow-ups
- [ ] Optional enrichment API integration
- [ ] Advanced reporting & analytics

## 💡 Tips & Best Practices

### Finding the Best Deals
1. Start with score 80+
2. Focus on "long ownership + non-owner occupied" combo
3. Look for portfolio owners (easier to negotiate bulk deals)
4. Prioritize code violations in your target areas
5. Cross-reference with local market knowledge

### Outreach Strategy
1. **Mail first**: Send personalized letters (3-touch campaign)
2. **Wait 2 weeks**: Let mail sink in
3. **Follow up**: Call if phone available
4. **Track everything**: Log all attempts
5. **Nurture**: Some deals take 6-12 months

### System Maintenance
- Run ETL weekly or monthly (not daily - data doesn't change that fast)
- Review and tag new leads weekly
- Archive dead leads quarterly
- Backup database monthly

## 🤝 Support & Contact

For issues, questions, or feature requests:
- Check logs: `docker-compose logs -f`
- Review audit logs: API endpoint `/api/admin/audit-logs`
- Check job history: API endpoint `/api/admin/jobs`

## 📄 License

Private/Proprietary - For authorized use only.

---

**Built with ❤️ for smart real estate investors who want an edge in finding off-market deals.**
