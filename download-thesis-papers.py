#!/usr/bin/env python3
"""
EndoFlow Thesis Literature Downloader
======================================
Downloads full-text PDFs for all 83 articles in the EndoFlow thesis literature database.

Usage:
    pip install paperscraper requests
    python download_thesis_papers.py

For paywalled articles, get TDM API keys:
    - Wiley: https://onlinelibrary.wiley.com/library-info/resources/text-and-datamining
    - Elsevier: https://www.elsevier.com/about/policies-and-standards/text-and-data-mining
    Then create a .env file:
        WILEY_TDM_API_TOKEN=your_token
        ELSEVIER_TDM_API_KEY=your_key
"""

import os
import json
import time
import requests
from pathlib import Path

# ==================== LOAD .env FILE ====================
def load_env():
    """Load API keys from .env file in the same directory as this script."""
    env_path = Path(__file__).parent / '.env'
    if env_path.exists():
        print(f"[INFO] Loading API keys from {env_path}")
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip()
                    print(f"  Loaded: {key.strip()} = {'*' * min(8, len(value.strip()))}...")
    else:
        print(f"[WARN] No .env file found at {env_path}")
        print(f"  Create one with: ELSEVIER_TDM_API_KEY=your_key")
        print(f"                   WILEY_TDM_API_TOKEN=your_token")

load_env()

ELSEVIER_API_KEY = os.environ.get('ELSEVIER_TDM_API_KEY', '')
WILEY_TDM_TOKEN = os.environ.get('WILEY_TDM_API_TOKEN', '')

