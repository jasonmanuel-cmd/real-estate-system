#!/bin/bash
# CA Deal Engine - Quick Start Script
# This script sets up everything you need to run the app locally

set -e  # Exit on error

echo "🚀 CA Deal Engine - Quick Start Setup"
echo "======================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Download from: https://nodejs.org"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"
echo ""

# Step 1: Create .env file
echo "📝 Step 1: Creating environment file..."
cat > .env << 'EOF'
DATABASE_URL="file:./dev.db"
NODE_ENV="development"
PORT=3001
FRONTEND_URL="http://localhost:3000"
JWT_SECRET="dev-secret-key-change-this-in-production-minimum-32-characters-long"
JWT_EXPIRES_IN="7d"
MFA_ISSUER="CA Deal Engine"
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
ETL_SCHEDULE="0 2 * * *"
ETL_ENABLED=false
LOG_LEVEL="info"
BCRYPT_ROUNDS=12
CORS_ORIGIN="http://localhost:3000"
KERN_COUNTY_DATA_FILE="./data/sample_kern_data.csv"
EOF
echo "✅ Environment file created"
echo ""

# Step 2: Install backend dependencies
echo "📦 Step 2: Installing backend dependencies (this takes 2-3 minutes)..."
cd backend
npm install --silent
echo "✅ Backend dependencies installed"
echo ""

# Step 3: Update Prisma schema for SQLite
echo "🗄️  Step 3: Configuring database for SQLite..."
# Backup original schema
cp prisma/schema.prisma prisma/schema.prisma.backup

# Update to use SQLite
sed -i 's/provider = "postgresql"/provider = "sqlite"/' prisma/schema.prisma
echo "✅ Database configured for SQLite"
echo ""

# Step 4: Setup database
echo "🗄️  Step 4: Setting up database..."
npx prisma migrate dev --name init --skip-seed
npx prisma generate
npm run build
echo "✅ Database setup complete"
echo ""

# Step 5: Create admin user
echo "👤 Step 5: Creating admin user..."
npx ts-node scripts/create-admin.ts --email demo@example.com --password Demo123! --name "Demo User"
echo "✅ Admin user created"
echo ""

# Step 6: Create sample data
echo "📊 Step 6: Creating sample data..."
cd ..
mkdir -p data
cat > data/sample_kern_data.csv << 'CSV'
APN,SITUS_ADDRESS,SITUS_CITY,SITUS_ZIP,OWNER_NAME,MAIL_ADDRESS,MAIL_CITY,MAIL_STATE,MAIL_ZIP,USE_CODE,ASSESSED_VALUE,LAND_VALUE,IMPROVEMENT_VALUE,BUILDING_SQFT,LOT_SIZE,YEAR_BUILT,BEDROOMS,BATHROOMS
001-234-567,123 Main St,Bakersfield,93301,John Smith,456 Oak Ave,Los Angeles,CA,90001,SINGLE FAMILY RESIDENTIAL,350000,100000,250000,1800,0.25,1985,3,2
001-234-568,125 Main St,Bakersfield,93301,ABC Investment LLC,PO Box 1234,San Francisco,CA,94102,SINGLE FAMILY RESIDENTIAL,380000,110000,270000,2000,0.25,1990,4,2.5
001-234-569,127 Main St,Bakersfield,93301,Mary Johnson Trust,127 Main St,Bakersfield,CA,93301,SINGLE FAMILY RESIDENTIAL,320000,95000,225000,1650,0.22,1978,3,2
001-234-570,456 Elm St,Bakersfield,93305,Garcia Family LLC,789 Pine Rd,Fresno,CA,93650,MULTIFAMILY,850000,200000,650000,4500,0.5,1995,8,4
001-234-571,789 Oak Ave,Bakersfield,93301,Senior Properties Inc,PO Box 5678,Sacramento,CA,94203,SINGLE FAMILY RESIDENTIAL,295000,90000,205000,1500,0.20,1972,3,1.5
CSV
echo "✅ Sample data created"
echo ""

# Step 7: Load sample data
echo "📥 Step 7: Loading sample data into database..."
cd backend
npm run etl:run -- kern_county_assessor
echo "✅ Sample data loaded"
echo ""

# Step 8: Install frontend
echo "📦 Step 8: Installing frontend dependencies (this takes 2-3 minutes)..."
cd ../frontend
npm install --silent
echo "✅ Frontend dependencies installed"
echo ""

# Done!
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "📋 Login Credentials:"
echo "   Email: demo@example.com"
echo "   Password: Demo123!"
echo ""
echo "🚀 To start the app:"
echo "   ./start-app.sh"
echo ""
echo "Or manually:"
echo "   Terminal 1: cd backend && npm run dev"
echo "   Terminal 2: cd frontend && npm run dev"
echo "   Then open: http://localhost:3000"
echo ""
