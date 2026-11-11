import Config from '@/config/config';
import { TrackingReportType } from '@/types/tracking';

const apiServer = Config.apiServer;

export async function fetchTrackingReport(
  jwt: string,
  projectId: string,
  statuses: number[] = []
): Promise<TrackingReportType> {
  const query = statuses.length > 0 ? `?status=${statuses.join(',')}` : '';
  const response = await fetch(`${apiServer}/reports/tracking/${projectId}${query}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  return response.json();
}
