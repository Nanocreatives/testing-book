import { logError } from './errorHandler';
import Config from '@/config/config';
import { StageType } from '@/types/stage';
const apiServer = Config.apiServer;

function headers(jwt: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${jwt}`,
  };
}

async function fetchStages(jwt: string, projectId: string): Promise<StageType[]> {
  const url = `${apiServer}/stages?projectId=${projectId}`;

  try {
    const response = await fetch(url, { method: 'GET', headers: headers(jwt) });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    return data || [];
  } catch (error: unknown) {
    logError('Error fetching stages', error);
    return [];
  }
}

async function createStage(
  jwt: string,
  projectId: string,
  stage: { kind: number; title: string; content?: string | null; runId?: number | null }
) {
  const url = `${apiServer}/stages?projectId=${projectId}`;

  try {
    const response = await fetch(url, { method: 'POST', headers: headers(jwt), body: JSON.stringify(stage) });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error: unknown) {
    logError('Error creating stage', error);
    throw error;
  }
}

async function updateStage(
  jwt: string,
  stageId: number,
  stage: { title: string; content?: string | null; runId?: number | null }
) {
  const url = `${apiServer}/stages/${stageId}`;

  try {
    const response = await fetch(url, { method: 'PUT', headers: headers(jwt), body: JSON.stringify(stage) });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error: unknown) {
    logError('Error updating stage', error);
    throw error;
  }
}

async function deleteStage(jwt: string, stageId: number) {
  const url = `${apiServer}/stages/${stageId}`;

  try {
    const response = await fetch(url, { method: 'DELETE', headers: headers(jwt) });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
  } catch (error: unknown) {
    logError('Error deleting stage', error);
    throw error;
  }
}

async function reorderStages(jwt: string, projectId: string, stageIds: number[]) {
  const url = `${apiServer}/stages/reorder?projectId=${projectId}`;

  try {
    const response = await fetch(url, { method: 'PUT', headers: headers(jwt), body: JSON.stringify({ stageIds }) });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
  } catch (error: unknown) {
    logError('Error reordering stages', error);
    throw error;
  }
}

async function completeStage(jwt: string, stageId: number) {
  const url = `${apiServer}/stages/${stageId}/complete`;

  try {
    const response = await fetch(url, { method: 'POST', headers: headers(jwt) });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error: unknown) {
    logError('Error completing stage', error);
    throw error;
  }
}

export { fetchStages, createStage, updateStage, deleteStage, reorderStages, completeStage };
