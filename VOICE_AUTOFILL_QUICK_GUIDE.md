# Voice Autofill Quick Reference Guide

## What Gets Auto-Filled Now? ✨

### ✅ Chief Complaint Tab
- Primary complaint
- Pain scale (0-10)
- Location details
- Associated symptoms
- Triggers

### ✅ HOPI Tab (History of Present Illness)
- Onset details (when, how, why)
- Pain characteristics (quality, intensity, duration)
- Aggravating factors
- Relieving factors
- Previous episodes
- Previous treatments

### ✅ Medical History Tab (NEW!)
- Medical conditions (Diabetes, Hypertension, etc.)
- Current medications with dosages
- Allergies
- Previous dental treatments
- Family medical history

### ✅ Personal History Tab (NEW!)
- Smoking status and details
- Alcohol consumption
- Tobacco use
- Dietary habits
- Oral hygiene practices
- Other habits (teeth grinding, nail biting, etc.)
- Occupation

### ✅ Clinical Examination Tab (NEW!)
- Extraoral findings
- Intraoral findings
- Oral hygiene status
- Gingival condition
- Periodontal status
- Occlusion notes

## How to Use

### 1. Start Voice Recording
- Click the **microphone button** at the top of the consultation form
- Grant microphone permissions if prompted
- Speak naturally during the consultation

### 2. Conduct Consultation
Mention relevant information as you talk with the patient:

**Example Conversation:**
```
Doctor: "What brings you in today?"
Patient: "I have severe pain in my upper right molar. Started 3 days ago."

Doctor: "Any medical conditions I should know about?"
Patient: "I have diabetes, taking metformin 500mg twice daily. 
         Allergic to penicillin."

Doctor: "Do you smoke or drink?"
Patient: "I smoke about half a pack a day. Drink beer on weekends."

Doctor: "Let me examine... I see some caries on tooth 16. 
         Gums are inflamed. Fair oral hygiene with plaque buildup."
```

### 3. Stop Recording
- Click the **stop button** when consultation is complete
- AI processes the transcript (takes 2-4 seconds)

### 4. Review Auto-Filled Data
- Navigate through tabs to see AI-populated fields
- Look for **purple alert boxes** indicating AI-extracted data
- Check **confidence scores** on each tab

### 5. Verify & Save
- Review all auto-filled information
- Make corrections if needed
- Click **Save** on each tab

## What to Say for Best Results

### Medical History
✅ **Good:** "Patient has diabetes and hypertension, takes lisinopril 10mg daily"
❌ **Avoid:** "Patient has some medical issues"

### Personal History
✅ **Good:** "Smokes one pack per day for 10 years, drinks socially on weekends"
❌ **Avoid:** "Has some habits"

### Clinical Examination
✅ **Good:** "Multiple caries present, moderate gingivitis, fair oral hygiene"
❌ **Avoid:** "Mouth doesn't look great"

## Understanding Confidence Scores

- **90-100%** 🟢 Excellent - High confidence, detailed information
- **70-89%** 🟡 Good - Most information captured
- **50-69%** 🟠 Fair - Basic information, verify carefully
- **Below 50%** 🔴 Low - Manual verification required

## Tips for Better Extraction

### ✅ DO:
- Speak clearly and at normal pace
- Use medical terminology when possible
- Mention specific details (dosages, dates, etc.)
- State patient's exact words for chief complaint
- Describe findings as you examine

### ❌ DON'T:
- Rush through patient history
- Speak in fragments
- Use only abbreviations without context
- Have loud background noise
- Interrupt the patient frequently

## Common Mappings

### Medical Conditions
| You Say | AI Maps To |
|---------|------------|
| "high blood pressure" | Hypertension |
| "sugar problem" | Diabetes |
| "breathing issues" | Asthma |
| "heart problems" | Heart Disease |

### Habits
| You Say | AI Maps To |
|---------|------------|
| "grinds teeth at night" | Teeth grinding (bruxism) |
| "bites nails" | Nail biting |
| "lots of candy" | High sugar diet |
| "clenches jaw when stressed" | Jaw clenching |

### Clinical Findings
| You Say | AI Maps To |
|---------|------------|
| "see some cavities" | Caries present |
| "gums look red and swollen" | Gingival inflammation |
| "lots of tartar" | Plaque / calculus |
| "tooth is loose" | Tooth mobility |

## Troubleshooting

### ❌ Nothing Auto-Fills
**Solutions:**
- Check microphone permissions
- Ensure you stopped the recording
- Verify Gemini API key is configured
- Check browser console for errors
- Try speaking more clearly

### ❌ Wrong Information Extracted
**Solutions:**
- Speak more deliberately
- Use standard medical terms
- Reduce background noise
- Manually correct the fields
- Save corrected version

### ❌ Low Confidence Score
**Causes:**
- Vague descriptions
- Fragmented speech
- Missing details
- Background noise

**Fix:** Manually review and complete the information

## Keyboard Shortcuts

- **Start/Stop Recording:** (varies by browser)
- **Navigate Tabs:** Click or use Tab key
- **Save Current Tab:** Ctrl + S (if implemented)

## FAQ

**Q: Can I edit AI-filled data?**
A: Yes! All fields are editable. AI is a helper, not a replacement for your judgment.

**Q: What if the AI misses something?**
A: Simply add it manually. The AI extracts what it can clearly identify.

**Q: Does it work in other languages?**
A: Currently optimized for English. Other languages not fully tested.

**Q: How accurate is the AI?**
A: Typically 70-90% accurate with clear speech. Always verify before saving.

**Q: Is the voice data saved?**
A: The transcript is saved to the consultation record. Audio may be saved depending on configuration.

**Q: Can I disable autofill?**
A: Yes, you can simply ignore the AI-filled data and enter manually.

## Example Workflow

```
1. Patient arrives → 2. Start recording → 3. Conduct consultation
         ↓                    ↓                      ↓
   Chief complaint      Ask about history    Perform examination
         ↓                    ↓                      ↓
   Voice captures      AI processes         Mention findings
         ↓                    ↓                      ↓
   Stop recording      Review tabs          Verify data
         ↓                    ↓                      ↓
   AI extracts         Make corrections     Save consultation
```

## Need Help?

1. **Check Console Logs**: Press F12 → Console tab → Look for:
   - `📊 [MEDICAL HISTORY]`
   - `👤 [PERSONAL HISTORY]`
   - `🔍 [CLINICAL EXAM]`

2. **Review Confidence**: Low scores mean manual review needed

3. **Test with Simple Cases**: Start with straightforward consultations

4. **Report Issues**: Note the transcript and expected vs actual results

## Pro Tips 💡

1. **Structure Your Questions**: Ask history questions systematically
2. **Narrate Examination**: Say findings out loud as you examine
3. **Use Patient's Words**: For chief complaint, quote the patient
4. **Confirm Details**: Have patient confirm allergies and medications
5. **Review Before Saving**: Always verify AI-extracted data

## Updates & Improvements

The AI model continuously improves. Future updates may include:
- Better context understanding
- Multi-language support
- Drug interaction warnings
- Pattern recognition across visits
- Voice command controls

---

**Last Updated:** January 2025
**Version:** 2.0 (Comprehensive Autofill)
**Model:** Gemini 2.0 Flash