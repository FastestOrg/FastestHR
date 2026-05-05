export interface Author {
  slug: string;
  name: string;
  title: string;
  bio: string;
  avatar: string;
  linkedin?: string;
  twitter?: string;
  credentials?: string[];
  experienceYears: number;
}

export const AUTHORS: Author[] = [
  {
    slug: "fastesthr-ai-lab",
    name: "FastestHR AI Lab",
    title: "Neural Architecture Research Unit",
    bio: "The core research group at FastestHR focused on implementing large language models and predictive analytics for workforce optimization.",
    avatar: "/images/authors/ai-lab.png",
    linkedin: "https://linkedin.com/company/fastesthr",
    credentials: ["ISO 27001 Certified", "SOC2 Type II"],
    experienceYears: 8
  },
  {
    slug: "marcus-chen",
    name: "Marcus Chen",
    title: "Chief Technology Officer",
    bio: "Former Lead Architect at major cloud providers, Marcus specializes in high-velocity infrastructure and zero-trust security systems.",
    avatar: "/images/authors/marcus.png",
    linkedin: "https://linkedin.com/in/marcuschen-example",
    credentials: ["MSc Computer Science", "AWS Solutions Architect Professional"],
    experienceYears: 15
  },
  {
    slug: "sarah-jennings",
    name: "Sarah Jennings",
    title: "Chief People Officer",
    bio: "Sarah has led HR for three unicorn startups, focusing on data-driven culture and global scaling strategies.",
    avatar: "/images/authors/sarah.png",
    linkedin: "https://linkedin.com/in/sarahjennings-example",
    credentials: ["SHRM-SCP", "MBA from Stanford GSB"],
    experienceYears: 12
  },
  {
    slug: "security-operations",
    name: "Security Operations",
    title: "Enterprise Protection Unit",
    bio: "Our internal team dedicated to maintaining zero-trust protocols and securing personnel data at the kernel level.",
    avatar: "/images/authors/security.png",
    linkedin: "https://linkedin.com/company/fastesthr",
    credentials: ["CISSP", "CISM"],
    experienceYears: 10
  },
  {
    slug: "growth-strategy",
    name: "Growth Strategy",
    title: "Organizational Velocity Unit",
    bio: "Specializing in the intersection of human potential and organizational throughput, the Growth Strategy unit designs the frameworks for hyper-growth teams.",
    avatar: "/images/authors/growth.png",
    experienceYears: 12
  },
  {
    slug: "remote-operations",
    name: "Remote Operations",
    title: "Global Distributed Systems Unit",
    bio: "Experts in scaling culture and operations across time zones using asynchronous protocols and decentralized management.",
    avatar: "/images/authors/remote.png",
    experienceYears: 10
  },
  {
    slug: "data-science-unit",
    name: "Data Science Unit",
    title: "Predictive Analytics Research",
    bio: "Focused on leveraging machine learning to identify workforce patterns, flight risks, and engagement velocity.",
    avatar: "/images/authors/data-science.png",
    experienceYears: 15
  },
  {
    slug: "experience-engineering",
    name: "Experience Engineering",
    title: "Workforce Interaction Design",
    bio: "Engineering the perfect employee lifecycle, from automated onboarding to frictionless offboarding.",
    avatar: "/images/authors/experience.png",
    experienceYears: 9
  },
  {
    slug: "global-compliance-team",
    name: "Global Compliance Team",
    title: "International Legal Protocol Unit",
    bio: "Automating global labor laws and compliance across 100+ jurisdictions for the modern, borders-free enterprise.",
    avatar: "/images/authors/compliance.png",
    experienceYears: 20
  },
  {
    slug: "fastesthr-core-ai",
    name: "FastestHR Core AI",
    title: "System Intelligence Kernel",
    bio: "The foundational AI engine driving the FastestHR operating system, optimizing everything from skill mapping to conflict resolution.",
    avatar: "/images/authors/core-ai.png",
    experienceYears: 10
  },
  {
    slug: "financial-ops-unit",
    name: "Financial Ops Unit",
    title: "Capital Efficiency Unit",
    bio: "Focused on the financial engineering of human capital, integrating payroll with performance ROI.",
    avatar: "/images/authors/finance.png",
    experienceYears: 14
  },
  {
    slug: "international-ops",
    name: "International Ops",
    title: "Global Mobility Research",
    bio: "Automating the legal and logistical complexity of international hiring and relocation.",
    avatar: "/images/authors/international.png",
    experienceYears: 11
  },
  {
    slug: "experience-design",
    name: "Experience Design",
    title: "Human-Centric Interface Lab",
    bio: "Designing the most efficient and empathetic internal tools for the modern developer-led workforce.",
    avatar: "/images/authors/design.png",
    experienceYears: 8
  },
  {
    slug: "ethics-committee",
    name: "Ethics Committee",
    title: "Algorithmic Integrity Board",
    bio: "Auditing HR algorithms to ensure fairness, transparency, and the elimination of machine-scale bias.",
    avatar: "/images/authors/ethics.png",
    experienceYears: 15
  },
  {
    slug: "future-of-work-lab",
    name: "Future of Work Lab",
    title: "Organizational Evolution Unit",
    bio: "Researching and implementing next-gen work models like the 4-day week and sovereign employee identity.",
    avatar: "/images/authors/future.png",
    experienceYears: 13
  },
  {
    slug: "talent-ai-unit",
    name: "Talent AI Unit",
    title: "Neural Skill Research",
    bio: "Visualizing technical DNA and optimizing internal mobility through neural skill mapping.",
    avatar: "/images/authors/talent-ai.png",
    experienceYears: 9
  },
  {
    slug: "culture-engineering",
    name: "Culture Engineering",
    title: "Systemic Harmony Lab",
    bio: "Using sentiment analysis and automated mediation to build resilient, friction-free workplace cultures.",
    avatar: "/images/authors/culture.png",
    experienceYears: 10
  }
];
