import { motion } from 'framer-motion';
import { ArrowRight, Package, Truck, Shield, Zap, Globe, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5 },
};

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 md:px-12 py-4 sticky top-0 z-50 bg-background/80 backdrop-blur-xl">
        <h1 className="text-lg font-bold tracking-tight text-foreground">YOBBANTÉ</h1>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/app')} className="text-muted-foreground">
            Sign In
          </Button>
          <Button size="sm" onClick={() => navigate('/app')} className="rounded-full px-5">
            Get Started
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 md:px-12 pt-20 pb-24 md:pt-32 md:pb-32 max-w-4xl mx-auto text-center">
        <motion.div {...fadeUp}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-xs font-medium text-muted-foreground mb-6">
            <Globe className="w-3.5 h-3.5" />
            3 warehouses worldwide
          </div>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
            Shop anywhere.<br />Ship everywhere.
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground mt-6 max-w-xl mx-auto leading-relaxed">
            Your personal warehouses in France, China, and the USA. Buy globally, we handle the rest.
          </p>
          <div className="flex items-center justify-center gap-4 mt-10">
            <Button size="lg" onClick={() => navigate('/app')} className="rounded-full px-8 h-12 text-base font-semibold">
              Get Started Free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button variant="outline" size="lg" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })} className="rounded-full px-8 h-12 text-base">
              Learn More
            </Button>
          </div>
        </motion.div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="px-6 md:px-12 py-20 md:py-28 bg-secondary/50">
        <div className="max-w-4xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">How it works</h3>
            <p className="text-muted-foreground mt-3 text-lg">Three simple steps to global shipping</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Shop globally', desc: 'Buy from any store. Use your Yobbanté warehouse address at checkout.', icon: Package },
              { step: '02', title: 'We receive it', desc: 'Your packages arrive at our warehouses. We verify and store them safely.', icon: Shield },
              { step: '03', title: 'Delivered to you', desc: 'Consolidate packages and ship to your door at the best rates.', icon: Truck },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
                className="text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-background border border-border flex items-center justify-center mx-auto mb-5 shadow-sm">
                  <item.icon className="w-6 h-6 text-primary" />
                </div>
                <p className="text-xs font-semibold text-primary mb-2">{item.step}</p>
                <h4 className="text-lg font-semibold text-foreground mb-2">{item.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Warehouses */}
      <section className="px-6 md:px-12 py-20 md:py-28">
        <div className="max-w-4xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Your global addresses</h3>
            <p className="text-muted-foreground mt-3 text-lg">Personal warehouse addresses in 3 countries</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { flag: '🇫🇷', country: 'France', desc: 'Access European brands and retailers' },
              { flag: '🇨🇳', country: 'China', desc: "Ship from the world's largest marketplace" },
              { flag: '🇺🇸', country: 'United States', desc: 'Buy from American stores with ease' },
            ].map((item, i) => (
              <motion.div
                key={item.country}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="p-6 rounded-2xl border border-border bg-card hover:shadow-lg transition-shadow"
              >
                <span className="text-4xl">{item.flag}</span>
                <h4 className="text-lg font-semibold text-foreground mt-4">{item.country}</h4>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 md:px-12 py-20 md:py-28 bg-secondary/50">
        <div className="max-w-4xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Built for smart shipping</h3>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { icon: Zap, title: 'Smart consolidation', desc: 'Automatically group packages to reduce shipping costs' },
              { icon: BarChart3, title: 'Real-time tracking', desc: 'Know where your packages are at every step' },
              { icon: Shield, title: 'Secure storage', desc: 'Packages verified and stored safely in our warehouses' },
              { icon: Globe, title: 'Global reach', desc: 'Ship to 150+ countries with optimized routes' },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="flex gap-4 p-5 rounded-2xl bg-background border border-border"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
                  <p className="text-sm text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-6 md:px-12 py-20 md:py-28">
        <div className="max-w-3xl mx-auto">
          <div className="grid grid-cols-3 gap-8 text-center">
            {[
              { value: '3', label: 'Warehouses' },
              { value: '150+', label: 'Countries' },
              { value: '48h', label: 'Avg. Delivery' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <p className="text-3xl md:text-5xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 md:px-12 py-20 md:py-28 bg-secondary/50">
        <motion.div {...fadeUp} className="max-w-2xl mx-auto text-center">
          <h3 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Start shipping smarter today</h3>
          <p className="text-lg text-muted-foreground mt-4">Join thousands of smart shoppers who save on international shipping.</p>
          <Button size="lg" onClick={() => navigate('/app')} className="rounded-full px-10 h-12 text-base font-semibold mt-8">
            Create Free Account
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="px-6 md:px-12 py-8 border-t border-border">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <p className="text-xs text-muted-foreground">© 2026 Yobbanté. All rights reserved.</p>
          <p className="text-xs text-muted-foreground">{"Built with \u2665"}</p>
        </div>
      </footer>
    </div>
  );
}
