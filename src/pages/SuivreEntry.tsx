import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { normalizeTrackingId } from '@/lib/trackingId';

/**
 * Canonical public tracking entry point.
 *  - /suivre/:trackingNumber → redirects to /track/:trackingNumber
 *  - /suivre?ref=XYZ        → redirects to /track/XYZ
 *  - /suivre                → redirects to /track (search form)
 * Tracking IDs are normalised (trim, strip #, uppercase) before redirect.
 */
export default function SuivreEntry() {
  const { trackingNumber } = useParams();
  const [sp] = useSearchParams();
  const raw = trackingNumber || sp.get('ref') || sp.get('tracking') || '';
  const ref = normalizeTrackingId(raw);
  return <Navigate to={ref ? `/track/${ref}` : '/track'} replace />;
}
