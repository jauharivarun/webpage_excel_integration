/** Early-stage applicant (pre-interview): no pipeline status, resume, or offer fields. */
export interface Candidate {
  id: string;
  name: string;
  email: string;
  contact: string;
  linkedin: string;
  experience: number;
  skills: string[];
  currentRole: string;
  currentCompany: string;
}

export const initialCandidates: Candidate[] = [
  {
    id: "c1",
    name: "Aarav Sharma",
    email: "aarav.sharma@example.com",
    contact: "+91 98765 43210",
    linkedin: "https://linkedin.com/in/aaravsharma",
    experience: 6,
    skills: ["React", "TypeScript", "Node.js", "GraphQL"],
    currentRole: "Senior Frontend Engineer",
    currentCompany: "Flipside Labs",
  },
  {
    id: "c2",
    name: "Priya Iyer",
    email: "priya.iyer@example.com",
    contact: "+91 99887 11223",
    linkedin: "https://linkedin.com/in/priyaiyer",
    experience: 4,
    skills: ["Python", "Django", "PostgreSQL", "AWS"],
    currentRole: "Backend Engineer",
    currentCompany: "Quanta Cloud",
  },
  {
    id: "c3",
    name: "Daniel Okafor",
    email: "daniel.okafor@example.com",
    contact: "+1 415 555 0193",
    linkedin: "https://linkedin.com/in/danielokafor",
    experience: 9,
    skills: ["Go", "Kubernetes", "Terraform", "GCP"],
    currentRole: "Staff SRE",
    currentCompany: "Northwind",
  },
  {
    id: "c4",
    name: "Mei Tanaka",
    email: "mei.tanaka@example.com",
    contact: "+81 80 1234 5678",
    linkedin: "https://linkedin.com/in/meitanaka",
    experience: 3,
    skills: ["Figma", "UX Research", "Design Systems"],
    currentRole: "Product Designer",
    currentCompany: "Yume Studio",
  },
  {
    id: "c5",
    name: "Lucas Müller",
    email: "lucas.mueller@example.com",
    contact: "+49 151 2233 4455",
    linkedin: "https://linkedin.com/in/lucasmueller",
    experience: 7,
    skills: ["Java", "Spring", "Kafka", "Microservices"],
    currentRole: "Senior Backend Engineer",
    currentCompany: "Helix Bank",
  },
  {
    id: "c6",
    name: "Sofia Rossi",
    email: "sofia.rossi@example.com",
    contact: "+39 333 444 5566",
    linkedin: "https://linkedin.com/in/sofiarossi",
    experience: 5,
    skills: ["Data Science", "Python", "PyTorch", "LLMs"],
    currentRole: "ML Engineer",
    currentCompany: "Aria AI",
  },
  {
    id: "c7",
    name: "Noah Williams",
    email: "noah.williams@example.com",
    contact: "+44 7700 900456",
    linkedin: "https://linkedin.com/in/noahwilliams",
    experience: 2,
    skills: ["React", "Tailwind", "Next.js"],
    currentRole: "Frontend Developer",
    currentCompany: "Brightform",
  },
  {
    id: "c8",
    name: "Fatima Al-Sayed",
    email: "fatima.alsayed@example.com",
    contact: "+971 50 123 7788",
    linkedin: "https://linkedin.com/in/fatimaalsayed",
    experience: 8,
    skills: ["Product Management", "Roadmapping", "Analytics"],
    currentRole: "Senior PM",
    currentCompany: "Caravan Logistics",
  },
];
