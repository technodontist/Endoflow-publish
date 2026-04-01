# TDM API Key Setup Guide for Thesis Paper Downloads

## What are TDM API Keys?

Text and Data Mining (TDM) API keys allow institutional subscribers (like AIIMS) to programmatically download full-text articles from publishers. These are **free** for researchers at subscribing institutions.

---

## Step 1: Elsevier TDM API Key

Elsevier publishes: Journal of Endodontics (JOE), Journal of Dental Sciences, International Endodontic Journal, etc.

### How to get it:

1. Go to: https://dev.elsevier.com/
2. Click **"Register"** (top right)
3. Use your **AIIMS institutional email** (e.g., your @aiims.edu email)
4. After registration, go to **"My API Key"**
5. Click **"Create API Key"**
6. For "Label" enter: `AIIMS Research - Thesis Literature Review`
7. For "Website URL" you can enter: `https://www.aiims.edu`
8. Copy the API key (looks like: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)

### Alternative (institutional access):
If the above doesn't work, go to:
https://www.elsevier.com/about/policies-and-standards/text-and-data-mining

Look for the "Request a TDM API key" link. You may need to verify through your AIIMS library.

---

## Step 2: Wiley TDM API Key

Wiley publishes: International Endodontic Journal, Journal of Dental Education, etc.

### How to get it:

1. Go to: https://onlinelibrary.wiley.com/library-info/resources/text-and-datamining
2. Read the TDM policy
3. Click the link to request a token
4. You'll need to provide:
   - Your institutional email
   - Institution name: "All India Institute of Medical Sciences, New Delhi"
   - Purpose: "Systematic literature review for MDS thesis"
5. They typically respond within 1-3 business days

---

## Step 3: Configure paperscraper

Once you have the keys, create a file called `.env` in the same folder as the download script:

```
ELSEVIER_TDM_API_KEY=your_elsevier_key_here
WILEY_TDM_API_TOKEN=your_wiley_token_here
```

Then run the download script again:
```bash
python download_thesis_papers.py
```

The script automatically tries open-access first, then falls back to these API keys for paywalled content.

---

## Alternative: Direct AIIMS Library Access

If the TDM process is slow, you can also:

1. Connect to AIIMS campus network (or VPN)
2. Open the HTML download hub file I created (`Thesis_Article_Downloads.html`)
3. Click the DOI links for paywalled articles — they should resolve to full text through your institutional proxy
4. Download PDFs manually for the 34 paywalled articles

Most of the critical methodology papers are already open access (49 out of 83).

---

## What's Already Available Without Keys

I've already retrieved the full text of all 49 open-access articles through the PubMed Central API. These include the most critical papers for our protocol:

- Digital vs paper dental records comparison studies
- Endodontic documentation audits (3 papers)
- AI in endodontics reviews (4 papers)
- Clinical documentation burden framework
- Usability evaluation tools (SUS) in dental settings
- Voice-enabled clinical documentation prototype
- Ambient AI scribe documentation studies
- EHR data quality assessment in dentistry
