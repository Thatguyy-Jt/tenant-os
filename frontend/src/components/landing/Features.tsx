import { motion } from "framer-motion";
import {
  BarChart3,
  Bell,
  Building2,
  CreditCard,
  FileText,
  Users,
  Wrench,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

const features = [
  {
    icon: Building2,
    label: "Properties",
    title: "Property & Unit Management",
    desc: "Organise every property, unit, and amenity in one structured dashboard. Add photos, track vacancy, and manage details without switching tools.",
    highlight: true,
  },
  {
    icon: Users,
    label: "Tenants",
    title: "Tenant Onboarding & Leases",
    desc: "Invite tenants via email link. They register, set a password, and their lease is created instantly — no paperwork, no back and forth.",
    highlight: false,
  },
  {
    icon: CreditCard,
    label: "Payments",
    title: "Rent Collection & Arrears",
    desc: "Accept online payments via Paystack or record manual entries. Real-time balance calculations show exactly who owes what and for how long.",
    highlight: false,
  },
  {
    icon: Bell,
    label: "Reminders",
    title: "Automated Rent Reminders",
    desc: "Daily cron jobs email tenants with outstanding balances so you never have to chase manually. Lease-expiry alerts keep renewals on your radar.",
    highlight: false,
  },
  {
    icon: Wrench,
    label: "Maintenance",
    title: "Maintenance Request Tracking",
    desc: "Tenants submit requests with priority levels. Assign, update status, and keep both sides informed with instant in-app notifications.",
    highlight: false,
  },
  {
    icon: BarChart3,
    label: "Analytics",
    title: "Revenue & Occupancy Analytics",
    desc: "Live charts covering 6-month revenue trends, occupancy rates, lease health, and rent collection — so you always know your portfolio's performance.",
    highlight: false,
  },
  {
    icon: FileText,
    label: "Documents",
    title: "Secure Document Storage",
    desc: "Upload and manage leases, receipts, and inspection reports. Tenants can access their documents from their portal at any time.",
    highlight: false,
  },
  {
    icon: ShieldCheck,
    label: "Security",
    title: "Role-Based Access Control",
    desc: "Create agent accounts scoped to specific properties. Landlords retain full control while agents manage their assigned portfolio.",
    highlight: false,
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

const Features = () => {
  return (
    <section id="features" className="relative overflow-hidden py-24 lg:py-32">
      {/* Subtle background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[500px] w-[900px] -translate-x-1/2 rounded-full opacity-10 blur-3xl"
        style={{ background: "var(--gradient-accent)" }}
      />

      <div className="container">
        {/* ── Section header ── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-20 max-w-2xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Platform Features
          </span>
          <h2 className="mt-5 font-heading text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">
            Everything You Need to{" "}
            <span className="text-gradient">Run Your Rentals</span>
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            From tenant onboarding to financial reporting, TenantOS covers every aspect of
            property management — in one platform, with no spreadsheets required.
          </p>
        </motion.div>

        {/* ── Feature grid ── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {features.map((f, i) => {
            const Icon = f.icon;
            const isLarge = i === 0 || i === 5; // first and revenue card span 2 cols on lg

            return (
              <motion.div
                key={f.title}
                variants={itemVariants}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/60 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 ${
                  isLarge ? "lg:col-span-2" : ""
                }`}
              >
                {/* Hover gradient overlay */}
                <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ background: "radial-gradient(ellipse at top left, hsl(var(--primary)/0.06) 0%, transparent 70%)" }}
                />

                {/* Icon + label row */}
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12 ring-1 ring-primary/20 transition-all duration-300 group-hover:bg-primary/20 group-hover:ring-primary/40">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {f.label}
                  </span>
                </div>

                {/* Text */}
                <h3 className="mb-2.5 font-heading text-base font-bold leading-snug text-foreground">
                  {f.title}
                </h3>
                <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>

                {/* Arrow — appears on hover */}
                <div className="mt-5 flex items-center gap-1.5 text-xs font-medium text-primary opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0.5">
                  Learn more <ArrowRight size={12} />
                </div>

                {/* Bottom accent line */}
                <div className="absolute bottom-0 left-0 h-0.5 w-0 rounded-full bg-gradient-to-r from-primary to-transparent transition-all duration-500 group-hover:w-full" />
              </motion.div>
            );
          })}
        </motion.div>

        {/* ── Bottom CTA strip ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mt-16 flex flex-col items-center gap-4 rounded-2xl border border-border/50 bg-card/40 px-8 py-8 text-center backdrop-blur-sm sm:flex-row sm:justify-between sm:text-left"
        >
          <div>
            <p className="font-heading text-lg font-bold text-foreground">
              Ready to simplify your property management?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Join landlords who have replaced spreadsheets and manual tracking with TenantOS.
            </p>
          </div>
          <a
            href="/register"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:brightness-110 hover:shadow-primary/40"
          >
            Get Started Free <ArrowRight size={15} />
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default Features;