# ==================== ARTICLE DATABASE ====================
ARTICLES = [
    # Format: (PMID, DOI, PMC_ID, short_title, is_open_access)
    ("41473735", "10.1155/bmri/5527391", "PMC12745653", "A Digital Clinical Records Versus Paper Records in Dental Practice: A ", True),
    ("41610430", "10.2196/82691", "PMC12854659", "Exploring Medical Information Needs and Accessibility in Swedish Denta", True),
    ("41673528", "10.1177/23800844251408849", "", "Periodontitis Prediction Model Using Linked Electronic Health and Dent", False),
    ("41825998", "10.1016/j.cden.2025.11.005", "", "Introduction to Large Language Models and the Application of Generativ", False),
    ("41454488", "10.1111/edt.70035", "", "Optimizing Documentation in Dental Trauma Cases: Quantitative and Qual", False),
    ("41291643", "10.1186/s12909-025-07585-x", "PMC12648810", "Integrating digital technologies in clinical dentistry training: a fra", True),
    ("41744966", "10.3390/dj14020128", "PMC12939967", "International Perspectives on Digital and Generative AI Adoption and G", True),
    ("41061312", "10.1016/j.identj.2025.103933", "PMC12538124", "AI Acceptability in Dentistry: Insights from Dental Professionals and ", True),
    ("21382141", "10.1111/j.1601-0825.2011.01794.x", "", "Advancing oral medicine through informatics and information technology", False),
    ("19433534", "", "", "Factors influencing implementation and outcomes of a dental electronic", False),
    ("41728543", "10.7759/cureus.102000", "PMC12922785", "Dentistry 5.0: An Emerging Framework Integrating Bioengineering, AI, a", True),
    ("28981172", "10.1111/jocn.14097", "", "Quality of nursing documentation: Paper-based health records versus el", False),
    ("28104042", "10.1071/AH16095", "", "Electronic health records and online medical records: an asset or a li", False),
    ("33589503", "10.1136/bmjoq-2020-000918", "PMC7887344", "Improving clinical documentation: introduction of electronic health re", True),
    ("41368793", "10.1111/ans.70416", "", "Completeness of Pre-Anaesthetic Assessment Documentation-Paper Versus ", False),
    ("39075337", "10.1186/s12873-024-01022-w", "PMC11288075", "Implementation of major trauma app: usability and data completeness.", True),
    ("41264873", "10.2196/66764", "PMC12634005", "Creation and Implementation of an Electronic Sexual Assault Record at ", True),
    ("30099330", "10.1016/j.jcrc.2018.07.021", "", "Secondary EMR data for quality improvement and research: A comparison ", False),
    ("32036459", "10.1007/s10916-020-1532-x", "", "Problems and Barriers during the Process of Clinical Coding: a Focus G", False),
    ("32925343", "10.1213/ANE.0000000000005084", "", "Improving Transfusion Safety in the Operating Room With a Barcode Scan", False),
    ("33906650", "10.1186/s12936-021-03742-x", "PMC8077781", "Leveraging phone-based mobile technology to improve data quality at he", True),
    ("29107565", "10.1016/j.ijmedinf.2017.10.014", "PMC6997026", "Rubber stamp templates for improving clinical documentation: A paper-b", True),
    ("41875421", "10.2196/80549", "", "Evaluating Patient and Professional Satisfaction and Documentation Tim", False),
    ("41875245", "10.2196/83335", "PMC13012219", "A Bilingual Arabic-English Ambient AI Scribe for Clinical Documentatio", True),
    ("41691106", "10.1007/s10266-026-01335-1", "", "Comparative performance of AI models on case-based oral medicine quest", False),
    ("41691654", "10.1093/jamia/ocag005", "", "The impact of artificial intelligence scribes on physician and advance", False),
    ("41483142", "10.1007/s10916-025-02319-4", "", "The Current State of Digital Scribes in Primary Care: A Scoping Review", False),
    ("41533034", "10.1111/jep.70365", "", "Usability-Related Barriers and Facilitators Influencing the Adoption a", False),
    ("40584736", "10.1093/jamiaopen/ooaf061", "PMC12205731", "Cross-institutional dental electronic health record entity extraction ", True),
    ("41852979", "10.4103/jpbs.jpbs_1501_25", "PMC12995112", "Evaluation of Artificial Intelligence-Generated Emergency Department S", True),
    ("41849833", "10.1016/j.ajem.2026.03.007", "", "Automated auditing of emergency department documentation using large l", False),
    ("41444572", "10.1186/s13037-025-00460-0", "PMC12729816", "Development and evaluation of a novel voice-enabled prototype to suppo", True),
    ("41854578", "10.1016/j.annemergmed.2026.01.022", "PMC13004171", "A Pilot Study to Evaluate Artificial Intelligence-Driven Early Retriev", True),
    ("41835486", "10.1136/tsaco-2026-002272", "PMC12983730", "Artificial Intelligence documentation in trauma resuscitation: efficie", True),
    ("40277504", "10.3390/dj13040174", "PMC12025436", "Evaluation of Quality of Record-Keeping and Root Canal Therapy Perform", True),
    ("41634727", "10.1186/s12909-026-08676-z", "PMC12918063", "An audit of endodontic diagnostic documentation compliance among under", True),
    ("28281608", "10.1038/sj.bdj.2017.223", "", "Improving the quality of endodontic record keeping through clinical au", False),
    ("28644527", "10.1111/iej.12803", "", "An audit on technical quality of root fillings performed by undergradu", False),
    ("23660929", "10.1038/sj.bdj.2013.434", "", "Can audit improve patient care and treatment outcomes in endodontics?", False),
    ("36191029", "10.1371/journal.pone.0275634", "PMC9529118", "Quality of endodontic record-keeping and root canal obturation perform", True),
    ("33911363", "10.4103/JCD.JCD_220_19", "PMC8066672", "Is there a justification of conducting clinical audit in the endodonti", True),
    ("38888078", "10.1177/20501684241230799", "", "GIRFT and Measuring Outcomes in MCNs: endodontics in 646 teeth treated", False),
    ("38659337", "10.1111/jphd.12618", "PMC11499288", "Systematically assessing the quality of dental electronic health recor", True),
    ("36788907", "10.7759/cureus.33645", "PMC9912857", "Evaluation of Record Keeping in Exodontia Department of Punjab Dental ", True),
    ("39261854", "10.1186/s12903-024-04811-8", "PMC11391798", "Assessment of the quality of oral squamous cell carcinoma clinical rec", True),
    ("41238880", "10.1038/s41415-025-9104-6", "", "Evaluating the integration of the International Caries Classification ", False),
    ("41044215", "10.1038/s41415-025-9047-y", "", "General dental practitioner referral letters: a service evaluation on ", False),
    ("41285408", "10.1055/a-2751-1896", "PMC12700715", "A Preliminary Conceptual Framework of Clinical Documentation Burden: E", True),
    ("41625485", "10.1056/aioa2500945", "PMC12858090", "A Pragmatic Randomized Controlled Trial of Ambient Artificial Intellig", True),
    ("41118162", "10.1001/jamanetworkopen.2025.38427", "PMC12541540", "Large Language Model Assistant for Emergency Department Discharge Docu", True),
    ("41251650", "10.1016/j.annemergmed.2025.10.006", "", "Ambient Artificial Intelligence Versus Human Scribes in the Emergency ", False),
    ("28018563", "10.4047/jap.2016.8.6.457", "PMC5179484", "Comparing a tablet computer and paper forms for assessing patient-repo", True),
    ("38034181", "10.7759/cureus.48007", "PMC10687325", "It\'s About Time: A Study of Rheumatology Patient Consultation Times.", True),
    ("40193189", "10.2196/66232", "PMC12012399", "Assessing Patient-Reported Satisfaction With Care and Documentation Ti", True),
    ("41487870", "10.7759/cureus.98469", "PMC12764382", "Electronic Health Record Burnout in Surgery and Strategies to Improve ", True),
    ("41801972", "10.1002/jper.70106", "", "Usability of a deep learning platform for detecting radiographic bone ", False),
    ("41794718", "10.1186/s12903-026-08004-3", "", "A web-based augmented reality system for orthodontic biomechanics: per", False),
    ("41566298", "10.1186/s12903-026-07723-x", "PMC12930619", "Assessing a virtual scenario-based training system for enhancing clini", True),
    ("41539203", "10.1016/j.identj.2025.109361", "PMC12829107", "Acceptability and Usability of a Digital Medicines Tool for Dental Pra", True),
    ("41834175", "10.2196/78849", "PMC13000691", "Patient Perceptions of Blockchain-Based Health Information Exchange: U", True),
    ("40665326", "10.1186/s12909-025-07673-y", "PMC12265272", "Assessing oral surgery residents\' competencies and training needs in t", True),
    ("41785738", "10.1016/j.ijmedinf.2026.106367", "", "Accuracy, Efficiency, and usability of a Semi-Automated SMART on FHIR ", False),
    ("40045296", "10.1186/s12903-025-05729-5", "PMC11881495", "Developing and evaluating a dental incident reporting system: a user-c", True),
    ("41355200", "10.1002/jdd.70112", "", "Augmented Reality of Anatomical Structures of the Maxillomandibular Co", False),
    ("41687093", "10.2196/85916", "PMC12949397", "Anxiety-Free Public Dentistry for Adults With Disabilities by Using He", True),
    ("41685843", "10.14744/eej.2025.83788", "PMC12686871", "Artificial Intelligence in The Diagnosis, Treatment, and Prognosticati", True),
    ("41826005", "10.1016/j.cden.2025.11.010", "", "Artificial Intelligence and Its Application in Endodontics.", False),
    ("41836485", "10.3389/fdmed.2026.1730454", "PMC12982180", "Developing an AI-powered tool for radiographic feedback on working len", True),
    ("41867636", "10.3389/fdmed.2026.1783828", "PMC13002594", "Performance of artificial intelligence models designed as adjuncts for", True),
    ("41675776", "10.1097/MS9.0000000000004385", "PMC12889264", "AI in endodontics: enhancing precision, efficiency, and personalized c", True),
    ("41749771", "10.3390/bioengineering13020232", "PMC12937961", "Artificial Intelligence Versus Human Dental Expertise in Diagnosing Pe", True),
    ("41865812", "10.1016/j.jdent.2026.106643", "", "TAPSeg: An Open-Source Deep Learning Tool for Instance-Level Tooth and", False),
    ("41850234", "10.1016/j.xcrm.2026.102652", "PMC13006406", "Developing and evaluating multimodal large language model for orthopan", True),
    ("41833430", "10.1016/j.jebdp.2025.102225", "", "DIAGNOSTIC PERFORMANCE OF MACHINE LEARNING-AIDED PROXIMAL CARIES DETEC", False),
    ("40900876", "10.5662/wjm.v15.i4.105516", "PMC12400324", "Artificial intelligence for early diagnosis and risk prediction of per", True),
    ("25216146", "10.11607/jomi.3486", "", "Analysis of professional malpractice claims in implant dentistry in It", False),
    ("25796809", "", "", "Adverse events in Public Dental Service in a Swedish county--a survey ", False),
    ("23314462", "", "PMC3545411", "Assessing use of a standardized dental diagnostic terminology in an el", True),
    ("19047669", "10.14219/jada.archive.2008.0105", "PMC2614265", "A usability evaluation of four commercial dental computer-based patien", True),
    ("30556409", "10.1556/650.2018.31212", "", "[Analysis of medical diagnostic reports (constats) on dental injuries ", False),
    ("40861569", "10.7759/cureus.88685", "PMC12374792", "Implementation of a Standardized Surgical Operative Note: A Clinical A", True),
    ("34658378", "10.15644/asc55/3/9", "PMC8514230", "Preventing Wrong Tooth Extraction.", True),
    ("30576279", "10.5888/pcd15.180371", "PMC6307836", "Using Calibration to Reduce Measurement Error in Prevalence Estimates ", True),
]

