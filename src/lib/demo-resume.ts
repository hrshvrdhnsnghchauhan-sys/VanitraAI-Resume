export interface DemoResumeData {
  title: string;
  summary: string;
  skills: string;
  experiences: Array<{
    id: number;
    role: string;
    company: string;
    detail: string;
  }>;
  education: Array<{
    id: number;
    school: string;
    degree: string;
    year: string;
  }>;
}

export const DEMO_RESUME: DemoResumeData = {
  title: "Senior Full Stack Software Engineer",
  summary:
    "Results-oriented Senior Software Engineer with 6+ years of experience designing scalable distributed systems and interactive frontend applications. Specialized in React, TypeScript, Node.js, and Cloud Infrastructure with a strong track record of mentoring teams and reducing system latency.",
  skills:
    "React, TypeScript, Node.js, Next.js, GraphQL, REST APIs, Python, Tailwind CSS, System Design, CI/CD, Docker, AWS, Agile",
  experiences: [
    {
      id: 1,
      role: "Senior Software Engineer",
      company: "Stripe",
      detail:
        "• Spearheaded the migration of core merchant billing dashboards to Next.js and TypeScript, improving page load speeds by 40%.\n• Architected microservices in Node.js and GraphQL handling over 10,000 requests/second with 99.99% reliability.\n• Mentored a team of 6 engineers and introduced automated end-to-end testing, reducing production regressions by 35%.",
    },
    {
      id: 2,
      role: "Full Stack Engineer",
      company: "Airbnb",
      detail:
        "• Built responsive search and booking components using React and Tailwind CSS, increasing user conversion rate by 18%.\n• Engineered backend caching pipelines in Redis and Node.js that decreased database query load by 45%.\n• Partnered with product managers and UX designers to ship accessibility improvements across mobile and web platforms.",
    },
  ],
  education: [
    {
      id: 101,
      school: "University of California, Berkeley",
      degree: "B.S. in Computer Science",
      year: "2015 – 2019",
    },
  ],
};

export function getDemoResumeText(): string {
  return `Title: ${DEMO_RESUME.title}\nSummary: ${DEMO_RESUME.summary}\nSkills: ${DEMO_RESUME.skills}\nExperience:\n${DEMO_RESUME.experiences.map((e) => `${e.role} at ${e.company}\n${e.detail}`).join("\n\n")}\nEducation:\n${DEMO_RESUME.education.map((ed) => `${ed.degree} — ${ed.school} (${ed.year})`).join("\n")}`;
}
