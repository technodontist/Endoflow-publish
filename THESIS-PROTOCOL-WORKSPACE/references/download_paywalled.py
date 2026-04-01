#!/usr/bin/env python3
"""
EndoFlow Thesis — Paywalled Article Downloader
Run this on your own machine (NOT in the cloud sandbox).

Usage:
    pip install requests
    python download_paywalled.py
"""

import requests
import os
import time
import json

# ==================== API KEYS ====================
ELSEVIER_API_KEY = "e086d78f2dac4567b1079b"
# WILEY_TDM_TOKEN = ""  # Add when you get it from https://static.wiley.com/tdm/
# SPRINGER_API_KEY = ""  # Add when you get it from https://dev.springernature.com/

# ==================== OUTPUT ====================
OUTPUT_DIR = "downloaded_pdfs"
os.makedirs(os.path.join(OUTPUT_DIR, "elsevier"), exist_ok=True)
os.makedirs(os.path.join(OUTPUT_DIR, "wiley"), exist_ok=True)
os.makedirs(os.path.join(OUTPUT_DIR, "springer"), exist_ok=True)
os.makedirs(os.path.join(OUTPUT_DIR, "other"), exist_ok=True)
os.makedirs(os.path.join(OUTPUT_DIR, "failed"), exist_ok=True)

# ==================== ARTICLES BY PUBLISHER ====================

ELSEVIER_ARTICLES = [
    ("41825998", "10.1016/j.cden.2025.11.005", "DCNA - LLMs in Dental Education"),
    ("30099330", "10.1016/j.jcrc.2018.07.021", "EMR data quality improvement"),
    ("41849833", "10.1016/j.ajem.2026.03.007", "Automated ED doc auditing with LLM"),
    ("41251650", "10.1016/j.annemergmed.2025.10.006", "Ambient AI vs Human Scribes ED"),
    ("41785738", "10.1016/j.ijmedinf.2026.106367", "Semi-Automated SMART on FHIR"),
    ("41826005", "10.1016/j.cden.2025.11.010", "AI Application in Endodontics"),
    ("41865812", "10.1016/j.jdent.2026.106643", "TAPSeg Deep Learning Tool"),
    ("41833430", "10.1016/j.jebdp.2025.102225", "ML-Aided Proximal Caries Detection"),
    ("41771367", "10.1016/j.jdent.2026.106602", "AI vs Human Caries Detection"),
    ("41655629", "10.1016/j.joen.2026.01.022", "JOE - Deep Learning Palatal Radiolucency"),
    ("41825999", "10.1016/j.cden.2025.11.012", "DCNA - Radiographic Segmentation ML"),
    ("39667487", "10.1016/j.jdent.2024.105526", "J Dent - CBCT-SAM periapical"),
    ("37488043", "10.1016/j.jdent.2023.104630", "J Dent - Implant disease risk usability"),
]

WILEY_ARTICLES = [
    ("41454488", "10.1111/edt.70035", "Dental Trauma Documentation"),
    ("21382141", "10.1111/j.1601-0825.2011.01794.x", "Oral Medicine Informatics"),
    ("28981172", "10.1111/jocn.14097", "Nursing Doc Paper vs Electronic"),
    ("41368793", "10.1111/ans.70416", "Pre-Anaesthetic Doc Paper vs Electronic"),
    ("41533034", "10.1111/jep.70365", "EHR Usability Barriers"),
    ("28644527", "10.1111/iej.12803", "IEJ - Root Filling Quality Audit"),
    ("41801972", "10.1002/jper.70106", "Deep Learning Bone Loss Detection"),
    ("41355200", "10.1002/jdd.70112", "AR Maxillomandibular Anatomy"),
    ("41449661", "10.1111/aej.70046", "AEJ - LLMs for Endo Diagnosis"),
    ("41213882", "10.1111/idh.70004", "Dental Caries App Usability"),
]

