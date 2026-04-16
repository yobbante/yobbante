import { motion } from 'framer-motion';
import { ArrowRight, Clock } from 'lucide-react';
import { Shipment, COUNTRY_FLAGS, COUNTRY_NAMES } from '@/lib/types';
import { StatusBadge, StatusProgress } from './StatusBadge';

export function ShipmentCard({ shipment }: { shipment: Shipment }) {
  const flag = COUNTRY_FLAGS[shipment.origin_country] || '';
  const destFlag = shipment.destination_country === 'SN' ? '🇸🇳' : '🌍';

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="bg-card rounded-xl p-5 border border-border hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-lg">{flag}</span>
          <span className="font-medium text-foreground">{COUNTRY_NAMES[shipment.origin_country]}</span>
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-lg">{destFlag}</span>
          <span className="font-medium text-foreground">
            {shipment.destination_country === 'SN' ? 'Senegal' : shipment.destination_country}
          </span>
        </div>
        <StatusBadge status={shipment.status} />
      </div>

      <StatusProgress status={shipment.status} type="shipment" />

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          {shipment.eta ? (
            <span>ETA: {new Date(shipment.eta).toLocaleDateString()}</span>
          ) : (
            <span>Calculating ETA...</span>
          )}
        </div>
        {shipment.total_cost && (
          <span className="text-xs font-semibold text-foreground">
            ${shipment.total_cost}
          </span>
        )}
      </div>
    </motion.div>
  );
}
