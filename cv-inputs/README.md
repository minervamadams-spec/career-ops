# Career Document Vault — cv-inputs/

> This folder is your **complete career archive**. Dump EVERYTHING here: all resume versions, cover letters, writing samples, project descriptions, certificates — whatever you have.

## How It Works

1. **Drop all your career documents** into this folder (`.pdf`, `.docx`, `.doc`, `.rtf`, `.md`, `.txt`)
2. **Run the vault extractor** — it converts everything to AI-readable text and builds one master `cv.md`
3. **career-ops reads the master `cv.md`** — it now knows your full career history across every document

## Quick Commands

```bash
cd career-ops   # wherever you unzipped/cloned this

# See what's in your vault
npm run cv-select

# MERGE ALL documents into one cv.md (recommended)
npm run cv-select --vault

# Use just ONE file as primary CV
npm run cv-select <filename>

# Rebuild the INDEX.md catalog
npm run cv-select --index
```

## The Vault Workflow

### Step 1: Dump Everything

```
cv-inputs/
├── Jane Doe _ Senior PM _ 2025.pdf
├── Jane Doe _ PM _ 2023.docx
├── Jane Doe CL.docx
├── Jane_Doe_Cover_Letter_Acme_Corp.docx
├── Jane_Doe_Resume_Acme_Corp.docx
├── Job_Duties_Notes.docx
├── Jane Doe Product_1.docx
├── ... (dozens more)
```

### Step 2: Extract & Merge

```bash
npm run cv-select --vault
```

This does three things:

1. **Extracts text** from all `.pdf`, `.docx`, `.doc`, and `.rtf` files → creates `.md` versions
2. **Merges ALL text** (original `.md`/`.txt` + extracted) into `../cv.md`
3. **Generates `INDEX.md`** — a catalog of every document with descriptions

### Step 3: Use career-ops

```bash
claude   # or codex / opencode / gemini
# Paste a job URL — the AI evaluates using your COMPLETE career history
```

## What Gets Extracted

| Format | Handled | Notes |
|--------|---------|-------|
| `.md`, `.txt` | ✅ Native | Copied as-is |
| `.pdf` | ✅ Extracted | Text extracted via PyPDF |
| `.docx` | ✅ Extracted | Text extracted via python-docx |
| `.doc` | ⚠️ Partial | Older format may fail; try converting to `.docx` |
| `.rtf` | ⚠️ Listed | Referenced in INDEX.md; convert to `.md` for full text |

## File Naming Tips

Name files so you can tell them apart at a glance:

| Good Name | What It Tells You |
|-----------|-------------------|
| `Jane Doe _ Senior PM _ 2025.docx` | Role + year |
| `Jane_Doe_Cover_Letter_Acme_Corp.docx` | Type + company |
| `Job_Duties_Notes.docx` | Purpose |
| `Jane Doe Product_1.docx` | Role + version |

## After Adding New Documents

Every time you drop new files into `cv-inputs/`, re-run:

```bash
npm run cv-select --vault
```

This rebuilds `cv.md` with all the new content included.

## The `cv.md` File

The `cv.md` at the project root is:
- **Auto-generated** — don't edit it manually (your changes will be overwritten)
- **Git-ignored** — it won't be committed to git
- **AI-readable** — career-ops reads this file when evaluating jobs

## The `INDEX.md` File

The `INDEX.md` in this folder is:
- **Auto-generated** — lists every file with a preview of its content
- **A quick reference** — so you can find specific documents without opening them all
- **Rebuilt on every `--vault`** run

## ⚠️ Important Notes

- **Don't delete the original files** — the extracted `.md` files are derived from them
- **`.doc` files** (older Word format) may not extract correctly — convert to `.docx` if needed
- **Empty `.docx` files** (templates with no text) will show as "no text extracted"
- **The merged `cv.md` can get large** — that's fine, the AI reads it all

## Troubleshooting

### Some files didn't extract

Check the output when you run `--vault`. Failed files are listed with ❌ or ⚠️. Common fixes:
- **`.doc` files**: Open in Word and "Save As" → `.docx`
- **Scanned PDFs**: If the PDF is an image (not text), extraction won't work — use OCR first
- **Empty templates**: Some `.docx` files are blank templates — no text to extract

### The merged cv.md is too big

That's normal with a full career archive. The AI handles large context. If you want to trim:

```bash
# Use just ONE specific file instead of merging all
npm run cv-select "Jane Doe _ Senior PM _ 2025.docx"
```

### I want to start over

```bash
# Delete all extracted files and rebuild
rm cv-inputs/*_extracted.md
npm run cv-select --vault
```
