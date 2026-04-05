import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import heroBg from "@/assets/hero-bg.jpg";
import { Button } from "@/components/ui/button";

const Hero = () => {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden">
      <img
        src={heroBg}
        alt="Modern apartment building"
        className="absolute inset-0 h-full w-full object-cover"
        width={1920}
        height={1080}
        fetchPriority="high"
      />
      <div className="absolute inset-0" style={{ background: "var(--hero-overlay)" }} />

      <div className="container relative z-10 pb-20 pt-24">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="max-w-3xl"
        >
          <h1 className="mb-6 font-heading text-4xl font-extrabold leading-[1.1] sm:text-5xl lg:text-6xl">
            Your Rental Business, <span className="text-gradient">One Platform.</span>
          </h1>

          <p className="mb-10 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            TenantOS is the all-in-one operating system for landlords and property managers. Track
            rent, manage tenants, handle maintenance — effortlessly.
          </p>

          <div className="flex flex-wrap gap-4">
            <Button size="lg" className="gap-2 px-8 text-base" asChild>
              <Link to="/register">
                Start Free Trial <ArrowRight size={18} />
              </Link>
            </Button>
          </div>

          <div className="mt-12 flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-secondary text-xs font-medium"
                >
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
            </div>
            <span>
              Trusted by <strong className="text-foreground">2,000+</strong> property managers
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
