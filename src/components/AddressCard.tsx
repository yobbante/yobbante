import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check } from 'lucide-react';
import { Address, COUNTRY_FLAGS, COUNTRY_NAMES } from '@/lib/types';

export function AddressCard({ address }: { address: Address }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    const text = `${address.address_line}\nRef: ${address.identifier_code}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="bg-card rounded-xl p-4 border border-border hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">{COUNTRY_FLAGS[address.country]}</span>
          <span className="text-sm font-semibold text-foreground">{COUNTRY_NAMES[address.country]}</span>
        </div>
        <button
          onClick={copyToClipboard}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{address.address_line}</p>
      <div className="mt-2 px-2.5 py-1 bg-secondary rounded-lg text-xs font-mono text-primary">
        {address.identifier_code}
      </div>
    </motion.div>
  );
}
