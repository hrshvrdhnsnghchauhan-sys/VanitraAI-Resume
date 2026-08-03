import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Brain,
  Check,
  FileSearch,
  FileText,
  Gauge,
  GraduationCap,
  LineChart,
  Quote,
  Sparkles,
  Star,
  Target,
  Users,
  Wand2,
  Building2,
  ShieldCheck,
} from "lucide-react";
import { SiteNavbar } from "@/components/site/site-navbar";
import { SiteFooter } from "@/components/site/site-footer";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import heroImg from "@/assets/hero-dashboard.jpg";

const SITE_URL = "https://job-match-masters-main.vercel.app";

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Vanitra AI Resume",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  description:
    "AI hiring platform for candidates and companies. Build ATS-friendly resumes, analyze scores, match job descriptions, close skill gaps, and screen candidates automatically.",
  offers: [
    {
      "@type": "Offer",
      name: "Starter",
      price: "499",
      priceCurrency: "INR",
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "999",
      priceCurrency: "INR",
    },
    {
      "@type": "Offer",
      name: "Company",
      price: "2499",
      priceCurrency: "INR",
    },
  ],
};

export const Route = createFileRoute("/")({
  head: () => ({
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(structuredData),
      },
    ],
  }),
  component: Landing,
});

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

function Section({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`mx-auto max-w-6xl px-4 ${className}`}>
      {children}
    </section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-accent/40 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent-foreground">
      <Sparkles className="h-3.5 w-3.5" /> {children}
    </span>
  );
}

import {
  candidateFeatures,
  companyFeatures,
  faqs,
  pricing,
  steps,
  testimonials,
} from "@/constants/landing";

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <SiteNavbar />

      {/* Hero */}
      <div className="relative overflow-hidden bg-hero-glow pt-32 pb-20">
        <Section className="text-center">
          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center"
          >
            <Eyebrow>AI-Powered Hiring Platform</Eyebrow>
            <h1 className="mt-6 max-w-4xl text-balance text-4xl font-extrabold leading-[1.05] sm:text-6xl">
              Build Smarter. Analyze Better.{" "}
              <span className="text-gradient">Get Hired Faster.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
              One AI platform for candidates and companies — build ATS-friendly resumes, analyze and
              optimize them, match jobs, close skill gaps, and screen candidates automatically.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="xl" variant="hero" asChild>
                <Link to="/signup">
                  Build my resume <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button size="xl" variant="glass" asChild>
                <a href="#companies">
                  <Building2 className="h-5 w-5" /> For companies
                </a>
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-success" /> No credit card required
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-success" /> ATS-optimized templates
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-success" /> Instant AI feedback
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-14"
          >
            <div className="glass mx-auto max-w-5xl rounded-2xl p-2 shadow-elegant">
              <img
                src={heroImg}
                width={1408}
                height={1008}
                alt="AI resume analyzer dashboard showing ATS score and analytics"
                fetchPriority="high"
                decoding="async"
                className="rounded-xl"
              />
            </div>
          </motion.div>
        </Section>
      </div>

      {/* Stats */}
      <Section className="py-8">
        <div className="grid grid-cols-2 gap-4 rounded-2xl border border-border bg-card/40 p-6 sm:grid-cols-4">
          {[
            { value: "120K+", label: "Resumes analyzed" },
            { value: "92%", label: "Avg. ATS uplift" },
            { value: "3.4x", label: "More interviews" },
            { value: "1,200+", label: "Hiring teams" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-bold sm:text-3xl text-gradient">{s.value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Features */}
      <Section id="features" className="py-20">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>For Candidates</Eyebrow>
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl">Everything you need to get hired</h2>
          <p className="mt-4 text-muted-foreground">
            A complete AI toolkit that takes you from a blank page to a job-winning resume.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {candidateFeatures.map((f, i) => (
            <motion.div
              key={f.title}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              variants={fadeUp}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="group rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-1 hover:border-primary/40"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* How it works */}
      <Section id="how" className="py-20">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl">From resume to offer in 4 steps</h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-4">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="relative rounded-2xl border border-border bg-card p-6 shadow-card"
            >
              <span className="absolute right-5 top-5 text-4xl font-bold text-muted/60">
                {i + 1}
              </span>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Company section */}
      <Section id="companies" className="py-20">
        <div className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-accent/50 to-card p-8 sm:p-12">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <Eyebrow>For Companies</Eyebrow>
              <h2 className="mt-4 text-3xl font-bold sm:text-4xl">Hire the best, faster</h2>
              <p className="mt-4 text-muted-foreground">
                Post a job, let AI screen every applicant, and get a ranked shortlist with interview
                questions and hiring recommendations — all in one dashboard.
              </p>
              <div className="mt-8">
                <Button size="lg" variant="hero" asChild>
                  <Link to="/signup">
                    Start hiring <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {companyFeatures.map((f) => (
                <div key={f.title} className="rounded-2xl border border-border bg-card/70 p-5">
                  <f.icon className="h-6 w-6 text-primary" />
                  <h3 className="mt-3 font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Testimonials */}
      <Section className="py-20">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Loved by job seekers & recruiters</Eyebrow>
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl">Results people talk about</h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {testimonials.map((t) => (
            <div key={t.name} className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <Quote className="h-8 w-8 text-primary/30" />
              <p className="mt-3 text-sm leading-relaxed">{t.quote}</p>
              <div className="mt-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary text-sm font-bold text-primary-foreground">
                  {t.name[0]}
                </div>
                <div>
                  <div className="text-sm font-semibold">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Pricing */}
      <Section id="pricing" className="py-20">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Pricing</Eyebrow>
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl">Simple, transparent pricing</h2>
          <p className="mt-4 text-muted-foreground">Start free. Upgrade when you're ready.</p>
        </div>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {pricing.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-2xl border p-7 shadow-card ${
                p.highlighted
                  ? "border-primary bg-card ring-2 ring-primary/30"
                  : "border-border bg-card"
              }`}
            >
              {p.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
              <div className="mt-4 flex items-end gap-1">
                <span className="text-4xl font-bold">{p.price}</span>
                <span className="mb-1 text-muted-foreground">{p.period}</span>
              </div>
              <ul className="mt-6 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-success" /> {f}
                  </li>
                ))}
              </ul>
              <Button className="mt-7 w-full" variant={p.highlighted ? "hero" : "outline"} asChild>
                <Link to="/signup">{p.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </Section>

      {/* FAQ */}
      <Section id="faq" className="py-20">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="mt-4 text-3xl font-bold sm:text-4xl">Frequently asked questions</h2>
          </div>
          <Accordion type="single" collapsible className="mt-10">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left text-base font-semibold">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Section>

      {/* CTA */}
      <Section className="pb-24">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-primary px-6 py-16 text-center shadow-elegant">
          <div className="relative z-10 mx-auto max-w-2xl">
            <LineChart className="mx-auto h-10 w-10 text-primary-foreground/80" />
            <h2 className="mt-4 text-3xl font-bold text-primary-foreground sm:text-4xl">
              Ready to get hired faster?
            </h2>
            <p className="mt-3 text-primary-foreground/85">
              Join thousands building smarter resumes with AI. Start free today.
            </p>
            <div className="mt-8">
              <Button size="xl" variant="glass" asChild>
                <Link to="/signup">
                  Get started free <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </Section>

      <SiteFooter />
    </div>
  );
}