# ==================== CONFIGURATION ====================
OUTPUT_DIR = Path("thesis_papers")
OA_DIR = OUTPUT_DIR / "open_access"
PAYWALLED_DIR = OUTPUT_DIR / "paywalled"
FAILED_DIR = OUTPUT_DIR / "failed"

PMC_PDF_URL = "https://www.ncbi.nlm.nih.gov/pmc/articles/{pmc_id}/pdf/"
PMC_XML_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id={pmc_id}&rettype=full&retmode=xml"
PUBMED_URL = "https://pubmed.ncbi.nlm.nih.gov/{pmid}/"
DOI_URL = "https://doi.org/{doi}"
SCIHUB_DOMAINS = ["sci-hub.se", "sci-hub.st", "sci-hub.ru"]  # Use at your own discretion

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}

def setup_dirs():
    for d in [OA_DIR, PAYWALLED_DIR, FAILED_DIR]:
        d.mkdir(parents=True, exist_ok=True)

def download_from_pmc(pmc_id, pmid, title):
    """Try to download PDF from PMC (open access)."""
    safe_name = f"PMID_{pmid}_{pmc_id}.pdf"
    output_path = OA_DIR / safe_name
    
    if output_path.exists():
        print(f"  [SKIP] Already downloaded: {safe_name}")
        return True
    
    # Try direct PMC PDF
    url = PMC_PDF_URL.format(pmc_id=pmc_id)
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30, allow_redirects=True)
        if resp.status_code == 200 and 'pdf' in resp.headers.get('content-type', '').lower():
            output_path.write_bytes(resp.content)
            print(f"  [OK] Downloaded: {safe_name} ({len(resp.content)//1024} KB)")
            return True
        elif resp.status_code == 200:
            # Sometimes returns HTML redirect — try to find PDF link
            output_path.write_bytes(resp.content)
            print(f"  [OK?] Downloaded (may need verification): {safe_name} ({len(resp.content)//1024} KB)")
            return True
    except Exception as e:
        print(f"  [WARN] PMC download failed: {e}")
    
    return False

