import { Navigate, useParams, useSearchParams } from 'react-router-dom';

/**
 * Canonical public tracking entry point.
 *  - /suivre/:trackingNumber → redirects to /track/:trackingNumber
 *  - /suivre?ref=XYZ        → redirects to /track/XYZ
 *  - /suivre                → redirects to /track (search form)
 */
export default function SuivreEntry() {
  const { trackingNumber } = useParams();
  const [sp] = useSearchParams();
  const ref = trackingNumber || sp.get('ref') || sp.get('tracking') || '';
  return <Navigate to={ref ? `/track/${ref}` : '/track'} replace />;
}
