import Config from '@/config/config';
import { TrackingReportType } from '@/types/tracking';

const apiServer = Config.apiServer;

export async function fetchTrackingReport(jwt: string, projectId: string): Promise<TrackingReportType> {
  const response = await fetch(`${apiServer}/reports/tracking/${projectId}`, {
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