SPRINGER_ARTICLES = [
    ("32036459", "10.1007/s10916-020-1532-x", "Clinical Coding Barriers"),
    ("41691106", "10.1007/s10266-026-01335-1", "AI Models Oral Medicine"),
    ("41483142", "10.1007/s10916-025-02319-4", "Digital Scribes Scoping Review"),
    ("28281608", "10.1038/sj.bdj.2017.223", "BDJ - Endo Record Keeping Audit"),
    ("23660929", "10.1038/sj.bdj.2013.434", "BDJ - Audit in Endodontics"),
    ("41238880", "10.1038/s41415-025-9104-6", "BDJ - ICCMS Integration"),
    ("41044215", "10.1038/s41415-025-9047-y", "BDJ - GDP Referral Letters"),
    ("41794718", "10.1186/s12903-026-08004-3", "BMC Oral Health - AR Orthodontics"),
]

OTHER_ARTICLES = [
    ("41673528", "10.1177/23800844251408849", "SAGE - Periodontitis EHR Model"),
    ("38888078", "10.1177/20501684241230799", "SAGE - GIRFT Endo Outcomes"),
    ("41875421", "10.2196/80549", "JMIR - AI Scribe Satisfaction"),
    ("41691654", "10.1093/jamia/ocag005", "JAMIA - AI Scribes Impact"),
    ("32925343", "10.1213/ANE.0000000000005084", "Wolters Kluwer - Barcode Safety"),
    ("28104042", "10.1071/AH16095", "CSIRO - EHR Asset or Liability"),
    ("25216146", "10.11607/jomi.3486", "Quintessence - Implant Malpractice"),
    ("30556409", "10.1556/650.2018.31212", "Hungarian - Dental Injury Reports"),
    ("19433534", "", "J Dent Educ - Dental EPR Factors (no DOI)"),
    ("25796809", "", "Swedish Dent J - Adverse Events (no DOI)"),
]


def download_elsevier(pmid, doi, desc):
    """Download from Elsevier using TDM API."""
    filepath = os.path.join(OUTPUT_DIR, "elsevier", f"PMID_{pmid}.pdf")
    if os.path.exists(filepath) and os.path.getsize(filepath) > 1000:
        print(f"  [SKIP] Already exists: PMID_{pmid}.pdf")
        return True

    url = f"https://api.elsevier.com/content/article/doi/{doi}"
    headers = {
        "X-ELS-APIKey": ELSEVIER_API_KEY,
        "Accept": "application/pdf"
    }

    try:
        resp = requests.get(url, headers=headers, timeout=30)
        if resp.status_code == 200 and 'pdf' in resp.headers.get('content-type', '').lower():
            with open(filepath, 'wb') as f:
                f.write(resp.content)
            print(f"  [OK] {len(resp.content)//1024} KB -> PMID_{pmid}.pdf")
            return True
        elif resp.status_code == 200:
            # XML full text
            xml_path = os.path.join(OUTPUT_DIR, "elsevier", f"PMID_{pmid}.xml")
            with open(xml_path, 'w') as f:
                f.write(resp.text)
            print(f"  [XML] Got full text XML: PMID_{pmid}.xml ({len(resp.text)//1024} KB)")
            return True
        else:
            print(f"  [FAIL] HTTP {resp.status_code}")
            return False
    except Exception as e:
        print(f"  [ERROR] {e}")
        return False


def download_wiley(pmid, doi, desc):
    """Download from Wiley using TDM token."""
    WILEY_TOKEN = os.environ.get("WILEY_TDM_TOKEN", "")
    filepath = os.path.join(OUTPUT_DIR, "wiley", f"PMID_{pmid}.pdf")
    if os.path.exists(filepath) and os.path.getsize(filepath) > 1000:
        print(f"  [SKIP] Already exists")
        return True

    if not WILEY_TOKEN:
        print(f"  [NO KEY] Wiley TDM token not set — use Knimbus instead")
        return False

    url = f"https://api.wiley.com/onlinelibrary/tdm/v1/articles/{doi}"
    headers = {
        "Wiley-TDM-Client-Token": WILEY_TOKEN,
        "Accept": "application/pdf"
    }

    try:
        resp = requests.get(url, headers=headers, timeout=30)
        if resp.status_code == 200 and len(resp.content) > 1000:
            with open(filepath, 'wb') as f:
                f.write(resp.content)
            print(f"  [OK] {len(resp.content)//1024} KB -> PMID_{pmid}.pdf")
            return True
        else:
            print(f"  [FAIL] HTTP {resp.status_code}")
            return False
    except Exception as e:
        print(f"  [ERROR] {e}")
        return False


