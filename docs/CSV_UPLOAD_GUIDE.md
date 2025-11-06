# Bulk Upload Questions - CSV Format Guide

## Overview
You can upload multiple questions at once using a CSV (Comma-Separated Values) file. This guide explains the format and requirements.

## CSV File Structure

### Required Columns (in exact order):
1. **Question Text** - The question content (minimum 10 characters)
2. **Option 1** - First answer option (required)
3. **Option 2** - Second answer option (required)
4. **Option 3** - Third answer option (optional, leave empty if not needed)
5. **Option 4** - Fourth answer option (optional, leave empty if not needed)
6. **Correct Options** - Index(es) of correct answer(s)
7. **Category** - Difficulty level
8. **Tags** - Classification tags
9. **Weight** - Points awarded for correct answer
10. **Negative Marking** - Whether wrong answers deduct points

## Column Details

### 1. Question Text
- **Type:** Text
- **Required:** Yes
- **Minimum Length:** 10 characters
- **Example:** "What is the capital of France?"

### 2-5. Options (Option 1, Option 2, Option 3, Option 4)
- **Type:** Text
- **Required:** At least 2 options (Option 1 and Option 2)
- **Optional:** Option 3 and Option 4 can be left empty
- **Example:** "Paris", "London", "Berlin", "Madrid"

### 6. Correct Options
- **Type:** Numeric index (0-based)
- **Required:** Yes
- **Format:** 
  - Single correct answer: `0` or `1` or `2` or `3`
  - Multiple correct answers: `0,2` or `1,3` (comma-separated, no spaces)
- **Index Mapping:**
  - `0` = Option 1
  - `1` = Option 2
  - `2` = Option 3
  - `3` = Option 4
- **Examples:**
  - If Option 2 (Paris) is correct: `1`
  - If Option 1 and Option 3 are correct: `0,2`

### 7. Category
- **Type:** Text (predefined values only)
- **Required:** Yes
- **Allowed Values:**
  - `Easy`
  - `Medium`
  - `Hard`
- **Case Sensitive:** Yes (must be exact match)
- **Example:** "Medium"

### 8. Tags
- **Type:** Text
- **Required:** No (can be empty)
- **Format:** Semicolon-separated values (no spaces)
- **Examples:**
  - Single tag: `Geography`
  - Multiple tags: `Geography;Europe;Capitals`
  - Empty: `` (leave blank)

### 9. Weight
- **Type:** Number
- **Required:** Yes
- **Minimum Value:** 0
- **Recommended:** 1-5
- **Example:** `2` (question worth 2 points)

### 10. Negative Marking
- **Type:** Boolean
- **Required:** Yes
- **Allowed Values:**
  - `true` or `1` = Enable negative marking
  - `false` or `0` = Disable negative marking
- **Example:** "false"

## Sample CSV Content

```csv
"Question Text","Option 1","Option 2","Option 3","Option 4","Correct Options","Category","Tags","Weight","Negative Marking"
"What is the capital of France?","London","Paris","Berlin","Madrid","1","Easy","Geography;Europe","1","false"
"Which programming language is known for web development?","Python","JavaScript","C++","Java","1","Medium","Programming;Web","2","true"
"What is 2 + 2?","3","4","5","6","1","Easy","Mathematics;Arithmetic","1","false"
"Which are primary colors?","Red","Green","Blue","Yellow","0,2","Medium","Art;Colors","2","false"
```

## Tips and Best Practices

### 1. **Use Quotes for Text Fields**
Always wrap text fields in double quotes, especially if they contain:
- Commas
- Line breaks
- Special characters
- Example: `"What is 2 + 2, exactly?"`

### 2. **Encoding**
- Save your CSV file with UTF-8 encoding
- Most spreadsheet applications (Excel, Google Sheets) support this

### 3. **Creating CSV Files**

#### Using Microsoft Excel:
1. Create your questions in Excel
2. Go to File → Save As
3. Choose "CSV UTF-8 (Comma delimited) (*.csv)"
4. Save

#### Using Google Sheets:
1. Create your questions in Google Sheets
2. Go to File → Download → Comma Separated Values (.csv)
3. Download

### 4. **Common Mistakes to Avoid**
- ❌ Missing required columns
- ❌ Wrong category names (must be exact: Easy, Medium, Hard)
- ❌ Invalid correct option indices (must be 0, 1, 2, or 3)
- ❌ Question text less than 10 characters
- ❌ Negative weight values
- ❌ Extra spaces in correct options (use `0,2` not `0, 2`)

### 5. **Testing Your CSV**
- Start with 2-3 test questions
- Upload and verify they appear correctly
- Then upload your full question bank

## Example Questions

### Easy Question (Single Answer):
```csv
"What is the largest ocean?","Atlantic","Pacific","Indian","Arctic","1","Easy","Geography;Oceans","1","false"
```

### Medium Question (Multiple Answers):
```csv
"Which are programming languages?","Python","Photoshop","Java","Windows","0,2","Medium","Programming","2","true"
```

### Hard Question (Negative Marking):
```csv
"What is the time complexity of QuickSort in average case?","O(n)","O(n log n)","O(n²)","O(log n)","1","Hard","Algorithms;Computer Science","3","true"
```

### Question with Only 2 Options:
```csv
"Is Python case-sensitive?","Yes","No","","","0","Easy","Programming;Python","1","false"
```

## Error Handling

The system will show detailed results after upload:
- ✅ **Success**: Question was added successfully
- ❌ **Error**: Row had validation issues

Common errors and solutions:
| Error | Solution |
|-------|----------|
| "Question text must be at least 10 characters" | Make the question longer |
| "Invalid category" | Use exactly: Easy, Medium, or Hard |
| "At least one valid correct option index is required" | Check indices are 0-3 and valid |
| "Insufficient columns" | Ensure all 10 columns are present |
| "Weight must be a non-negative number" | Use positive numbers only |

## Download Sample Template

Click the "Download Sample CSV" button in the upload interface to get a pre-formatted template with example questions.

## Need Help?

If you encounter issues:
1. Check this guide for format requirements
2. Download and examine the sample CSV
3. Start with a small test file (2-3 questions)
4. Contact your system administrator for support
