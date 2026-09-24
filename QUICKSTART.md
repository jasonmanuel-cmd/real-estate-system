# 🚀 Quick Start Guide - CA Deal Engine

Get the app running in **5 minutes** with NO database installation needed!

## ✅ Prerequisites

Only 1 thing needed:
- **Node.js 18+** - Download from https://nodejs.org

That's it! No PostgreSQL, no Docker, no complicated setup!

---

## 🎯 Windows Users - Super Easy Setup

### Step 1: Run Quick Start Script

```bash
# Open PowerShell or Command Prompt in the project folder
# Then run:
quick-start.bat
```

This automatically:
- ✅ Creates SQLite database (no service needed!)
- ✅ Installs all dependencies
- ✅ Creates admin user
- ✅ Loads 5 sample properties
- ✅ Sets up everything!

**Takes 5-7 minutes total.**

### Step 2: Start the App

```bash
start-app.bat
```

This opens 2 windows:
- Backend API (localhost:3001)
- Frontend Web (localhost:3000)

### Step 3: Login

Open browser: **http://localhost:3000**

**Login with:**
- Email: `demo@example.com`
- Password: `Demo123!`

---

## 🍎 Mac/Linux Users

### Step 1: Run Quick Start Script

```bash
# Make scripts executable
chmod +x quick-start.sh start-app.sh

# Run setup
./quick-start.sh
```

### Step 2: Start the App

```bash
./start-app.sh
```

### Step 3: Login

Open browser: **http://localhost:3000**

**Login with:**
- Email: `demo@example.com`
- Password: `Demo123!`

---

## 🎉 What You'll See

After login, you'll have:
- ✅ **5 sample properties** loaded with scores
- ✅ **Lead feed** - View properties ranked by score
- ✅ **Property profiles** - Click any property to see details
- ✅ **Signals tab** - See why each property is ranked
- ✅ **Deal calculator** - Calculate offer ranges
- ✅ **Export** - Download mailing lists

---

## 🛠️ Manual Start (If Scripts Don't Work)

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Then open: http://localhost:3000

---

## 📊 Sample Data

The system comes with 5 sample properties:
- 3 Single Family Residences
- 1 Multifamily property
- 1 Commercial property

Each has:
- Different ownership patterns (owner-occupied vs investor)
- Various signals (non-owner occupied, long ownership, etc.)
- Calculated scores (0-100)

---

## 🔧 Troubleshooting

**Port already in use:**
```bash
# Kill process on port 3001
npx kill-port 3001

# Kill process on port 3000
npx kill-port 3000
```

**Database errors:**
```bash
cd backend
rm -f dev.db
npx prisma migrate dev --name init
npm run etl:run -- kern_county_assessor
```

**Want to reset everything:**
```bash
# Delete and re-run
rm -rf backend/node_modules frontend/node_modules backend/dev.db
# Then run quick-start again
```

---

## 📈 Next Steps

1. **Add real data**: Replace `data/sample_kern_data.csv` with real Kern County assessor data
2. **Run ETL**: `cd backend && npm run etl:run -- kern_county_assessor`
3. **Explore features**: Try filters, scoring, calculators, exports
4. **Customize weights**: Adjust signal weights in admin panel

---

## 💡 Key Features to Test

### 1. Lead Feed
- Sort by score
- Filter by property type, county, signals
- Quick actions on each card

### 2. Property Profile
- **Overview**: Address, owner, property details
- **Signals**: Why it's ranked (non-owner occupied, etc.)
- **Deal Snapshot**: ARV, rent estimates, offer ranges
- **Calculator**: Try different strategies (Wholesale, BRRRR, etc.)

### 3. Deal Calculator
Navigate to calculator and try:
- **Wholesale**: ARV $400k, Rehab $50k → See MAO
- **BRRRR**: Calculate max buy for refinance
- **Rental**: Input rent to get max purchase price

### 4. Exports
- Select properties
- Export mailing list
- Get CSV with owner names and addresses

---

## 🎓 Understanding the Scores

Properties are scored 0-100 based on signals:

| Score | Meaning |
|-------|---------|
| 80-100 | Highly motivated seller signals |
| 60-79 | Good investment opportunity |
| 40-59 | Worth investigating |
| 0-39 | Lower priority |

**Top signals:**
- Non-owner occupied (+15 points)
- Long ownership 20+ years (+20 points)
- Portfolio owner 6+ properties (+15 points)
- Recent deed activity (+15 points)

---

## 📝 Default Credentials

**Email:** demo@example.com  
**Password:** Demo123!

**Change these in production!**

---

## 🆘 Need Help?

1. Check `README.md` for full documentation
2. Review `backend/logs/` for error messages
3. Open browser console (F12) for frontend errors

---

**You're ready to find off-market deals!** 🏠💰
