import { motion } from "framer-motion";

const steps = [
  {
    num: "01",
    title: "Sign Up & Add Properties",
    desc: "Create your account in seconds. Add your properties, units, and key details.",
  },
  {
    num: "02",
    title: "Onboard Your Tenants",
    desc: "Invite tenants, assign them to units, upload leases, and set rent schedules.",
  },
  {
    num: "03",
    title: "Automate & Monitor",
    desc: "Enable automated reminders, track payments, handle requests, and view analytics — all on autopilot.",
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="bg-secondary/30 py-24 lg:py-32">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto mb-16 max-w-2xl text-center"
        >
          <span className="text-sm font-medium uppercase tracking-widest text-primary">
            How It Works
          </span>
          <h2 className="mt-3 font-heading text-3xl font-bold sm:text-4xl">Up and Running in Minutes</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            No complex onboarding. No steep learning curve. Just results.
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="text-center"
            >
              <div className="mb-4 font-heading text-5xl font-extrabold text-gradient">{s.num}</div>
              <h3 className="mb-3 font-heading text-xl font-semibold">{s.title}</h3>
              <p className="leading-relaxed text-muted-foreground">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
