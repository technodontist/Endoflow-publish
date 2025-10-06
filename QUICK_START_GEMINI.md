# 🚀 Quick Start: Google Gemini AI Setup

## ⚡ 5-Minute Setup Guide

### Step 1: Get API Key (2 minutes)
1. Visit: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Click **"Create API Key"**
3. Copy the key (starts with `AIza...`)

### Step 2: Configure Environment (1 minute)
Open `.env.local` and add:
```env
GEMINI_API_KEY=AIza...paste-your-key-here
```

### Step 3: Run Migration (1 minute)
1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/pxpfbeqlqqrjpkiqlxmi/sql/new)
2. Copy contents of `lib/db/migrations/migrate_to_gemini_768_dimensions.sql`
3. Click **Run**
4. Wait for success message

### Step 4: Restart Server (30 seconds)
```bash
# Stop current server (Ctrl+C)
# Then restart:
npm run dev
```

### Step 5: Upload Medical Knowledge (1 minute)
1. Go to Dentist Dashboard
2. Find "Medical Knowledge Uploader"
3. Upload 1 sample research paper:
   - **Title**: "Modern RCT Techniques"
   - **Content**: Paste abstract or full text
   - **Topics**: `root_canal`
   - **Diagnosis Keywords**: `irreversible_pulpitis`
   - **Treatment Keywords**: `rct`
4. Click **Upload**

### ✅ Done! Test AI Features

**Test Treatment AI:**
1. Go to FDI Dental Chart
2. Click tooth #11
3. Select "Irreversible Pulpitis"
4. Watch Endo-AI Co-Pilot appear with suggestions! 🎉

**Test Research AI:**
1. Go to Research Projects
2. Ask: "What is the average age of patients?"
3. Watch Gemini analyze your data! 📊

---

## 💰 What You Just Saved

| Feature | Old Cost (OpenAI) | New Cost (Gemini) | Savings |
|---------|-------------------|-------------------|---------|
| Monthly | $15 | $0.05 | **99.7%** |

**Free tier includes:**
- 15 requests/minute
- 1,500 embeddings/day
- Perfect for most clinics!

---

## 🆘 Quick Troubleshooting

**"GEMINI_API_KEY not configured"**
→ Add key to `.env.local` and restart server

**"No relevant medical knowledge found"**
→ Upload at least 1 research paper via UI

**Still having issues?**
→ See full guide: `GEMINI_MIGRATION_GUIDE.md`

---

## 📚 Full Documentation

- **Setup Guide**: `GEMINI_MIGRATION_GUIDE.md`
- **Migration Summary**: `GEMINI_MIGRATION_SUMMARY.md`
- **Technical Details**: `lib/services/gemini-ai.ts`

---

**🎉 You're all set! Enjoy 99.8% cost savings with Google Gemini!** 🚀
