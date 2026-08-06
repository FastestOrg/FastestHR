// Types for the Global Employee Verification system

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
  duration: string;
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
  aadhaar: string | null;
  pan: string | null;
  driving_license: string | null;
  passport: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
  profile_picture: string | null;
  verified: boolean;
  verification_link: string | null;
  verification_date: string | null;
  verified_by: string | null;
  public: boolean;
  feedbacks_by_employer: EmployerFeedback[];
  skills: string[];
  work_experience: WorkExperience[];
  rating: number;
  linkedin_url: string | null;
  github_url: string | null;
  twitter_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  added_by_user_id: string | null;
  added_by_company_id: string | null;
}

// Form types
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

export interface EmployerFeedbackForm {
  employer_name: string;
  company_name: string;
  feedback: string;
  rating: number;
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
