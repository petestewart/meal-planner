#!/bin/bash
set -e

SESSION="meals"
PROJECT_DIR="$HOME/Projects/meal-planner"

# Kill existing session if present
tmux kill-session -t $SESSION 2>/dev/null || true

# Create new session with api window
tmux new-session -d -s $SESSION -n api -c $PROJECT_DIR

# Start API server in window 0
tmux send-keys -t $SESSION:api "pnpm --filter @meals/api start 2>&1 | tee -a logs/api.log" Enter

# Create cli window
tmux new-window -t $SESSION -n cli -c $PROJECT_DIR
tmux send-keys -t $SESSION:cli "# CLI ready. Try: node packages/cli/dist/bin/meals.js --help" Enter

# Create dev window
tmux new-window -t $SESSION -n dev -c $PROJECT_DIR
tmux send-keys -t $SESSION:dev "# Dev window. Run tests: pnpm test" Enter

# Create logs window
tmux new-window -t $SESSION -n logs -c $PROJECT_DIR
tmux send-keys -t $SESSION:logs "tail -f logs/api.log 2>/dev/null || echo 'No logs yet'" Enter

# Select cli window
tmux select-window -t $SESSION:cli

echo "Tmux session '$SESSION' started. Attach with: tmux attach -t $SESSION"
