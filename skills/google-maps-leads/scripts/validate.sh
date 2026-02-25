#!/bin/bash
# Validate the skill configuration
echo "Validating google-maps-leads skill..."

if [ -f "SKILL.md" ] && [ -f "ui.json" ]; then
    echo "✅ SKILL.md and ui.json found."
else
    echo "❌ Missing required files."
    exit 1
fi

if [ -d "scripts" ] && [ -f "scripts/execute.ts" ]; then
    echo "✅ scripts/execute.ts found."
else
    echo "❌ scripts/execute.ts not found."
    exit 1
fi

echo "Skill validation passed!"
exit 0
