import { Navigate, useParams } from 'react-router-dom';
import { normalizeTrackingId } from '@/lib/trackingId';

/**
 * Legacy /track/:id alias → redirect to canonical /suivre/:id.
 * The naked /suivre?ref=… case is now handled directly by TrackPage.
 */
export default function SuivreEntry() {
  const { id, trackingNumber } = useParams();
  const ref = normalizeTrackingId(id || trackingNumber || '');
  return <Navigate to={ref ? `/suivre/${ref}` : '/suivre'} replace />;
}
