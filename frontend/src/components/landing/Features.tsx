import { motion } from "framer-motion";
import {
  BarChart3,
  Bell,
  Building2,
  DollarSign,
  FileText,
  Users,
  Wrench,
} from "lucide-react";

const features = [
  {
    icon: Building2,
    title: "Property & Unit Management",
    desc: "Organize all your properties, units, and amenities in one structured dashboard.",
  },
  {
    icon: Users,
    title: "Tenant Management",
    desc: "Add tenants, assign units, store contacts, and track lease timelines effortlessly.",
  },
  {
    icon: DollarSign,
    title: "Rent & Arrears Tracking",
    desc: "Monitor payments in real time. Instantly see who's paid, who's late, and outstanding balances.",
  },
  {
    icon: Bell,
    title: "Automated Reminders",
    desc: "Set up email and SMS reminders for rent due dates, lease renewals, and overdue payments.",
  },
  {
    icon: Wrench,
    title: "Maintenance Requests",
    desc: "Tenants submit requests. You assign, track, and resolve — all within TenantOS.",
  },
  {
    icon: BarChart3,
    title: "Revenue & Occupancy Analytics",
    desc: "Visual dashboards showing revenue trends, occupancy rates, and portfolio health.",
  },
  {
    icon: FileText,
    title: "Document Storage",
    desc: "Securely store leases, receipts, inspection reports, and tenant agreements in the cloud.",
  },
];

const Features = () => {
  return (
    <section id="features" className="py-24 lg:py-32">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto mb-16 max-w-2xl text-center"
        >
          <span className="text-sm font-medium uppercase tracking-widest text-primary">Features</span>
          <h2 className="mt-3 font-heading text-3xl font-bold sm:text-4xl">
            Everything You Need to Run Your Rentals
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            From tenant onboarding to financial reporting, TenantOS covers every aspect of property
            management.
          </p>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="glass-card group rounded-xl p-6 transition-all duration-300 hover:border-primary/30"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                <f.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 font-heading text-lg font-semibold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
