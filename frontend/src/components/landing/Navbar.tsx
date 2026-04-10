import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";

import logo from "@/assets/tenant-os-logo.png";
import { Button } from "@/components/ui/button";
import { ThemePicker } from "@/components/ThemePicker";

const Navbar = () => {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <a href="/" className="flex items-center gap-1.5">
          <img
            src={logo}
            alt="TenantOS logo"
            className="h-9 w-9 object-contain"
            width={512}
            height={512}
          />
          <span className="font-heading text-lg font-bold text-foreground">
            Tenant<span className="text-primary">OS</span>
          </span>
        </a>

        <div className="ml-8 hidden items-center gap-4 md:flex lg:gap-8">
          {["Features", "How It Works", "Testimonials", "Pricing"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <ThemePicker />
          <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
            <Link to="/login">Log In</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/register">Get Started Free</Link>
          </Button>
        </div>

        <button
          type="button"
          className="text-foreground md:hidden"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="Toggle menu"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-border/30 bg-background/95 p-4 backdrop-blur-xl md:hidden">
          {["Features", "How It Works", "Testimonials", "Pricing"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
              className="block py-2 text-sm text-muted-foreground"
              onClick={() => setOpen(false)}
            >
              {item}
            </a>
          ))}
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" size="sm" className="flex-1" asChild>
              <Link to="/login" onClick={() => setOpen(false)}>
                Log In
              </Link>
            </Button>
            <Button size="sm" className="flex-1" asChild>
              <Link to="/register" onClick={() => setOpen(false)}>
                Get Started
              </Link>
            </Button>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-border/30">
            <span className="text-xs text-muted-foreground">App theme</span>
            <ThemePicker />
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