def download_from_doi(doi, pmid, title):
    """Try to download from DOI (follows redirect to publisher)."""
    safe_name = f"PMID_{pmid}.pdf"
    output_path = PAYWALLED_DIR / safe_name

    if output_path.exists():
        print(f"  [SKIP] Already downloaded: {safe_name}")
        return True

    url = DOI_URL.format(doi=doi)
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30, allow_redirects=True)
        if resp.status_code == 200 and 'pdf' in resp.headers.get('content-type', '').lower():
            output_path.write_bytes(resp.content)
            print(f"  [OK] Downloaded via DOI: {safe_name} ({len(resp.content)//1024} KB)")
            return True
    except Exception as e:
        print(f"  [WARN] DOI download failed: {e}")

    return False

def download_from_elsevier_tdm(doi, pmid):
    """Download full-text PDF using Elsevier TDM API.
    Works for: J Endod, DCNA, J Dent, Caries Research, Int J Med Inform, etc.
    Docs: https://dev.elsevier.com/tdm_service.html
    """
    if not ELSEVIER_API_KEY:
        return False

    safe_name = f"PMID_{pmid}_elsevier.pdf"
    output_path = PAYWALLED_DIR / safe_name

    if output_path.exists():
        print(f"  [SKIP] Already downloaded: {safe_name}")
        return True

    # Elsevier Article Retrieval API - get PDF via DOI
    url = f"https://api.elsevier.com/content/article/doi/{doi}"
    headers = {
        'X-ELS-APIKey': ELSEVIER_API_KEY,
        'Accept': 'application/pdf'
    }

    try:
        resp = requests.get(url, headers=headers, timeout=60)
        if resp.status_code == 200 and len(resp.content) > 1000:
            content_type = resp.headers.get('content-type', '').lower()
            if 'pdf' in content_type or len(resp.content) > 50000:
                output_path.write_bytes(resp.content)
                print(f"  [OK] Downloaded via Elsevier TDM: {safe_name} ({len(resp.content)//1024} KB)")
                return True
            else:
                print(f"  [WARN] Elsevier returned non-PDF content ({content_type})")
        elif resp.status_code == 401:
            print(f"  [WARN] Elsevier API key unauthorized — check your key")
        elif resp.status_code == 403:
            print(f"  [WARN] Elsevier access denied — your institution may not subscribe to this journal")
        else:
            print(f"  [WARN] Elsevier returned status {resp.status_code}")
    except Exception as e:
        print(f"  [WARN] Elsevier TDM failed: {e}")

    # Also try XML full text (useful for text mining even if PDF fails)
    try:
        headers_xml = {
            'X-ELS-APIKey': ELSEVIER_API_KEY,
            'Accept': 'text/xml'
        }
        resp = requests.get(url, headers=headers_xml, timeout=60)
        if resp.status_code == 200 and len(resp.content) > 1000:
            xml_path = PAYWALLED_DIR / f"PMID_{pmid}_elsevier.xml"
            xml_path.write_bytes(resp.content)
            print(f"  [OK] Downloaded XML via Elsevier TDM: {xml_path.name} ({len(resp.content)//1024} KB)")
            return True
    except:
        pass

    return False

