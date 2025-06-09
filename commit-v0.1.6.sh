#!/bin/bash

echo "========================================"
echo "Git Commit Script for v0.1.6"
echo "========================================"
echo

echo "Checking git status..."
git status
echo

echo "Adding all changes..."
git add .
echo

echo "Committing changes..."
git commit -m "🚀 Release v0.1.6: Add date picker functionality to quotation email generator

✨ New Features:
- Add delivery date picker to quotation email form
- Add quote validity date picker
- Auto-generate professional emails with date requirements
- Format dates in English format (March 15, 2024)
- Optional date fields (won't show in email if not filled)

🔧 Technical Improvements:
- Add DatePicker components to quotation form
- Implement date formatting function (US English format)
- Optimize email template generation logic

📝 Email Template Enhancement:
- Auto-generate emails with delivery date requirements
- Clear communication of quote validity periods to suppliers
- Improve professionalism and standardization of inquiry emails

🗂️ Files Updated:
- package.json: Version bump to 0.1.6
- CHANGELOG.md: Complete change log record
- Quotation.tsx: Add DatePicker components and date handling logic"
echo

echo "Checking current branch..."
git branch
echo

echo "Pushing to remote repository..."
git push origin HEAD
echo

echo "========================================"
echo "Commit and push completed!"
echo "Version v0.1.6 has been saved to git."
echo "========================================" 