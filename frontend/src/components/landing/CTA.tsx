import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

const CTA = () => {
  return (
    <section id="pricing" className="scroll-mt-24 py-24 lg:py-32">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-2xl"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-primary/5" />
          <div className="relative rounded-2xl border border-primary/20 px-8 py-16 text-center sm:px-16 sm:py-20">
            <h2 className="mb-4 font-heading text-3xl font-bold sm:text-4xl lg:text-5xl">
              Ready to Simplify Your
              <br />
              <span className="text-gradient">Property Management?</span>
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-lg text-muted-foreground">
              Join thousands of landlords and property managers who&apos;ve streamlined their
              operations with TenantOS.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" className="gap-2 px-10 text-base" asChild>
                <Link to="/register">
                  Get Started Free <ArrowRight size={18} />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-border/50 px-10 text-base text-foreground hover:bg-secondary"
                asChild
              >
                <a href="mailto:hello@tenantos.com?subject=TenantOS%20demo">Schedule a Demo</a>
              </Button>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              No credit card required · Free 14-day trial · Cancel anytime
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTA;
