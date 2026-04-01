/**
 * Diagnostic Questionnaire Template System
 *
 * Validated clinical questionnaires as structured templates, based on:
 * - AAE (American Association of Endodontists) diagnostic criteria
 * - IADT (International Association of Dental Traumatology) guidelines
 * - AAP/EFP 2017 World Workshop classification
 * - AAE cracked tooth and resorption protocols
 *
 * Phase 2.1 of Session 6: Multi-Agent Pre-Processing Layer
 */

// =====================================================
// INTERFACES
// =====================================================

export type QuestionPriority = 'diagnosis_changing' | 'confidence_improving' | 'context_enriching'

export interface QuestionnaireQuestion {
  id: string
  text: string
  clinical_test: string
  priority: QuestionPriority
  expected_values: string[]
  diagnostic_weight: number // 0-1
}

export interface QuestionnaireTemplate {
  id: string
  name: string
  subspecialty: string
  source: string
  questions: QuestionnaireQuestion[]
}

// =====================================================
// QUESTIONNAIRE TEMPLATES
// =====================================================

export const QUESTIONNAIRE_TEMPLATES: QuestionnaireTemplate[] = [
  // ─────────────────────────────────────────────────
  // 1. AAE PULP DIAGNOSIS
  // ─────────────────────────────────────────────────
  {
    id: 'aae_pulp_diagnosis',
    name: 'AAE Pulp Diagnosis Criteria',
    subspecialty: 'pulp_pathology',
    source: 'AAE',
    questions: [
      {
        id: 'cold_test',
        text: 'What was the cold test response?',
        clinical_test: 'cold_test',
        priority: 'diagnosis_changing',
        expected_values: ['no_response', 'normal', 'exaggerated_brief', 'lingering', 'not_performed'],
        diagnostic_weight: 0.95,
      },
      {
        id: 'spontaneous_pain',
        text: 'Is there spontaneous pain (not provoked)?',
        clinical_test: 'symptom_assessment',
        priority: 'diagnosis_changing',
        expected_values: ['yes', 'no', 'uncertain'],
        diagnostic_weight: 0.90,
      },
      {
        id: 'ept_response',
        text: 'What was the EPT response?',
        clinical_test: 'ept',
        priority: 'diagnosis_changing',
        expected_values: ['normal_range', 'elevated', 'no_response', 'not_performed'],
        diagnostic_weight: 0.85,
      },
      {
        id: 'percussion',
        text: 'Is percussion positive?',
        clinical_test: 'percussion',
        priority: 'diagnosis_changing',
        expected_values: ['positive', 'negative', 'slight_tenderness', 'not_performed'],
        diagnostic_weight: 0.80,
      },
      {
        id: 'palpation',
        text: 'Is palpation of the apical area positive?',
        clinical_test: 'palpation',
        priority: 'confidence_improving',
        expected_values: ['positive', 'negative', 'swelling', 'not_performed'],
        diagnostic_weight: 0.60,
      },
      {
        id: 'periapical_radiolucency',
        text: 'Is there periapical radiolucency on radiograph?',
        clinical_test: 'radiographic',
        priority: 'diagnosis_changing',
        expected_values: ['yes_well_defined', 'yes_diffuse', 'no', 'widened_pdl', 'not_available'],
        diagnostic_weight: 0.85,
      },
      {
        id: 'pain_duration',
        text: 'How long has the pain been present?',
        clinical_test: 'history',
        priority: 'confidence_improving',
        expected_values: ['hours', 'days', 'weeks', 'months', 'intermittent'],
        diagnostic_weight: 0.50,
      },
      {
        id: 'pain_quality',
        text: 'What is the quality of the pain?',
        clinical_test: 'history',
        priority: 'confidence_improving',
        expected_values: ['sharp', 'dull', 'throbbing', 'aching', 'pressure', 'no_pain'],
        diagnostic_weight: 0.45,
      },
      {
        id: 'thermal_sensitivity',
        text: 'Is there thermal sensitivity (hot/cold)?',
        clinical_test: 'thermal_test',
        priority: 'diagnosis_changing',
        expected_values: ['hot_only', 'cold_only', 'both', 'neither', 'lingering_to_hot'],
        diagnostic_weight: 0.80,
      },
      {
        id: 'bite_pain',
        text: 'Is there pain on biting or chewing?',
        clinical_test: 'bite_test',
        priority: 'confidence_improving',
        expected_values: ['yes_sharp', 'yes_dull', 'on_release', 'no', 'uncertain'],
        diagnostic_weight: 0.65,
      },
      {
        id: 'swelling',
        text: 'Is there any swelling (intraoral or extraoral)?',
        clinical_test: 'clinical_exam',
        priority: 'diagnosis_changing',
        expected_values: ['intraoral_localized', 'intraoral_diffuse', 'extraoral', 'sinus_tract', 'none'],
        diagnostic_weight: 0.75,
      },
      {
        id: 'tooth_mobility',
        text: 'Is there increased tooth mobility?',
        clinical_test: 'mobility_test',
        priority: 'confidence_improving',
        expected_values: ['grade_1', 'grade_2', 'grade_3', 'normal', 'not_assessed'],
        diagnostic_weight: 0.55,
      },
      {
        id: 'probing_depths',
        text: 'What are the probing depths around the tooth?',
        clinical_test: 'periodontal_probing',
        priority: 'confidence_improving',
        expected_values: ['normal_1_3mm', 'moderate_4_5mm', 'deep_6plus_mm', 'isolated_deep_pocket', 'not_probed'],
        diagnostic_weight: 0.60,
      },
      {
        id: 'previous_treatment',
        text: 'Has this tooth been previously treated?',
        clinical_test: 'history',
        priority: 'context_enriching',
        expected_values: ['no_treatment', 'restored', 'rct_done', 'crown', 'retreatment', 'unknown'],
        diagnostic_weight: 0.40,
      },
    ],
  },

  // ─────────────────────────────────────────────────
  // 2. AAE PERIAPICAL DIAGNOSIS
  // ─────────────────────────────────────────────────
  {
    id: 'aae_periapical_diagnosis',
    name: 'AAE Periapical Diagnosis Criteria',
    subspecialty: 'periapical_pathology',
    source: 'AAE',
    questions: [
      {
        id: 'periapical_radiolucency_pa',
        text: 'Is there a periapical radiolucency?',
        clinical_test: 'radiographic',
        priority: 'diagnosis_changing',
        expected_values: ['yes_well_defined', 'yes_diffuse', 'widened_pdl', 'no', 'not_available'],
        diagnostic_weight: 0.95,
      },
      {
        id: 'percussion_pa',
        text: 'Is percussion painful?',
        clinical_test: 'percussion',
        priority: 'diagnosis_changing',
        expected_values: ['positive_severe', 'positive_mild', 'negative', 'not_performed'],
        diagnostic_weight: 0.85,
      },
      {
        id: 'palpation_pa',
        text: 'Is palpation of the apical area painful or swollen?',
        clinical_test: 'palpation',
        priority: 'diagnosis_changing',
        expected_values: ['painful', 'swelling_fluctuant', 'swelling_firm', 'negative', 'not_performed'],
        diagnostic_weight: 0.80,
      },
      {
        id: 'sinus_tract',
        text: 'Is a sinus tract (fistula) present?',
        clinical_test: 'clinical_exam',
        priority: 'diagnosis_changing',
        expected_values: ['yes_draining', 'yes_not_draining', 'no'],
        diagnostic_weight: 0.90,
      },
      {
        id: 'pulp_vitality_pa',
        text: 'Is the pulp vital (responds to cold/EPT)?',
        clinical_test: 'vitality_test',
        priority: 'diagnosis_changing',
        expected_values: ['vital', 'non_vital', 'equivocal', 'not_tested'],
        diagnostic_weight: 0.90,
      },
      {
        id: 'symptom_onset_pa',
        text: 'Was symptom onset rapid (acute) or gradual (chronic)?',
        clinical_test: 'history',
        priority: 'diagnosis_changing',
        expected_values: ['acute_rapid', 'chronic_gradual', 'acute_on_chronic', 'asymptomatic'],
        diagnostic_weight: 0.75,
      },
      {
        id: 'swelling_pa',
        text: 'Is there soft tissue swelling?',
        clinical_test: 'clinical_exam',
        priority: 'diagnosis_changing',
        expected_values: ['localized_intraoral', 'diffuse_extraoral', 'cellulitis', 'none'],
        diagnostic_weight: 0.80,
      },
      {
        id: 'tooth_elevated',
        text: 'Does the tooth feel elevated in the socket?',
        clinical_test: 'clinical_exam',
        priority: 'confidence_improving',
        expected_values: ['yes', 'no', 'uncertain'],
        diagnostic_weight: 0.55,
      },
      {
        id: 'fever_malaise',
        text: 'Does the patient have fever or malaise?',
        clinical_test: 'systemic_assessment',
        priority: 'confidence_improving',
        expected_values: ['yes_fever', 'yes_malaise', 'both', 'no'],
        diagnostic_weight: 0.50,
      },
      {
        id: 'lymphadenopathy',
        text: 'Is there regional lymphadenopathy?',
        clinical_test: 'clinical_exam',
        priority: 'confidence_improving',
        expected_values: ['yes_tender', 'yes_non_tender', 'no', 'not_assessed'],
        diagnostic_weight: 0.45,
      },
    ],
  },

  // ─────────────────────────────────────────────────
  // 3. IADT DENTAL TRAUMA CLASSIFICATION
  // ─────────────────────────────────────────────────
  {
    id: 'iadt_trauma',
    name: 'IADT Dental Trauma Classification',
    subspecialty: 'trauma',
    source: 'IADT',
    questions: [
      {
        id: 'trauma_type',
        text: 'What type of trauma occurred?',
        clinical_test: 'history',
        priority: 'diagnosis_changing',
        expected_values: ['fall', 'sports', 'accident', 'assault', 'unknown'],
        diagnostic_weight: 0.70,
      },
      {
        id: 'time_since_trauma',
        text: 'How much time has passed since the trauma?',
        clinical_test: 'history',
        priority: 'diagnosis_changing',
        expected_values: ['less_1h', '1_3h', '3_24h', '24h_1w', 'more_1w'],
        diagnostic_weight: 0.85,
      },
      {
        id: 'crown_fracture',
        text: 'Is there a crown fracture?',
        clinical_test: 'clinical_exam',
        priority: 'diagnosis_changing',
        expected_values: ['enamel_infraction', 'enamel_fracture', 'enamel_dentin', 'enamel_dentin_pulp', 'crown_root_fracture', 'no'],
        diagnostic_weight: 0.90,
      },
      {
        id: 'pulp_exposure_trauma',
        text: 'Is there pulp exposure?',
        clinical_test: 'clinical_exam',
        priority: 'diagnosis_changing',
        expected_values: ['yes_pinpoint', 'yes_large', 'no', 'uncertain'],
        diagnostic_weight: 0.95,
      },
      {
        id: 'root_fracture',
        text: 'Is there a root fracture on radiograph?',
        clinical_test: 'radiographic',
        priority: 'diagnosis_changing',
        expected_values: ['cervical_third', 'middle_third', 'apical_third', 'no', 'not_available'],
        diagnostic_weight: 0.90,
      },
      {
        id: 'luxation_type',
        text: 'What type of luxation injury is present?',
        clinical_test: 'clinical_exam',
        priority: 'diagnosis_changing',
        expected_values: ['concussion', 'subluxation', 'extrusive', 'lateral', 'intrusive', 'avulsion', 'none'],
        diagnostic_weight: 0.95,
      },
      {
        id: 'tooth_displacement',
        text: 'How much displacement is present (mm)?',
        clinical_test: 'clinical_exam',
        priority: 'diagnosis_changing',
        expected_values: ['none', 'less_2mm', '2_5mm', 'more_5mm', 'complete_avulsion'],
        diagnostic_weight: 0.80,
      },
      {
        id: 'mobility_trauma',
        text: 'What is the tooth mobility?',
        clinical_test: 'mobility_test',
        priority: 'diagnosis_changing',
        expected_values: ['normal', 'slight', 'moderate', 'severe', 'depressed_immobile'],
        diagnostic_weight: 0.75,
      },
      {
        id: 'tooth_maturity',
        text: 'Is the root apex open (immature) or closed (mature)?',
        clinical_test: 'radiographic',
        priority: 'diagnosis_changing',
        expected_values: ['open_apex_immature', 'closed_apex_mature', 'not_available'],
        diagnostic_weight: 0.85,
      },
      {
        id: 'vitality_trauma',
        text: 'Is pulp vitality testing positive?',
        clinical_test: 'vitality_test',
        priority: 'confidence_improving',
        expected_values: ['positive', 'negative', 'inconclusive', 'deferred'],
        diagnostic_weight: 0.60,
      },
      {
        id: 'alveolar_fracture',
        text: 'Is there an alveolar bone fracture?',
        clinical_test: 'radiographic',
        priority: 'diagnosis_changing',
        expected_values: ['yes', 'no', 'suspected', 'not_available'],
        diagnostic_weight: 0.80,
      },
      {
        id: 'dentition_type',
        text: 'Is this a primary or permanent tooth?',
        clinical_test: 'clinical_exam',
        priority: 'diagnosis_changing',
        expected_values: ['primary', 'permanent'],
        diagnostic_weight: 0.70,
      },
    ],
  },

  // ─────────────────────────────────────────────────
  // 4. ENDO-PERIO CLASSIFICATION (2017 Workshop)
  // ─────────────────────────────────────────────────
  {
    id: 'endo_perio_classification',
    name: 'Endo-Perio Lesion Classification (2017 Workshop)',
    subspecialty: 'endo_perio',
    source: 'AAP/EFP',
    questions: [
      {
        id: 'pulp_status_ep',
        text: 'What is the pulp status?',
        clinical_test: 'vitality_test',
        priority: 'diagnosis_changing',
        expected_values: ['vital', 'non_vital', 'previously_treated', 'equivocal'],
        diagnostic_weight: 0.95,
      },
      {
        id: 'probing_pattern',
        text: 'What is the probing depth pattern?',
        clinical_test: 'periodontal_probing',
        priority: 'diagnosis_changing',
        expected_values: ['generalized_deep', 'isolated_narrow_deep', 'normal', 'one_wall_defect'],
        diagnostic_weight: 0.90,
      },
      {
        id: 'bone_loss_pattern',
        text: 'What is the bone loss pattern on radiograph?',
        clinical_test: 'radiographic',
        priority: 'diagnosis_changing',
        expected_values: ['horizontal_generalized', 'vertical_isolated', 'periapical_only', 'combined', 'none'],
        diagnostic_weight: 0.90,
      },
      {
        id: 'root_perforation',
        text: 'Is there a root perforation or resorption?',
        clinical_test: 'radiographic',
        priority: 'diagnosis_changing',
        expected_values: ['perforation', 'external_resorption', 'internal_resorption', 'no', 'uncertain'],
        diagnostic_weight: 0.85,
      },
      {
        id: 'perio_status',
        text: 'What is the general periodontal status?',
        clinical_test: 'periodontal_assessment',
        priority: 'diagnosis_changing',
        expected_values: ['healthy', 'gingivitis', 'stage_1_perio', 'stage_2_perio', 'stage_3_perio', 'stage_4_perio'],
        diagnostic_weight: 0.85,
      },
      {
        id: 'vertical_root_fracture_ep',
        text: 'Is a vertical root fracture suspected?',
        clinical_test: 'clinical_exam',
        priority: 'diagnosis_changing',
        expected_values: ['yes_confirmed', 'suspected', 'no'],
        diagnostic_weight: 0.80,
      },
      {
        id: 'previous_endo_ep',
        text: 'Has endodontic treatment been performed?',
        clinical_test: 'history',
        priority: 'diagnosis_changing',
        expected_values: ['yes_adequate', 'yes_inadequate', 'no', 'unknown'],
        diagnostic_weight: 0.75,
      },
      {
        id: 'sinus_tract_ep',
        text: 'Is there a draining sinus tract?',
        clinical_test: 'clinical_exam',
        priority: 'confidence_improving',
        expected_values: ['yes_apical', 'yes_lateral', 'no'],
        diagnostic_weight: 0.65,
      },
    ],
  },

  // ─────────────────────────────────────────────────
  // 5. CRACKED TOOTH ASSESSMENT
  // ─────────────────────────────────────────────────
  {
    id: 'cracked_tooth_assessment',
    name: 'Cracked Tooth Assessment Protocol',
    subspecialty: 'cracked_tooth',
    source: 'AAE',
    questions: [
      {
        id: 'bite_pain_crack',
        text: 'Is there sharp pain on biting or on release of bite?',
        clinical_test: 'bite_test',
        priority: 'diagnosis_changing',
        expected_values: ['pain_on_biting', 'pain_on_release', 'both', 'no', 'not_tested'],
        diagnostic_weight: 0.95,
      },
      {
        id: 'tooth_slooth',
        text: 'Is Tooth Slooth / FracFinder test positive?',
        clinical_test: 'fracture_detection',
        priority: 'diagnosis_changing',
        expected_values: ['positive_specific_cusp', 'positive_multiple', 'negative', 'not_performed'],
        diagnostic_weight: 0.90,
      },
      {
        id: 'crack_visible',
        text: 'Is a crack line visible (direct or with transillumination/staining)?',
        clinical_test: 'visual_exam',
        priority: 'diagnosis_changing',
        expected_values: ['yes_transillumination', 'yes_staining', 'yes_visible', 'suspected_not_visible', 'no'],
        diagnostic_weight: 0.85,
      },
      {
        id: 'crack_extent',
        text: 'What is the estimated crack extent?',
        clinical_test: 'clinical_assessment',
        priority: 'diagnosis_changing',
        expected_values: ['craze_line', 'cracked_tooth_marginal_ridge', 'cracked_tooth_to_pulp', 'split_tooth', 'vertical_root_fracture', 'unknown'],
        diagnostic_weight: 0.95,
      },
      {
        id: 'pulp_status_crack',
        text: 'What is the pulp status of the cracked tooth?',
        clinical_test: 'vitality_test',
        priority: 'diagnosis_changing',
        expected_values: ['normal_pulp', 'reversible_pulpitis', 'irreversible_pulpitis', 'necrotic', 'not_tested'],
        diagnostic_weight: 0.90,
      },
      {
        id: 'restoration_present',
        text: 'Is there an existing restoration?',
        clinical_test: 'clinical_exam',
        priority: 'confidence_improving',
        expected_values: ['large_amalgam', 'large_composite', 'onlay_inlay', 'crown', 'unrestored', 'other'],
        diagnostic_weight: 0.50,
      },
      {
        id: 'probing_crack',
        text: 'Is there an isolated deep probing depth along the crack?',
        clinical_test: 'periodontal_probing',
        priority: 'diagnosis_changing',
        expected_values: ['yes_isolated_deep', 'no', 'not_probed'],
        diagnostic_weight: 0.80,
      },
      {
        id: 'thermal_crack',
        text: 'Is there thermal sensitivity?',
        clinical_test: 'thermal_test',
        priority: 'confidence_improving',
        expected_values: ['cold_sensitive', 'hot_sensitive', 'both', 'no', 'lingering'],
        diagnostic_weight: 0.60,
      },
    ],
  },

  // ─────────────────────────────────────────────────
  // 6. RESORPTION CLASSIFICATION
  // ─────────────────────────────────────────────────
  {
    id: 'resorption_classification',
    name: 'Resorption Classification',
    subspecialty: 'resorption',
    source: 'AAE',
    questions: [
      {
        id: 'resorption_location',
        text: 'Where is the resorption located?',
        clinical_test: 'radiographic',
        priority: 'diagnosis_changing',
        expected_values: ['internal', 'external_cervical', 'external_apical', 'external_lateral', 'surface', 'not_determined'],
        diagnostic_weight: 0.95,
      },
      {
        id: 'resorption_type',
        text: 'What type of resorption is it?',
        clinical_test: 'radiographic',
        priority: 'diagnosis_changing',
        expected_values: ['inflammatory', 'replacement_ankylosis', 'cervical_invasive', 'pressure', 'idiopathic', 'unknown'],
        diagnostic_weight: 0.95,
      },
      {
        id: 'pulp_status_resorption',
        text: 'What is the pulp status?',
        clinical_test: 'vitality_test',
        priority: 'diagnosis_changing',
        expected_values: ['vital', 'non_vital', 'equivocal', 'not_tested'],
        diagnostic_weight: 0.85,
      },
      {
        id: 'resorption_extent',
        text: 'What is the extent of resorption (Heithersay/CBCT classification)?',
        clinical_test: 'radiographic',
        priority: 'diagnosis_changing',
        expected_values: ['class_1_small', 'class_2_moderate', 'class_3_large', 'class_4_extensive', 'not_classified'],
        diagnostic_weight: 0.85,
      },
      {
        id: 'symptom_status_resorption',
        text: 'Is the resorption symptomatic?',
        clinical_test: 'symptom_assessment',
        priority: 'confidence_improving',
        expected_values: ['asymptomatic', 'mild_symptoms', 'significant_pain', 'mobility'],
        diagnostic_weight: 0.55,
      },
      {
        id: 'etiology_resorption',
        text: 'Is there a known etiology (trauma, orthodontics, impaction)?',
        clinical_test: 'history',
        priority: 'confidence_improving',
        expected_values: ['trauma', 'orthodontic', 'impacted_tooth', 'periodontal', 'previous_rct', 'unknown'],
        diagnostic_weight: 0.50,
      },
      {
        id: 'cbct_available',
        text: 'Is CBCT imaging available?',
        clinical_test: 'radiographic',
        priority: 'confidence_improving',
        expected_values: ['yes', 'no_only_periapical', 'planned'],
        diagnostic_weight: 0.60,
      },
      {
        id: 'perforation_resorption',
        text: 'Has the resorption perforated the root surface?',
        clinical_test: 'radiographic',
        priority: 'diagnosis_changing',
        expected_values: ['yes', 'no', 'uncertain'],
        diagnostic_weight: 0.80,
      },
    ],
  },

  // ─────────────────────────────────────────────────
  // 7. CARIES ASSESSMENT (ADA / ICCMS)
  // ─────────────────────────────────────────────────
  {
    id: 'caries_assessment',
    name: 'Caries Classification & Assessment',
    subspecialty: 'restorative',
    source: 'ADA/ICCMS',
    questions: [
      {
        id: 'caries_location',
        text: 'Which surfaces are affected by caries? (e.g., O, MO, DO, MOD, OB)',
        clinical_test: 'clinical_visual',
        priority: 'diagnosis_changing',
        expected_values: ['O', 'M', 'D', 'B', 'L', 'MO', 'DO', 'MOD', 'OB', 'OL', 'MB', 'DB', 'ML', 'DL', 'MOB', 'DOB', 'MOL', 'MODB', 'MODL', 'MODBL'],
        diagnostic_weight: 0.95,
      },
      {
        id: 'caries_depth',
        text: 'What is the depth of caries on radiograph/clinical examination?',
        clinical_test: 'radiographic_clinical',
        priority: 'diagnosis_changing',
        expected_values: ['superficial_enamel', 'into_dentin', 'deep_dentin', 'near_pulp', 'into_pulp'],
        diagnostic_weight: 0.90,
      },
      {
        id: 'caries_activity',
        text: 'Is the caries lesion active or arrested?',
        clinical_test: 'clinical_visual',
        priority: 'confidence_improving',
        expected_values: ['active', 'arrested', 'uncertain'],
        diagnostic_weight: 0.70,
      },
      {
        id: 'existing_restoration_status',
        text: 'What is the status of any existing restoration on this tooth?',
        clinical_test: 'clinical_visual',
        priority: 'diagnosis_changing',
        expected_values: ['none', 'intact', 'defective_margins', 'secondary_caries', 'fractured', 'worn', 'open_margins'],
        diagnostic_weight: 0.85,
      },
      {
        id: 'remaining_tooth_structure',
        text: 'How many walls of tooth structure remain? (after caries removal)',
        clinical_test: 'clinical_assessment',
        priority: 'diagnosis_changing',
        expected_values: ['4_walls', '3_walls', '2_walls', '1_wall', 'no_walls_stump'],
        diagnostic_weight: 0.90,
      },
      {
        id: 'cusp_involvement',
        text: 'Are any cusps undermined, cracked, or fractured?',
        clinical_test: 'clinical_visual',
        priority: 'diagnosis_changing',
        expected_values: ['no_cusp_involvement', 'one_cusp_undermined', 'two_cusps_undermined', 'cusp_fractured', 'multiple_cusps_compromised'],
        diagnostic_weight: 0.85,
      },
      {
        id: 'proximal_contact',
        text: 'Is the proximal contact affected or lost?',
        clinical_test: 'clinical_visual',
        priority: 'confidence_improving',
        expected_values: ['intact', 'compromised', 'lost', 'not_applicable'],
        diagnostic_weight: 0.60,
      },
      {
        id: 'pulp_proximity',
        text: 'What is the estimated distance from the caries to the pulp?',
        clinical_test: 'radiographic',
        priority: 'diagnosis_changing',
        expected_values: ['more_than_2mm', '1_to_2mm', 'less_than_1mm', 'pulp_exposed', 'uncertain'],
        diagnostic_weight: 0.80,
      },
    ],
  },

  // ─────────────────────────────────────────────────
  // 8. RESTORATION PLANNING (ADA)
  // ─────────────────────────────────────────────────
  {
    id: 'restoration_planning',
    name: 'Restoration Type & Material Planning',
    subspecialty: 'restorative',
    source: 'ADA',
    questions: [
      {
        id: 'restoration_type_indicated',
        text: 'Based on remaining structure and extent, what restoration type is indicated?',
        clinical_test: 'clinical_assessment',
        priority: 'diagnosis_changing',
        expected_values: ['direct_composite', 'direct_amalgam', 'direct_gic', 'indirect_inlay', 'indirect_onlay', 'indirect_overlay', 'indirect_crown', 'endocrown', 'post_and_core', 'veneer'],
        diagnostic_weight: 0.90,
      },
      {
        id: 'material_preference',
        text: 'What material is most appropriate for this restoration?',
        clinical_test: 'clinical_assessment',
        priority: 'confidence_improving',
        expected_values: ['composite', 'amalgam', 'glass_ionomer', 'ceramic', 'zirconia', 'emax', 'pfm', 'gold', 'stainless_steel'],
        diagnostic_weight: 0.65,
      },
      {
        id: 'occlusal_load',
        text: 'What is the expected occlusal load on this tooth?',
        clinical_test: 'clinical_assessment',
        priority: 'confidence_improving',
        expected_values: ['light', 'moderate', 'heavy', 'bruxer', 'clencher'],
        diagnostic_weight: 0.70,
      },
      {
        id: 'isolation_feasibility',
        text: 'Is rubber dam or adequate isolation achievable?',
        clinical_test: 'clinical_assessment',
        priority: 'confidence_improving',
        expected_values: ['rubber_dam_possible', 'partial_isolation', 'difficult_isolation', 'not_feasible'],
        diagnostic_weight: 0.60,
      },
      {
        id: 'esthetic_zone',
        text: 'Is this tooth in an esthetic zone?',
        clinical_test: 'clinical_assessment',
        priority: 'context_enriching',
        expected_values: ['anterior_high_esthetic', 'premolar_moderate', 'posterior_low_esthetic'],
        diagnostic_weight: 0.40,
      },
      {
        id: 'opposing_dentition',
        text: 'What is the opposing dentition?',
        clinical_test: 'clinical_assessment',
        priority: 'context_enriching',
        expected_values: ['natural_tooth', 'crown', 'implant', 'partial_denture', 'complete_denture', 'edentulous'],
        diagnostic_weight: 0.45,
      },
    ],
  },

  // ─────────────────────────────────────────────────
  // 9. PERIODONTAL ASSESSMENT (AAP/EFP 2017)
  // ─────────────────────────────────────────────────
  {
    id: 'periodontal_assessment',
    name: 'Periodontal Status Assessment',
    subspecialty: 'periodontal',
    source: 'AAP/EFP 2017',
    questions: [
      {
        id: 'probing_depths_perio',
        text: 'What are the probing depths around this tooth? (deepest reading)',
        clinical_test: 'periodontal_probing',
        priority: 'diagnosis_changing',
        expected_values: ['1_3mm_normal', '4_5mm_moderate', '6_8mm_deep', 'greater_than_8mm', 'not_performed'],
        diagnostic_weight: 0.95,
      },
      {
        id: 'clinical_attachment_loss',
        text: 'What is the clinical attachment loss (CAL)?',
        clinical_test: 'periodontal_probing',
        priority: 'diagnosis_changing',
        expected_values: ['1_2mm', '3_4mm', '5mm_or_more', 'not_measured'],
        diagnostic_weight: 0.90,
      },
      {
        id: 'bone_loss_pattern',
        text: 'What is the pattern of bone loss on radiograph?',
        clinical_test: 'radiographic',
        priority: 'diagnosis_changing',
        expected_values: ['no_bone_loss', 'horizontal_generalized', 'vertical_angular', 'combined', 'furcation_involvement'],
        diagnostic_weight: 0.90,
      },
      {
        id: 'bone_loss_percentage',
        text: 'What percentage of root length shows bone loss?',
        clinical_test: 'radiographic',
        priority: 'diagnosis_changing',
        expected_values: ['less_than_15_percent', '15_to_33_percent', '33_to_50_percent', 'greater_than_50_percent'],
        diagnostic_weight: 0.85,
      },
      {
        id: 'bleeding_on_probing',
        text: 'Is there bleeding on probing?',
        clinical_test: 'periodontal_probing',
        priority: 'confidence_improving',
        expected_values: ['no_bleeding', 'localized', 'generalized', 'profuse'],
        diagnostic_weight: 0.70,
      },
      {
        id: 'tooth_mobility_perio',
        text: 'What is the degree of tooth mobility?',
        clinical_test: 'clinical_assessment',
        priority: 'diagnosis_changing',
        expected_values: ['grade_0_none', 'grade_1_slight', 'grade_2_moderate', 'grade_3_severe'],
        diagnostic_weight: 0.80,
      },
      {
        id: 'furcation_involvement',
        text: 'Is there furcation involvement? (for molars)',
        clinical_test: 'clinical_assessment',
        priority: 'diagnosis_changing',
        expected_values: ['not_applicable', 'no_involvement', 'grade_1', 'grade_2', 'grade_3_through_and_through'],
        diagnostic_weight: 0.85,
      },
      {
        id: 'perio_risk_factors',
        text: 'Are there systemic risk factors for periodontal disease?',
        clinical_test: 'history',
        priority: 'confidence_improving',
        expected_values: ['none', 'diabetes', 'smoking', 'immunocompromised', 'genetic_predisposition', 'multiple_factors'],
        diagnostic_weight: 0.60,
      },
    ],
  },

  // ─────────────────────────────────────────────────
  // 10. PROSTHODONTIC ASSESSMENT (ADA)
  // ─────────────────────────────────────────────────
  {
    id: 'prosthodontic_assessment',
    name: 'Prosthodontic Restorability Assessment',
    subspecialty: 'prosthodontic',
    source: 'ADA',
    questions: [
      {
        id: 'restorability',
        text: 'Is the tooth restorable with a definitive restoration?',
        clinical_test: 'clinical_assessment',
        priority: 'diagnosis_changing',
        expected_values: ['restorable_simple', 'restorable_complex', 'questionable', 'non_restorable'],
        diagnostic_weight: 0.95,
      },
      {
        id: 'ferrule_height',
        text: 'What is the ferrule height available? (minimum 1.5-2mm needed)',
        clinical_test: 'clinical_assessment',
        priority: 'diagnosis_changing',
        expected_values: ['adequate_2mm_plus', 'marginal_1_to_2mm', 'insufficient_less_than_1mm', 'no_ferrule', 'not_applicable'],
        diagnostic_weight: 0.90,
      },
      {
        id: 'crown_root_ratio',
        text: 'What is the crown-to-root ratio?',
        clinical_test: 'radiographic',
        priority: 'confidence_improving',
        expected_values: ['favorable_1to2_or_better', 'acceptable_1to1', 'unfavorable_less_than_1to1'],
        diagnostic_weight: 0.75,
      },
      {
        id: 'post_core_needed',
        text: 'Is a post and core indicated?',
        clinical_test: 'clinical_assessment',
        priority: 'diagnosis_changing',
        expected_values: ['not_needed', 'fiber_post', 'cast_post', 'prefabricated_metal_post', 'uncertain'],
        diagnostic_weight: 0.80,
      },
      {
        id: 'prosth_type_indicated',
        text: 'What type of prosthetic restoration is indicated?',
        clinical_test: 'clinical_assessment',
        priority: 'diagnosis_changing',
        expected_values: ['single_crown', 'bridge_abutment', 'implant_crown', 'endocrown', 'overlay', 'extraction_and_implant', 'extraction_and_bridge'],
        diagnostic_weight: 0.85,
      },
      {
        id: 'occlusal_scheme',
        text: 'What is the occlusal scheme/relationship?',
        clinical_test: 'clinical_assessment',
        priority: 'context_enriching',
        expected_values: ['class_I_normal', 'class_II', 'class_III', 'crossbite', 'open_bite', 'deep_bite'],
        diagnostic_weight: 0.50,
      },
    ],
  },

  // ─────────────────────────────────────────────────
  // 11. SURGICAL ASSESSMENT
  // ─────────────────────────────────────────────────
  {
    id: 'surgical_assessment',
    name: 'Surgical Indication Assessment',
    subspecialty: 'surgical',
    source: 'AAE/ADA',
    questions: [
      {
        id: 'extraction_indicated',
        text: 'Is extraction indicated for this tooth?',
        clinical_test: 'clinical_assessment',
        priority: 'diagnosis_changing',
        expected_values: ['not_indicated', 'elective', 'recommended', 'urgent', 'emergency'],
        diagnostic_weight: 0.95,
      },
      {
        id: 'surgical_endo_indicated',
        text: 'Is surgical endodontics (apicoectomy) indicated?',
        clinical_test: 'clinical_assessment',
        priority: 'diagnosis_changing',
        expected_values: ['not_indicated', 'apicoectomy', 'hemisection', 'root_amputation', 'intentional_replantation'],
        diagnostic_weight: 0.90,
      },
      {
        id: 'surgical_access',
        text: 'Is surgical access feasible? (proximity to vital structures)',
        clinical_test: 'radiographic',
        priority: 'confidence_improving',
        expected_values: ['straightforward', 'moderate_complexity', 'difficult_access', 'contraindicated_anatomy'],
        diagnostic_weight: 0.75,
      },
      {
        id: 'medical_clearance',
        text: 'Does the patient require medical clearance for surgery?',
        clinical_test: 'history',
        priority: 'confidence_improving',
        expected_values: ['no_clearance_needed', 'anticoagulant_management', 'bisphosphonate_risk', 'cardiac_clearance', 'multiple_concerns'],
        diagnostic_weight: 0.70,
      },
      {
        id: 'replacement_plan',
        text: 'If extraction, what is the replacement plan?',
        clinical_test: 'clinical_assessment',
        priority: 'context_enriching',
        expected_values: ['implant', 'bridge', 'partial_denture', 'no_replacement', 'to_be_determined'],
        diagnostic_weight: 0.55,
      },
    ],
  },
]

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get all questionnaire templates
 */