def download_springer(pmid, doi, desc):
    """Download from Springer Nature using API key."""
    SPRINGER_KEY = os.environ.get("SPRINGER_API_KEY", "")
    filepath = os.path.join(OUTPUT_DIR, "springer", f"PMID_{pmid}.pdf")
    if os.path.exists(filepath) and os.path.getsize(filepath) > 1000:
        print(f"  [SKIP] Already exists")
        return True

    if not SPRINGER_KEY:
        print(f"  [NO KEY] Springer API key not set — use Knimbus instead")
        return False

    url = f"https://api.springernature.com/openaccess/jats/doi/{doi}?api_key={SPRINGER_KEY}"
    try:
        resp = requests.get(url, timeout=30)
        if resp.status_code == 200:
            xml_path = os.path.join(OUTPUT_DIR, "springer", f"PMID_{pmid}.xml")
            with open(xml_path, 'w') as f:
                f.write(resp.text)
            print(f"  [XML] Got full text: PMID_{pmid}.xml ({len(resp.text)//1024} KB)")
            return True
        else:
            print(f"  [FAIL] HTTP {resp.status_code}")
            return False
    except Exception as e:
        print(f"  [ERROR] {e}")
        return False


def main():
    print("=" * 60)
    print("EndoFlow Thesis — Paywalled Article Downloader")
    print("=" * 60)

    total = 0
    success = 0
    failed = []

    # Phase 1: Elsevier (13 articles — HAVE API KEY)
    print(f"\n--- ELSEVIER ({len(ELSEVIER_ARTICLES)} articles) — Using TDM API Key ---\n")
    for pmid, doi, desc in ELSEVIER_ARTICLES:
        total += 1
        print(f"[{total}] PMID {pmid}: {desc}")
        if download_elsevier(pmid, doi, desc):
            success += 1
        else:
            failed.append((pmid, doi, desc, "Elsevier"))
        time.sleep(1)

    # Phase 2: Wiley (10 articles)
    print(f"\n--- WILEY ({len(WILEY_ARTICLES)} articles) ---\n")
    for pmid, doi, desc in WILEY_ARTICLES:
        total += 1
        print(f"[{total}] PMID {pmid}: {desc}")
        if download_wiley(pmid, doi, desc):
            success += 1
        else:
            failed.append((pmid, doi, desc, "Wiley"))
        time.sleep(1)

    # Phase 3: Springer (8 articles)
    print(f"\n--- SPRINGER-NATURE ({len(SPRINGER_ARTICLES)} articles) ---\n")
    for pmid, doi, desc in SPRINGER_ARTICLES:
        total += 1
        print(f"[{total}] PMID {pmid}: {desc}")
        if download_springer(pmid, doi, desc):
            success += 1
        else:
            failed.append((pmid, doi, desc, "Springer"))
        time.sleep(1)

    # Phase 4: Other publishers (manual via Knimbus)
    print(f"\n--- OTHER PUBLISHERS ({len(OTHER_ARTICLES)} articles) — Use Knimbus ---\n")
    for pmid, doi, desc in OTHER_ARTICLES:
        total += 1
        knimbus = f"https://aiims.knimbus.com/portal/v2/default/search?q={doi}" if doi else f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"
        print(f"[{total}] PMID {pmid}: {desc}")
        print(f"       Knimbus: {knimbus}")
        failed.append((pmid, doi, desc, "Other"))

    # Summary
    print(f"\n{'='*60}")
    print("DOWNLOAD SUMMARY")
    print(f"{'='*60}")
    print(f"Total: {total}")
    print(f"Downloaded: {success}")
    print(f"Need Knimbus: {len(failed)}")

    if failed:
        print(f"\n--- ARTICLES TO DOWNLOAD VIA KNIMBUS ---")
        print(f"Login: https://aiims.knimbus.com/portal/v2/default/login\n")
        for pmid, doi, desc, pub in failed:
            link = f"https://aiims.knimbus.com/portal/v2/default/search?q={doi}" if doi else f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"
            print(f"  PMID {pmid} ({pub}): {desc}")
            print(f"    {link}")


if __name__ == "__main__":
    main()