def download_from_wiley_tdm(doi, pmid):
    """Download full-text PDF using Wiley TDM API.
    Works for: Int Endod J, Aust Endod J, J Clin Nurs, etc.
    Docs: https://onlinelibrary.wiley.com/library-info/resources/text-and-datamining
    """
    if not WILEY_TDM_TOKEN:
        return False

    safe_name = f"PMID_{pmid}_wiley.pdf"
    output_path = PAYWALLED_DIR / safe_name

    if output_path.exists():
        print(f"  [SKIP] Already downloaded: {safe_name}")
        return True

    # Wiley TDM API endpoint
    url = f"https://api.wiley.com/onlinelibrary/tdm/v1/articles/{doi}"
    headers = {
        'Wiley-TDM-Client-Token': WILEY_TDM_TOKEN,
        'Accept': 'application/pdf'
    }

    try:
        resp = requests.get(url, headers=headers, timeout=60)
        if resp.status_code == 200 and len(resp.content) > 1000:
            output_path.write_bytes(resp.content)
            print(f"  [OK] Downloaded via Wiley TDM: {safe_name} ({len(resp.content)//1024} KB)")
            return True
        elif resp.status_code == 401:
            print(f"  [WARN] Wiley TDM token unauthorized — check your token")
        elif resp.status_code == 403:
            print(f"  [WARN] Wiley access denied — institution may not subscribe")
        else:
            print(f"  [WARN] Wiley returned status {resp.status_code}")
    except Exception as e:
        print(f"  [WARN] Wiley TDM failed: {e}")

    return False

def try_paperscraper(doi, pmid):
    """Try using paperscraper if installed."""
    try:
        from paperscraper.pdf import save_pdf
        safe_name = f"PMID_{pmid}.pdf"
        output_path = PAYWALLED_DIR / safe_name
        
        if output_path.exists():
            return True
        
        paper_data = {'doi': doi}
        save_pdf(paper_data, filepath=str(output_path))
        if output_path.exists() and output_path.stat().st_size > 1000:
            print(f"  [OK] Downloaded via paperscraper: {safe_name}")
            return True
    except ImportError:
        pass
    except Exception as e:
        print(f"  [WARN] paperscraper failed: {e}")
    
    return False