export function getAllQuestionnaires(): QuestionnaireTemplate[] {
  return QUESTIONNAIRE_TEMPLATES
}

/**
 * Get questionnaires relevant to a specific subspecialty
 */
export function getQuestionnairesBySubspecialty(subspecialty: string): QuestionnaireTemplate[] {
  return QUESTIONNAIRE_TEMPLATES.filter((q) => q.subspecialty === subspecialty)
}

/**
 * Get only diagnosis-changing questions from a questionnaire
 */
export function getDiagnosisChangingQuestions(
  questionnaire: QuestionnaireTemplate
): QuestionnaireQuestion[] {
  return questionnaire.questions.filter((q) => q.priority === 'diagnosis_changing')
}

/**
 * Get total diagnostic weight coverage for a set of answered question IDs
 */
export function calculateCoverage(
  questionnaire: QuestionnaireTemplate,
  answeredIds: Set<string>
): number {
  let totalWeight = 0
  let answeredWeight = 0
  for (const q of questionnaire.questions) {
    totalWeight += q.diagnostic_weight
    if (answeredIds.has(q.id)) {
      answeredWeight += q.diagnostic_weight
    }
  }
  return totalWeight > 0 ? answeredWeight / totalWeight : 0
}

/**
 * Compact string representation of all templates for use in LLM prompts.
 * Keeps token usage low while giving the LLM full context.
 */
export function questionnairesToPromptContext(): string {
  return QUESTIONNAIRE_TEMPLATES.map((q) => {
    const qLines = q.questions.map(
      (question) =>
        `  - [${question.id}] (${question.priority}, w=${question.diagnostic_weight}) "${question.text}" → ${question.expected_values.join(' | ')}`
    )
    return `### ${q.name} (${q.source}) — subspecialty: ${q.subspecialty}\n${qLines.join('\n')}`
  }).join('\n\n')
}
