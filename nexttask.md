A new Feature Called "Global Employee Verification". The HR/Admin can search for a employee or candidate globally and check his details by serching through his Name, Email, Phone, Aadhaar, Pan, Driving License, Passport (Any one Uniqueness) or he can generate a link for the employee/candidate and send it to him. By clicking that link the employee/candidate can fill his details and submit it to the portal. If submitted then the details should be verified (By An Verified User of our Portal) and update if the details are matched globally

-  If the details are found in the portal then the employee/candidate can be verified.
-  If the details are not found in the portal then the employee/candidate can be added to the portal with the verified details.


Note : All the verified employee / candidate details should be public and anyone can search for them and check their details. (Optional for the admin to make it public or private for a each employee/candidate)

Table in supabase named "Global_Employee" with columns : 
- id (UUID)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
- name (TEXT)
- email (TEXT)
- phone (TEXT)
- aadhaar (TEXT)
- pan (TEXT)
- driving_license (TEXT)
- passport (TEXT)
- address (TEXT)
- city (TEXT)
- state (TEXT)
- country (TEXT)
- pincode (TEXT)
- profile_picture (TEXT)
- verified (BOOLEAN)
- verification_link (TEXT)
- verification_date (TIMESTAMPTZ)
- verified_by (TEXT)
- public (BOOLEAN)
- feedbacks_by_employer (JSON) with values {employer_name: TEXT, company_name:Text, feedback_by_employer: TEXT, date: TIMESTAMPTZ, added_by_id : TEXT}
- skills (TEXT) array of strings
- work_experience (JSON) array of objects with values {company_name: TEXT, designation: TEXT, duration: TEXT, from_date: TEXT, to_date: TEXT, description: TEXT}
-rating (NUMBER)
-linkedin_URL (TEXT)
-github_URL (TEXT)
-twitter_URL (TEXT)
-facebook_URL (TEXT)
-instagram_URL (TEXT)

Host the details on unique pages: /employeebg/[id]

This will work as Global HR Friendly Portal just like glassdoor but for a employer to check employee reputation. the employer can only rate an employee if he is verified. Employee/Candidate can update few of the allowed details like Adhar, Pan, ids (Not his Ratings)

The Problem: Companies face last-minute offer dropouts, candidates "ghosting" recruiters before joining, or professionals using an offer merely to leverage a 30% salary hike elsewhere.The Solution: A centralized repository or review portal where employers share feedback regarding a candidate's integrity, commitment, professionalism, and notice-period behavior.