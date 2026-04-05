import { motion } from "framer-motion";

const stats = [
  { value: "2,000+", label: "Property Managers" },
  { value: "15,000+", label: "Units Managed" },
  { value: "98%", label: "Rent Collection Rate" },
  { value: "4.9/5", label: "User Satisfaction" },
];

const Stats = () => {
  return (
    <section className="border-y border-border/30 py-16">
      <div className="container">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <div className="mb-1 font-heading text-3xl font-extrabold text-gradient sm:text-4xl">
                {s.value}
              </div>
              <div className="text-sm text-muted-foreground">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;