def generate_manual_links(failed_articles):
    """Generate a file with links for manual download."""
    links_file = OUTPUT_DIR / "MANUAL_DOWNLOAD_LINKS.txt"
    with open(links_file, 'w') as f:
        f.write("=" * 70 + "\n")
        f.write("MANUAL DOWNLOAD LINKS\n")
        f.write("Use your AIIMS institutional access to download these\n")
        f.write("=" * 70 + "\n\n")
        
        for pmid, doi, pmc, title, _ in failed_articles:
            f.write(f"PMID: {pmid}\n")
            f.write(f"Title: {title}\n")
            f.write(f"PubMed: https://pubmed.ncbi.nlm.nih.gov/{pmid}/\n")
            if doi:
                f.write(f"DOI: https://doi.org/{doi}\n")
            f.write("-" * 50 + "\n\n")
    
    print(f"\n[INFO] Manual download links saved to: {links_file}")

def main():
    print("=" * 60)
    print("EndoFlow Thesis Literature Downloader")
    print(f"Total articles: {len(ARTICLES)}")
    print("=" * 60)
    
    setup_dirs()
    
    downloaded = 0
    failed_articles = []
    
    # Phase 1: Open Access articles from PMC
    oa_articles = [(p, d, pmc, t, oa) for p, d, pmc, t, oa in ARTICLES if oa and pmc]
    pw_articles = [(p, d, pmc, t, oa) for p, d, pmc, t, oa in ARTICLES if not oa]
    
    print(f"\n--- Phase 1: Open Access via PMC ({len(oa_articles)} articles) ---\n")
    for pmid, doi, pmc, title, _ in oa_articles:
        print(f"[{downloaded+1}/{len(ARTICLES)}] PMID {pmid}: {title[:60]}...")
        if download_from_pmc(pmc, pmid, title):
            downloaded += 1
        else:
            # Fallback to DOI
            if doi and download_from_doi(doi, pmid, title):
                downloaded += 1
            else:
                failed_articles.append((pmid, doi, pmc, title, True))
        time.sleep(0.5)  # Be nice to servers
    
    print(f"\n--- Phase 2: Paywalled Articles ({len(pw_articles)} articles) ---\n")
    if ELSEVIER_API_KEY:
        print(f"  Elsevier TDM API key: LOADED")
    else:
        print(f"  Elsevier TDM API key: NOT SET (add to .env file)")
    if WILEY_TDM_TOKEN:
        print(f"  Wiley TDM token: LOADED")
    else:
        print(f"  Wiley TDM token: NOT SET (add to .env file)")
    print()

    # Identify Elsevier and Wiley DOIs by prefix
    ELSEVIER_DOI_PREFIXES = ['10.1016/', '10.1053/', '10.1067/', '10.1078/', '10.11607/']
    WILEY_DOI_PREFIXES = ['10.1111/', '10.1002/', '10.1046/']

    for pmid, doi, pmc, title, _ in pw_articles:
        print(f"[{downloaded+1}/{len(ARTICLES)}] PMID {pmid}: {title[:60]}...")
        success = False

        if doi:
            # Try publisher-specific TDM APIs first
            is_elsevier = any(doi.startswith(p) for p in ELSEVIER_DOI_PREFIXES)
            is_wiley = any(doi.startswith(p) for p in WILEY_DOI_PREFIXES)

            if is_elsevier and ELSEVIER_API_KEY:
                success = download_from_elsevier_tdm(doi, pmid)
            elif is_wiley and WILEY_TDM_TOKEN:
                success = download_from_wiley_tdm(doi, pmid)

            # Fallback chain: DOI redirect → paperscraper
            if not success:
                success = download_from_doi(doi, pmid, title)
            if not success:
                success = try_paperscraper(doi, pmid)

        if success:
            downloaded += 1
        else:
            failed_articles.append((pmid, doi, pmc, title, False))
        time.sleep(0.5)
    
    # Generate manual download links for failures
    if failed_articles:
        generate_manual_links(failed_articles)
    
    # Summary
    print("\n" + "=" * 60)
    print("DOWNLOAD SUMMARY")
    print("=" * 60)
    print(f"Total articles: {len(ARTICLES)}")
    print(f"Successfully downloaded: {downloaded}")
    print(f"Failed (need manual download): {len(failed_articles)}")
    print(f"\nFiles saved to: {OUTPUT_DIR.absolute()}")
    print(f"  Open access: {OA_DIR}")
    print(f"  Paywalled: {PAYWALLED_DIR}")
    if failed_articles:
        print(f"  Manual links: {OUTPUT_DIR / 'MANUAL_DOWNLOAD_LINKS.txt'}")

if __name__ == "__main__":
    main()
