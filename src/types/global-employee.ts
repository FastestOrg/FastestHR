// Types for the Global Employee Verification & Credential Trust System

export interface CompetencyScores {
  technical_execution: number;
  collaboration_teamwork: number;
  problem_solving: number;
  integrity_reliability: number;
}

export interface StructuredReference {
  id: string;
  reviewer_name: string;
  reviewer_email: string;
  reviewer_role: string;
  company_name: string;
  company_domain: string;
  relationship: 'manager' | 'peer' | 'hr_officer' | 'client' | 'skip_level';
  employment_start?: string;
  employment_end?: string;
  official_designation?: string;
  rehire_eligibility?: 'eligible' | 'ineligible' | 'policy_neutral';
  competencies: CompetencyScores;
  strengths: string;
  growth_areas?: string;
  date: string;
  added_by_id: string;
  verified_domain?: boolean;
}

export interface VerifiedTenureRecord {
  id: string;
  company_name: string;
  company_domain?: string;
  official_designation: string;
  department?: string;
  employment_type: 'full_time' | 'part_time' | 'contract' | 'internship';
  start_date: string;
  end_date?: string | null;
  is_current: boolean;
  exit_status?: 'resigned' | 'contract_ended' | 'layoff' | 'terminated';
  rehire_eligibility: 'eligible' | 'ineligible' | 'policy_neutral';
  verified_by_email?: string;
  verification_source: 'hr_attestation' | 'work_email_otp' | 'hris_sync' | 'document_proof';
  verified_at?: string;
}

export interface ConsentRequest {
  id: string;
  requester_company_name: string;
  requester_email: string;
  purpose: string;
  status: 'pending' | 'granted' | 'denied' | 'expired';
  created_at: string;
  expires_at: string;
  requester_id?: string;
}

export interface DisputeTicket {
  id: string;
  complainant_name: string;
  complainant_email: string;
  dispute_type: 'inaccurate_dates' | 'incorrect_title' | 'defamatory_feedback' | 'identity_error' | 'other';
  claim_details: string;
  evidence_url?: string;
  status: 'under_investigation' | 'resolved_corrected' | 'dismissed';
  created_at: string;
  sla_deadline: string;
}

export interface EmployerFeedback {
  employer_name: string;
  company_name: string;
  feedback_by_employer: string;
  rating: number;
  date: string;
  added_by_id: string;
}

export interface WorkExperience {
  company_name: string;
  designation: string;
  duration?: string;
  from_date: string;
  to_date: string;
  description: string;
}

export interface GlobalEmployee {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  email: string | null;
  phone: string | null;
  
  // Masked IDs (compliant with DPDP / UIDAI & Privacy laws)
  aadhaar?: string | null;
  pan?: string | null;
  driving_license?: string | null;
  passport?: string | null;
  masked_aadhaar?: string | null;
  masked_pan?: string | null;
  masked_passport?: string | null;
  id_verification_status?: 'unverified' | 'verified_gov_id' | 'verified_liveness' | 'pending';

  // Address
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
  profile_picture: string | null;

  // Verification status
  verified: boolean;
  verification_link: string | null;
  verification_date: string | null;
  verified_by: string | null;
  public: boolean;

  // Legacy feedback & modern structured references
  feedbacks_by_employer: EmployerFeedback[];
  structured_references?: StructuredReference[];
  competency_scores?: CompetencyScores;
  verified_tenure_records?: VerifiedTenureRecord[];

  // Trust & Consent
  consent_requests?: ConsentRequest[];
  disputes?: DisputeTicket[];

  // Skills & Experience
  skills: string[];
  work_experience: WorkExperience[];
  rating: number;

  // Social URLs
  linkedin_url: string | null;
  github_url: string | null;
  twitter_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;

  // Tracking
  added_by_user_id: string | null;
  added_by_company_id: string | null;
}

// Form & Submission Types
export interface AddGlobalEmployeeForm {
  name: string;
  email: string;
  phone: string;
  aadhaar: string;
  pan: string;
  driving_license: string;
  passport: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  profile_picture: string;
  public: boolean;
  skills: string[];
  linkedin_url: string;
  github_url: string;
  twitter_url: string;
  facebook_url: string;
  instagram_url: string;
}

export interface StructuredAttestationForm {
  reviewer_name: string;
  reviewer_email: string;
  reviewer_role: string;
  company_name: string;
  company_domain: string;
  relationship: 'manager' | 'peer' | 'hr_officer' | 'client' | 'skip_level';
  employment_start: string;
  employment_end: string;
  official_designation: string;
  rehire_eligibility: 'eligible' | 'ineligible' | 'policy_neutral';
  technical_execution: number;
  collaboration_teamwork: number;
  problem_solving: number;
  integrity_reliability: number;
  strengths: string;
  growth_areas: string;
  compliance_certified: boolean;
}

export interface SelfVerificationForm {
  aadhaar: string;
  pan: string;
  driving_license: string;
  passport: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  skills: string[];
  work_experience: WorkExperience[];
  linkedin_url: string;
  github_url: string;
  twitter_url: string;
  facebook_url: string;
  instagram_url: string;
  profile_picture: string;
}
