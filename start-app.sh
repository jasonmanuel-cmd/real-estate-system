#!/bin/bash
# Start CA Deal Engine

echo "🚀 Starting CA Deal Engine..."
echo ""
echo "Backend will start on: http://localhost:3001"
echo "Frontend will start on: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start backend and frontend concurrently
cd backend && npm run dev &
BACKEND_PID=$!

cd frontend && npm run dev &
FRONTEND_PID=$!

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
